// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryDatabase, type AppDatabase } from '../../electron/database';
import { createRepositories, type Repositories } from '../../electron/repositories';
import { workItemInputSchema, workLogInputSchema } from '../../src/shared/schemas';

describe('work log repositories', () => {
  let database: AppDatabase;
  let repositories: Repositories;

  beforeEach(async () => {
    database = await createMemoryDatabase();
    repositories = createRepositories(database, () => '2026-09-08T04:00:00.000Z');
  });

  afterEach(() => database.close());

  it('saves progress and completes its item in the same operation', () => {
    const item = repositories.workItems.save({ title: '待交付', categoryName: '交付', categoryMode: 'manual' });
    const input = workLogInputSchema.parse({ workItemId: item.id, content: '完成交付', periodKind: 'day', periodStart: '2026-09-08', completeItem: true });
    const log = repositories.workLogs.save(input);
    expect(log).toMatchObject({ workItemId: item.id, categoryId: item.categoryId });
    expect(repositories.workItems.get(item.id)).toMatchObject({ status: 'completed', summary: '完成交付', completedAt: '2026-09-08T04:00:00.000Z' });
  });

  it('rolls back the record if completing the item fails', () => {
    const item = repositories.workItems.save({ title: '待交付' });
    database.db.run("CREATE TRIGGER fail_completion BEFORE UPDATE OF status ON work_items WHEN NEW.status='completed' BEGIN SELECT RAISE(ABORT, 'completion failed'); END");
    const input = workLogInputSchema.parse({ workItemId: item.id, content: '完成交付', periodKind: 'day', periodStart: '2026-09-08', completeItem: true });
    expect(() => repositories.workLogs.save(input)).toThrow('completion failed');
    expect(repositories.workLogs.list()).toHaveLength(0);
    expect(repositories.workItems.get(item.id)).toMatchObject({ status: 'active', summary: '' });
  });

  it('reads historical logs using the current item category even if legacy cached fields disagree', () => {
    const item = repositories.workItems.save({ title: '确认事项', categoryName: '确认分类', categoryMode: 'manual' });
    const log = repositories.workLogs.save({ workItemId: item.id, content: '历史内容', periodKind: 'day', periodStart: '2026-09-08' });
    database.db.run("UPDATE work_logs SET category_id=NULL, category_mode='manual' WHERE id=?", [log.id]);
    expect(repositories.workLogs.get(log.id)).toMatchObject({ categoryId: item.categoryId, categoryMode: 'auto' });
    expect(repositories.workLogData().logs).toEqual([expect.objectContaining({ categoryId: item.categoryId, categoryMode: 'auto' })]);
  });

  it('preserves item category edits through IPC input validation', () => {
    const item = repositories.workItems.save(workItemInputSchema.parse({ title: '分类编辑', categoryName: '新分类', categoryMode: 'manual' }));
    expect(item.categoryMode).toBe('manual');
    expect(repositories.categories.get(item.categoryId!)?.name).toBe('新分类');
  });

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

  it('preserves legacy effort data when editing without the removed effort field', () => {
    const saved = repositories.workLogs.save({ content: '完成脚本初稿', effortMinutes: 45, periodKind: 'day', periodStart: '2026-09-08' });
    const edited = repositories.workLogs.save({ id: saved.id, content: '完成脚本终稿', periodKind: 'day', periodStart: '2026-09-08' });

    expect(edited.effortMinutes).toBe(45);
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

  it('propagates item category changes to every linked log', () => {
    const writing = repositories.categories.save({ name: '内容制作', color: '#EDF3EC', keywords: ['脚本'] });
    const coordination = repositories.categories.save({ name: '项目协作', color: '#E1F3FE', keywords: ['会议'] });
    const item = repositories.workItems.save({ title: '课程脚本开发' });
    const automatic = repositories.workLogs.save({ workItemId: item.id, content: '修改第三版', periodKind: 'day', periodStart: '2026-09-08' });
    const manual = repositories.workLogs.save({ workItemId: item.id, content: '跨组沟通', periodKind: 'day', periodStart: '2026-09-08', categoryId: writing.id, categoryMode: 'manual' });

    repositories.workItems.save({ id: item.id, title: item.title, categoryName: coordination.name, categoryMode: 'manual' });
    expect(repositories.workLogs.get(automatic.id)).toMatchObject({ categoryId: coordination.id, categoryMode: 'auto' });
    expect(repositories.workLogs.get(manual.id)).toMatchObject({ categoryId: coordination.id, categoryMode: 'auto' });
  });

  it('ignores record category overrides and inherits the target item when relinking', () => {
    const first = repositories.workItems.save({ title: '第一事项', categoryName: '制作', categoryMode: 'manual' });
    const second = repositories.workItems.save({ title: '第二事项', categoryName: '协作', categoryMode: 'manual' });
    const log = repositories.workLogs.save({ workItemId: first.id, content: '完成初稿', periodKind: 'day', periodStart: '2026-09-08', categoryName: '记录独立分类', categoryMode: 'manual' });
    expect(log).toMatchObject({ categoryId: first.categoryId, categoryMode: 'auto' });
    expect(repositories.categories.list().map((category) => category.name)).not.toContain('记录独立分类');
    expect(repositories.workLogs.save({ ...log, workItemId: second.id })).toMatchObject({ categoryId: second.categoryId, categoryMode: 'auto' });
    expect(repositories.workLogs.save({ ...log, workItemId: null })).toMatchObject({ categoryId: null, categoryMode: 'auto' });
  });

  it('normalizes legacy record overrides once without changing work content or dates', () => {
    const item = repositories.workItems.save({ title: '长期事项', categoryName: '事项分类', categoryMode: 'manual' });
    const log = repositories.workLogs.save({ workItemId: item.id, content: '完成复核', effortMinutes: 45, periodKind: 'day', periodStart: '2026-09-08', occurredAt: '2026-09-08T03:26:00.000Z' });
    database.db.run("UPDATE work_logs SET category_id=NULL, category_mode='manual', deleted_at='2026-09-09T00:00:00.000Z' WHERE id=?", [log.id]);
    database.db.run("DELETE FROM meta WHERE key='item_only_categories_migrated_v7'");
    const updated = createRepositories(database);
    expect(updated.workLogs.get(log.id)).toEqual({ ...log, categoryId: item.categoryId, categoryMode: 'auto', deletedAt: '2026-09-09T00:00:00.000Z' });
    expect(createRepositories(database).workLogs.get(log.id)).toEqual(updated.workLogs.get(log.id));
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
