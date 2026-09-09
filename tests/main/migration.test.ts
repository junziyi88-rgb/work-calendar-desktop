// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryDatabase, openDatabase, type AppDatabase } from '../../electron/database';
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

  it('upgrades an existing version 2 database without changing stored work', async () => {
    const legacy = await createMemoryDatabase();
    legacy.db.run(`INSERT INTO work_items (id,title,status,summary,completed_at,deleted_at,created_at,updated_at)
      VALUES ('item-existing','长期事项','active','已推进到复核',NULL,NULL,'2026-08-01T01:00:00.000Z','2026-09-08T03:30:00.000Z')`);
    legacy.db.run(`INSERT INTO work_logs (id,work_item_id,content,effort_minutes,period_kind,period_start,deleted_at,created_at,updated_at)
      VALUES ('log-existing','item-existing','完成复核稿',75,'day','2026-09-08',NULL,'2026-09-08T03:30:00.000Z','2026-09-08T03:30:00.000Z')`);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'work-log-v2-'));
    const file = path.join(directory, 'work-calendar.sqlite');
    fs.writeFileSync(file, legacy.export());
    legacy.close();

    try {
      database = await openDatabase(file);
      const repositories = createRepositories(database, () => '2026-09-09T02:00:00.000Z');
      const data = repositories.workLogData();

      expect(data.items).toEqual([expect.objectContaining({ id: 'item-existing', title: '长期事项', summary: '已推进到复核' })]);
      expect(data.logs).toEqual([expect.objectContaining({
        id: 'log-existing', content: '完成复核稿', effortMinutes: 75,
        occurredAt: '2026-09-08T03:30:00.000Z', categoryId: null, categoryMode: 'auto'
      })]);
      expect(database.db.exec("SELECT value FROM meta WHERE key='schema_version'")[0].values[0][0]).toBe('3');
      const columns = database.db.exec('PRAGMA table_info(work_logs)')[0].values.map((entry) => entry[1]);
      expect(columns).toEqual(expect.arrayContaining(['occurred_at', 'category_id', 'category_mode']));
      expect(database.db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='categories'")[0].values).toHaveLength(1);
    } finally {
      database?.close();
      database = undefined as unknown as AppDatabase;
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
