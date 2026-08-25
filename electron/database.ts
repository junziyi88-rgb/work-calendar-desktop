import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database } from 'sql.js';

const SCHEMA = `
PRAGMA foreign_keys = ON;
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
CREATE INDEX IF NOT EXISTS idx_tasks_planned ON tasks(planned_start, planned_end);
CREATE INDEX IF NOT EXISTS idx_segments_range ON segments(start, end);
CREATE INDEX IF NOT EXISTS idx_segments_task ON segments(task_id);
INSERT OR REPLACE INTO meta(key, value) VALUES ('schema_version', '1');
`;

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
  database.db.run(SCHEMA);
  return database;
}

export async function openDatabase(filePath: string) {
  const SQL = await sqlRuntime();
  const bytes = fs.existsSync(filePath) ? fs.readFileSync(filePath) : undefined;
  const database = new AppDatabase(bytes ? new SQL.Database(bytes) : new SQL.Database(), filePath);
  database.db.run(SCHEMA);
  database.flush();
  return database;
}
