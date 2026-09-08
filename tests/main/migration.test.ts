// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryDatabase, type AppDatabase } from '../../electron/database';
import { createRepositories } from '../../electron/repositories';

describe('legacy work calendar migration', () => {
  let database: AppDatabase;
  afterEach(() => database?.close());

  it('converts tasks and closed segments once without deleting legacy rows', async () => {
    database = await createMemoryDatabase();
    database.db.run(`INSERT INTO tasks (id,title,project_id,notes,status,planned_start,planned_end,completed_at,deleted_at,created_at,updated_at)
      VALUES ('task-1','课程上线',NULL,'完成需求梳理','completed',NULL,NULL,'2026-09-08T03:00:00.000Z',NULL,'2026-09-01T00:00:00.000Z','2026-09-08T03:00:00.000Z')`);
    database.db.run(`INSERT INTO segments (id,task_id,start,end,source,note,deleted_at,created_at,updated_at)
      VALUES ('segment-1','task-1','2026-09-08T01:00:00.000Z','2026-09-08T02:30:00.000Z','manual','修改脚本',NULL,'2026-09-08T01:00:00.000Z','2026-09-08T02:30:00.000Z')`);

    const first = createRepositories(database, () => '2026-09-08T04:00:00.000Z');
    expect(first.workLogData().items).toEqual([expect.objectContaining({ id: 'task-1', title: '课程上线', status: 'completed' })]);
    expect(first.workLogData().logs).toHaveLength(2);
    expect(first.workLogData().logs).toEqual(expect.arrayContaining([
      expect.objectContaining({ content: '修改脚本', effortMinutes: 90 }),
      expect.objectContaining({ content: '完成需求梳理', effortMinutes: null })
    ]));

    const second = createRepositories(database, () => '2026-09-08T05:00:00.000Z');
    expect(second.workLogData().logs).toHaveLength(2);
    expect(database.db.exec('SELECT * FROM tasks')[0].values).toHaveLength(1);
  });
});
