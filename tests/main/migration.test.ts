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

  it('upgrades an existing version 3 database without changing stored work', async () => {
    const legacy = await createMemoryDatabase();
    legacy.db.run('ALTER TABLE work_items DROP COLUMN category_id');
    legacy.db.run('ALTER TABLE work_items DROP COLUMN category_mode');
    legacy.db.run("INSERT OR REPLACE INTO meta(key,value) VALUES ('schema_version','3')");
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

      expect(data.items).toEqual([expect.objectContaining({
        id: 'item-existing', title: '长期事项', summary: '已推进到复核',
        categoryId: null, categoryMode: 'auto'
      })]);
      expect(data.logs).toEqual([expect.objectContaining({
        id: 'log-existing', content: '完成复核稿', effortMinutes: 75,
        occurredAt: '2026-09-08T03:30:00.000Z', categoryId: null, categoryMode: 'auto'
      })]);
      expect(database.db.exec("SELECT value FROM meta WHERE key='schema_version'")[0].values[0][0]).toBe('4');
      const columns = database.db.exec('PRAGMA table_info(work_logs)')[0].values.map((entry) => entry[1]);
      expect(columns).toEqual(expect.arrayContaining(['occurred_at', 'category_id', 'category_mode']));
      const itemColumns = database.db.exec('PRAGMA table_info(work_items)')[0].values.map((entry) => entry[1]);
      expect(itemColumns).toEqual(expect.arrayContaining(['category_id', 'category_mode']));
      expect(database.db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='categories'")[0].values).toHaveLength(1);
    } finally {
      database?.close();
      database = undefined as unknown as AppDatabase;
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('replaces legacy work-content keywords with item-title keywords and reclassifies automatic data', async () => {
    database = await createMemoryDatabase();
    database.db.run("INSERT OR REPLACE INTO meta(key,value) VALUES ('legacy_migrated_v2','1')");
    database.db.run("INSERT OR REPLACE INTO meta(key,value) VALUES ('item_categories_migrated_v4','1')");
    database.db.run(`INSERT INTO categories (id,name,color,keywords_json,deleted_at,created_at,updated_at) VALUES
      ('preview','预习课','#E1F3FE','["完成视频初审"]',NULL,'2026-09-01T00:00:00.000Z','2026-09-01T00:00:00.000Z'),
      ('words','字词预习课','#EDF3EC','["完成策略报告"]',NULL,'2026-09-02T00:00:00.000Z','2026-09-02T00:00:00.000Z'),
      ('classics','小古文','#FBF3DB','["撰写逐字稿"]',NULL,'2026-09-03T00:00:00.000Z','2026-09-03T00:00:00.000Z')`);
    database.db.run(`INSERT INTO work_items (id,title,status,summary,category_id,category_mode,completed_at,deleted_at,created_at,updated_at) VALUES
      ('named','字词预习课《古诗三首》','active','',NULL,'auto',NULL,NULL,'2026-09-04T00:00:00.000Z','2026-09-04T00:00:00.000Z'),
      ('learned','《守株待兔》','active','',NULL,'auto',NULL,NULL,'2026-09-05T00:00:00.000Z','2026-09-05T00:00:00.000Z')`);
    database.db.run(`INSERT INTO work_logs (id,work_item_id,content,effort_minutes,period_kind,period_start,occurred_at,category_id,category_mode,deleted_at,created_at,updated_at) VALUES
      ('manual','learned','完成逐字稿',NULL,'day','2026-09-08','2026-09-08T01:00:00.000Z','classics','manual',NULL,'2026-09-08T01:00:00.000Z','2026-09-08T01:00:00.000Z'),
      ('automatic','learned','完成终审',NULL,'day','2026-09-09','2026-09-09T01:00:00.000Z',NULL,'auto',NULL,'2026-09-09T01:00:00.000Z','2026-09-09T01:00:00.000Z')`);

    const repositories = createRepositories(database, () => '2026-09-10T02:00:00.000Z');

    expect(repositories.categories.get('preview')?.keywords).toEqual(['预习课']);
    expect(repositories.categories.get('words')?.keywords).toEqual(['字词预习课', '字词预习课《古诗三首》']);
    expect(repositories.categories.get('classics')?.keywords).toEqual(['小古文', '《守株待兔》']);
    expect(repositories.workItems.get('named')).toMatchObject({ categoryId: 'words', categoryMode: 'auto' });
    expect(repositories.workItems.get('learned')).toMatchObject({ categoryId: 'classics', categoryMode: 'auto' });
    expect(repositories.workLogs.get('automatic')).toMatchObject({ categoryId: 'classics', categoryMode: 'auto' });
    expect(repositories.workLogs.get('manual')).toMatchObject({ categoryId: 'classics', categoryMode: 'manual' });
  });
});
