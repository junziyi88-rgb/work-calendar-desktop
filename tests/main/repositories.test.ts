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
});
