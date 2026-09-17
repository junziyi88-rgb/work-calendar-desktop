// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryDatabase, type AppDatabase } from '../../electron/database';
import { createRepositories, type Repositories } from '../../electron/repositories';

describe('work log repositories', () => {
  let database: AppDatabase;
  let repositories: Repositories;

  beforeEach(async () => {
    database = await createMemoryDatabase();
    repositories = createRepositories(database, () => '2026-09-08T04:00:00.000Z');
  });

  afterEach(() => database.close());

  it('persists long-running items and manual progress logs', () => {
    const item = repositories.workItems.save({ title: '课程上线' });
    const log = repositories.workLogs.save({ workItemId: item.id, content: '完成第三轮脚本修改', effortMinutes: 90, periodKind: 'day', periodStart: '2026-09-08' });

    expect(repositories.workLogData()).toMatchObject({
      items: [expect.objectContaining({ id: item.id, title: '课程上线', summary: '完成第三轮脚本修改' })],
      logs: [expect.objectContaining({ id: log.id, effortMinutes: 90 })]
    });
  });

  it('completes and reopens items before accepting more progress', () => {
    const item = repositories.workItems.save({ title: '桌面工具' });
    repositories.workItems.complete(item.id);

    expect(repositories.workItems.get(item.id)?.status).toBe('completed');
    expect(() => repositories.workLogs.save({ workItemId: item.id, content: '继续修改', effortMinutes: 30, periodKind: 'day', periodStart: '2026-09-08' })).toThrow('请先重新打开事项');

    repositories.workItems.reopen(item.id);
    expect(repositories.workLogs.save({ workItemId: item.id, content: '继续修改', effortMinutes: 30, periodKind: 'day', periodStart: '2026-09-08' }).content).toBe('继续修改');
  });

  it('soft-deletes and restores logs for Undo', () => {
    const log = repositories.workLogs.save({ content: '临时沟通', effortMinutes: null, periodKind: 'week', periodStart: '2026-09-07' });
    repositories.workLogs.softDelete(log.id);
    expect(repositories.workLogData().logs).toHaveLength(0);
    repositories.workLogs.restore(log.id);
    expect(repositories.workLogData().logs).toEqual([expect.objectContaining({ id: log.id })]);
  });

  it('stores occurrence time and edits both the linked item and work content', () => {
    const first = repositories.workItems.save({ title: '课程上线' });
    const second = repositories.workItems.save({ title: 'OKR整理' });
    const saved = repositories.workLogs.save({
      workItemId: first.id, content: '完成脚本初稿', effortMinutes: 45,
      periodKind: 'day', periodStart: '2026-09-08', occurredAt: '2026-09-08T03:26:00.000Z'
    });
    const edited = repositories.workLogs.save({
      id: saved.id, workItemId: second.id, content: '整理本月进展', effortMinutes: 60,
      periodKind: 'day', periodStart: '2026-09-09', occurredAt: '2026-09-09T08:15:00.000Z'
    });

    expect(edited).toMatchObject({ workItemId: second.id, content: '整理本月进展', occurredAt: '2026-09-09T08:15:00.000Z' });
    expect(repositories.workItems.get(second.id)?.summary).toBe('整理本月进展');
  });

  it('classifies items by title and makes automatic logs inherit the item category', () => {
    const writing = repositories.categories.save({ name: '内容制作', color: '#EDF3EC', keywords: ['脚本'] });
    const item = repositories.workItems.save({ title: '课程脚本开发' });
    expect(item).toMatchObject({ categoryId: writing.id, categoryMode: 'auto' });

    const automatic = repositories.workLogs.save({ workItemId: item.id, content: '修改第三版', periodKind: 'day', periodStart: '2026-09-08' });
    expect(automatic).toMatchObject({ categoryId: writing.id, categoryMode: 'auto', occurredAt: '2026-09-08T04:00:00.000Z' });
    const unlinked = repositories.workLogs.save({ content: '完成脚本修改', periodKind: 'day', periodStart: '2026-09-08' });
    expect(unlinked).toMatchObject({ categoryId: null, categoryMode: 'auto' });
  });

  it('propagates item category changes only to automatic logs', () => {
    const writing = repositories.categories.save({ name: '内容制作', color: '#EDF3EC', keywords: ['脚本'] });
    const coordination = repositories.categories.save({ name: '项目协作', color: '#E1F3FE', keywords: ['会议'] });
    const item = repositories.workItems.save({ title: '课程脚本开发' });
    const automatic = repositories.workLogs.save({ workItemId: item.id, content: '修改第三版', periodKind: 'day', periodStart: '2026-09-08' });
    const manual = repositories.workLogs.save({ workItemId: item.id, content: '跨组沟通', periodKind: 'day', periodStart: '2026-09-08', categoryId: writing.id, categoryMode: 'manual' });

    repositories.workItems.save({ id: item.id, title: item.title, categoryName: coordination.name, categoryMode: 'manual' });
    expect(repositories.workLogs.get(automatic.id)).toMatchObject({ categoryId: coordination.id, categoryMode: 'auto' });
    expect(repositories.workLogs.get(manual.id)).toMatchObject({ categoryId: writing.id, categoryMode: 'manual' });
  });

  it('creates or reuses typed item categories and learns complete item names', () => {
    const waiting = repositories.workItems.save({ title: '课程上线复盘' });
    const first = repositories.workItems.save({ title: '课程上线', categoryName: '内容制作', categoryMode: 'manual' });
    const created = repositories.categories.list()[0];
    expect(first).toMatchObject({ categoryId: created.id, categoryMode: 'manual' });
    expect(created).toMatchObject({ name: '内容制作', keywords: ['课程上线'] });
    expect(repositories.workItems.get(waiting.id)).toMatchObject({ categoryId: created.id, categoryMode: 'auto' });

    repositories.workItems.save({ id: first.id, title: '课程交付', categoryName: '  内容制作  ', categoryMode: 'manual' });
    expect(repositories.categories.list()).toHaveLength(1);
    expect(repositories.categories.list()[0].keywords).toEqual(['课程上线', '课程交付']);

    const automatic = repositories.workItems.save({ title: '课程交付复盘' });
    expect(automatic).toMatchObject({ categoryId: created.id, categoryMode: 'auto' });
  });

  it('reclassifies automatic items and logs after rule changes and returns reusable content options', () => {
    const category = repositories.categories.save({ name: '内容制作', color: '#EDF3EC', keywords: ['文案'] });
    const item = repositories.workItems.save({ title: '课程脚本开发' });
    const first = repositories.workLogs.save({ workItemId: item.id, content: '完成第三版', periodKind: 'day', periodStart: '2026-09-08' });
    repositories.workLogs.save({ content: '参加周会', periodKind: 'day', periodStart: '2026-09-08' });
    expect(first.categoryId).toBeNull();

    repositories.categories.save({ ...category, keywords: ['脚本'] });
    const data = repositories.workLogData();
    expect(repositories.workItems.get(item.id)?.categoryId).toBe(category.id);
    expect(repositories.workLogs.get(first.id)?.categoryId).toBe(category.id);
    expect(data.categories).toEqual([expect.objectContaining({ id: category.id, keywords: ['脚本'] })]);
    expect(data.contentOptions).toEqual(['参加周会', '完成第三版']);
  });

  it('allows editing a log that remains linked to a completed item', () => {
    const item = repositories.workItems.save({ title: '已结项事项' });
    const log = repositories.workLogs.save({ workItemId: item.id, content: '完成交付', periodKind: 'day', periodStart: '2026-09-08' });
    repositories.workItems.complete(item.id);

    expect(repositories.workLogs.save({ ...log, content: '完成交付与归档' }).content).toBe('完成交付与归档');
  });
});
