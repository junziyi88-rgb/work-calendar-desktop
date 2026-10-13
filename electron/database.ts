import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database } from 'sql.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL,
  archived_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, color TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, project_id TEXT, notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo', planned_start TEXT, planned_end TEXT, completed_at TEXT,
  deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);
CREATE TABLE IF NOT EXISTS task_tags (
  task_id TEXT NOT NULL, tag_id TEXT NOT NULL, PRIMARY KEY(task_id, tag_id),
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS segments (
  id TEXT PRIMARY KEY, task_id TEXT NOT NULL, start TEXT NOT NULL, end TEXT,
  source TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', deleted_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS reviews (
  date TEXT PRIMARY KEY, accomplishments TEXT NOT NULL DEFAULT '', blockers TEXT NOT NULL DEFAULT '',
  tomorrow_focus TEXT NOT NULL DEFAULT '', target_minutes INTEGER NOT NULL DEFAULT 480,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS work_items (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
  summary TEXT NOT NULL DEFAULT '', category_id TEXT, category_mode TEXT NOT NULL DEFAULT 'auto',
  completed_at TEXT, deleted_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL,
  keywords_json TEXT NOT NULL DEFAULT '[]', deleted_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS work_logs (
  id TEXT PRIMARY KEY, work_item_id TEXT, content TEXT NOT NULL, effort_minutes INTEGER,
  period_kind TEXT NOT NULL, period_start TEXT NOT NULL, occurred_at TEXT,
  category_id TEXT, category_mode TEXT NOT NULL DEFAULT 'auto', deleted_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY(work_item_id) REFERENCES work_items(id),
  FOREIGN KEY(category_id) REFERENCES categories(id)
);
CREATE INDEX IF NOT EXISTS idx_tasks_planned ON tasks(planned_start, planned_end);
CREATE INDEX IF NOT EXISTS idx_segments_range ON segments(start, end);
CREATE INDEX IF NOT EXISTS idx_segments_task ON segments(task_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_period ON work_logs(period_start, period_kind);
CREATE INDEX IF NOT EXISTS idx_work_logs_item ON work_logs(work_item_id);
CREATE INDEX IF NOT EXISTS idx_work_items_updated ON work_items(updated_at);
`;

function tableColumns(db: Database, table: string) {
  const result = db.exec(`PRAGMA table_info(${table})`)[0];
  return new Set((result?.values ?? []).map((entry) => String(entry[1])));
}

function applySchema(db: Database) {
  db.run('PRAGMA foreign_keys = ON');
  db.run('BEGIN');
  try {
    db.run(SCHEMA);
    const logColumns = tableColumns(db, 'work_logs');
    if (!logColumns.has('occurred_at')) db.run('ALTER TABLE work_logs ADD COLUMN occurred_at TEXT');
    if (!logColumns.has('category_id')) db.run('ALTER TABLE work_logs ADD COLUMN category_id TEXT');
    if (!logColumns.has('category_mode')) db.run("ALTER TABLE work_logs ADD COLUMN category_mode TEXT NOT NULL DEFAULT 'auto'");
    const itemColumns = tableColumns(db, 'work_items');
    if (!itemColumns.has('category_id')) db.run('ALTER TABLE work_items ADD COLUMN category_id TEXT');
    if (!itemColumns.has('category_mode')) db.run("ALTER TABLE work_items ADD COLUMN category_mode TEXT NOT NULL DEFAULT 'auto'");
    db.run('CREATE INDEX IF NOT EXISTS idx_work_logs_category ON work_logs(category_id)');
    db.run("UPDATE work_logs SET occurred_at=created_at WHERE occurred_at IS NULL OR occurred_at=''");
    db.run("UPDATE work_logs SET category_mode='auto' WHERE category_mode IS NULL OR category_mode=''");
    db.run("UPDATE work_items SET category_mode='auto' WHERE category_mode IS NULL OR category_mode=''");
    db.run("INSERT OR REPLACE INTO meta(key,value) VALUES ('schema_version','4')");
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
}

export class AppDatabase {
  constructor(public readonly db: Database, private readonly filePath: string | null) {}

  flush() {
    if (!this.filePath) return;
    const targetDir = path.dirname(this.filePath);
    fs.mkdirSync(targetDir, { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, Buffer.from(this.db.export()));
    fs.renameSync(tempPath, this.filePath);
  }

  export() {
    return Buffer.from(this.db.export());
  }

  close() {
    this.flush();
    this.db.close();
  }
}

async function sqlRuntime() {
  return initSqlJs({
    locateFile: (file) => require.resolve(`sql.js/dist/${file}`)
  });
}

export async function createMemoryDatabase() {
  const SQL = await sqlRuntime();
  const database = new AppDatabase(new SQL.Database(), null);
  applySchema(database.db);
  return database;
}

export async function openDatabase(filePath: string) {
  const SQL = await sqlRuntime();
  const bytes = fs.existsSync(filePath) ? fs.readFileSync(filePath) : undefined;
  const database = new AppDatabase(bytes ? new SQL.Database(bytes) : new SQL.Database(), filePath);
  applySchema(database.db);
  database.flush();
  return database;
}
