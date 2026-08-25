import { randomUUID } from 'node:crypto';
import type { BindParams, Database } from 'sql.js';
import type {
  AppSettings, CalendarData, CalendarQuery, DailyReview, DeletedItem, Project,
  SegmentInput, Tag, Task, TaskInput, TimeSegment
} from '../src/shared/contracts';
import type { AppDatabase } from './database';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system', weekStartsOn: 1, dayStartHour: 7, dayEndHour: 22,
  defaultPlannedMinutes: 60, allowParallelTimers: false, privateNotifications: false,
  launchAtStartup: false, globalShortcut: 'CommandOrControl+Shift+Space',
  longTimerMinutes: 180, backupRetention: 14, floatingTimer: false
};

function rows<T>(db: Database, sql: string, params: BindParams = []): T[] {
  const statement = db.prepare(sql, params);
  const output: T[] = [];
  while (statement.step()) output.push(statement.getAsObject() as T);
  statement.free();
  return output;
}

function row<T>(db: Database, sql: string, params: BindParams = []): T | null {
  return rows<T>(db, sql, params)[0] ?? null;
}

type ProjectRow = { id: string; name: string; color: string; archived_at: string | null; created_at: string; updated_at: string };
type TagRow = { id: string; name: string; color: string; created_at: string; updated_at: string };
type TaskRow = { id: string; title: string; project_id: string | null; notes: string; status: Task['status']; planned_start: string | null; planned_end: string | null; completed_at: string | null; deleted_at: string | null; created_at: string; updated_at: string };
type SegmentRow = { id: string; task_id: string; start: string; end: string | null; source: TimeSegment['source']; note: string; deleted_at: string | null; created_at: string; updated_at: string };

const mapProject = (item: ProjectRow): Project => ({ id: item.id, name: item.name, color: item.color, archivedAt: item.archived_at, createdAt: item.created_at, updatedAt: item.updated_at });
const mapTag = (item: TagRow): Tag => ({ id: item.id, name: item.name, color: item.color, createdAt: item.created_at, updatedAt: item.updated_at });
const mapSegment = (item: SegmentRow): TimeSegment => ({ id: item.id, taskId: item.task_id, start: item.start, end: item.end, source: item.source, note: item.note, deletedAt: item.deleted_at, createdAt: item.created_at, updatedAt: item.updated_at });

export function createRepositories(database: AppDatabase, now: () => string = () => new Date().toISOString()) {
  const { db } = database;
  const tagIdsForTask = (taskId: string) => rows<{ tag_id: string }>(db, 'SELECT tag_id FROM task_tags WHERE task_id = ? ORDER BY tag_id', [taskId]).map((item) => item.tag_id);
  const mapTask = (item: TaskRow): Task => ({ id: item.id, title: item.title, projectId: item.project_id, notes: item.notes, status: item.status, plannedStart: item.planned_start, plannedEnd: item.planned_end, completedAt: item.completed_at, deletedAt: item.deleted_at, createdAt: item.created_at, updatedAt: item.updated_at, tagIds: tagIdsForTask(item.id) });
  const persist = () => database.flush();

  const projects = {
    list: (includeArchived = false) => rows<ProjectRow>(db, `SELECT * FROM projects ${includeArchived ? '' : 'WHERE archived_at IS NULL'} ORDER BY name`).map(mapProject),
    get: (id: string) => { const item = row<ProjectRow>(db, 'SELECT * FROM projects WHERE id = ?', [id]); return item ? mapProject(item) : null; },
    save: (input: { id?: string; name: string; color: string }) => {
      const id = input.id ?? randomUUID(); const timestamp = now();
      const existing = input.id ? row<ProjectRow>(db, 'SELECT * FROM projects WHERE id = ?', [input.id]) : null;
      if (existing) db.run('UPDATE projects SET name=?, color=?, updated_at=? WHERE id=?', [input.name.trim(), input.color, timestamp, id]);
      else db.run('INSERT INTO projects VALUES (?, ?, ?, NULL, ?, ?)', [id, input.name.trim(), input.color, timestamp, timestamp]);
      persist(); return projects.get(id)!;
    },
    archive: (id: string) => { const timestamp = now(); db.run('UPDATE projects SET archived_at=?, updated_at=? WHERE id=?', [timestamp, timestamp, id]); persist(); }
  };

  const tags = {
    list: () => rows<TagRow>(db, 'SELECT * FROM tags ORDER BY name').map(mapTag),
    get: (id: string) => { const item = row<TagRow>(db, 'SELECT * FROM tags WHERE id=?', [id]); return item ? mapTag(item) : null; },
    save: (input: { id?: string; name: string; color: string }) => {
      const id = input.id ?? randomUUID(); const timestamp = now();
      const existing = input.id ? row<TagRow>(db, 'SELECT * FROM tags WHERE id=?', [input.id]) : null;
      if (existing) db.run('UPDATE tags SET name=?, color=?, updated_at=? WHERE id=?', [input.name.trim(), input.color, timestamp, id]);
      else db.run('INSERT INTO tags VALUES (?, ?, ?, ?, ?)', [id, input.name.trim(), input.color, timestamp, timestamp]);
      persist(); return tags.get(id)!;
    }
  };

  const tasks = {
    list: (includeDeleted = false) => rows<TaskRow>(db, `SELECT * FROM tasks ${includeDeleted ? '' : 'WHERE deleted_at IS NULL'} ORDER BY COALESCE(planned_start, created_at)`).map(mapTask),
    get: (id: string) => { const item = row<TaskRow>(db, 'SELECT * FROM tasks WHERE id=?', [id]); return item ? mapTask(item) : null; },
    save: (input: TaskInput) => {
      const id = input.id ?? randomUUID(); const timestamp = now();
      const existing = input.id ? row<TaskRow>(db, 'SELECT * FROM tasks WHERE id=?', [input.id]) : null;
      const status = input.status ?? existing?.status ?? 'todo';
      const completedAt = status === 'completed' ? existing?.completed_at ?? timestamp : null;
      db.run('BEGIN');
      try {
        if (existing) {
          db.run(`UPDATE tasks SET title=?, project_id=?, notes=?, status=?, planned_start=?, planned_end=?, completed_at=?, updated_at=? WHERE id=?`,
            [input.title.trim(), input.projectId ?? null, input.notes ?? '', status, input.plannedStart ?? null, input.plannedEnd ?? null, completedAt, timestamp, id]);
        } else {
          db.run(`INSERT INTO tasks (id,title,project_id,notes,status,planned_start,planned_end,completed_at,deleted_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,NULL,?,?)`,
            [id, input.title.trim(), input.projectId ?? null, input.notes ?? '', status, input.plannedStart ?? null, input.plannedEnd ?? null, completedAt, timestamp, timestamp]);
        }
        db.run('DELETE FROM task_tags WHERE task_id=?', [id]);
        const tagIds = input.tagIds ?? (existing ? tagIdsForTask(id) : []);
        for (const tagId of tagIds) db.run('INSERT OR IGNORE INTO task_tags VALUES (?,?)', [id, tagId]);
        db.run('COMMIT');
      } catch (error) { db.run('ROLLBACK'); throw error; }
      persist(); return tasks.get(id)!;
    }
  };

  const segments = {
    list: (includeDeleted = false) => rows<SegmentRow>(db, `SELECT * FROM segments ${includeDeleted ? '' : 'WHERE deleted_at IS NULL'} ORDER BY start`).map(mapSegment),
    get: (id: string) => { const item = row<SegmentRow>(db, 'SELECT * FROM segments WHERE id=?', [id]); return item ? mapSegment(item) : null; },
    save: (input: SegmentInput) => {
      const id = input.id ?? randomUUID(); const timestamp = now();
      const existing = input.id ? row<SegmentRow>(db, 'SELECT * FROM segments WHERE id=?', [input.id]) : null;
      if (existing) db.run('UPDATE segments SET task_id=?, start=?, end=?, source=?, note=?, updated_at=? WHERE id=?', [input.taskId, input.start, input.end ?? null, input.source, input.note ?? '', timestamp, id]);
      else db.run('INSERT INTO segments VALUES (?,?,?,?,?,?,NULL,?,?)', [id, input.taskId, input.start, input.end ?? null, input.source, input.note ?? '', timestamp, timestamp]);
      if (!input.end) db.run("UPDATE tasks SET status='in_progress', updated_at=? WHERE id=? AND status='todo'", [timestamp, input.taskId]);
      persist(); return segments.get(id)!;
    },
    stop: (id: string, end: string) => { db.run('UPDATE segments SET end=?, updated_at=? WHERE id=?', [end, now(), id]); persist(); return segments.get(id)!; }
  };

  const reviews = {
    get: (date: string): DailyReview | null => {
      const item = row<Record<string, string | number>>(db, 'SELECT * FROM reviews WHERE date=?', [date]);
      return item ? { date: item.date as string, accomplishments: item.accomplishments as string, blockers: item.blockers as string, tomorrowFocus: item.tomorrow_focus as string, targetMinutes: item.target_minutes as number, createdAt: item.created_at as string, updatedAt: item.updated_at as string } : null;
    },
    save: (input: Partial<DailyReview> & Pick<DailyReview, 'date'>) => {
      const timestamp = now(); const existing = reviews.get(input.date);
      if (existing) db.run('UPDATE reviews SET accomplishments=?, blockers=?, tomorrow_focus=?, target_minutes=?, updated_at=? WHERE date=?', [input.accomplishments ?? existing.accomplishments, input.blockers ?? existing.blockers, input.tomorrowFocus ?? existing.tomorrowFocus, input.targetMinutes ?? existing.targetMinutes, timestamp, input.date]);
      else db.run('INSERT INTO reviews VALUES (?,?,?,?,?,?,?)', [input.date, input.accomplishments ?? '', input.blockers ?? '', input.tomorrowFocus ?? '', input.targetMinutes ?? 480, timestamp, timestamp]);
      persist(); return reviews.get(input.date)!;
    }
  };

  const settings = {
    get: (): AppSettings => { const item = row<{ value: string }>(db, "SELECT value FROM settings WHERE key='app'"); return item ? { ...DEFAULT_SETTINGS, ...JSON.parse(item.value) } : { ...DEFAULT_SETTINGS }; },
    save: (input: Partial<AppSettings>) => { const value = { ...settings.get(), ...input }; db.run("INSERT OR REPLACE INTO settings(key,value) VALUES ('app',?)", [JSON.stringify(value)]); persist(); return value; }
  };

  const recycle = {
    softDelete: (kind: DeletedItem['kind'], id: string) => { const table = kind === 'task' ? 'tasks' : kind === 'segment' ? 'segments' : 'projects'; const column = kind === 'project' ? 'archived_at' : 'deleted_at'; db.run(`UPDATE ${table} SET ${column}=?, updated_at=? WHERE id=?`, [now(), now(), id]); persist(); },
    restore: (kind: DeletedItem['kind'], id: string) => { const table = kind === 'task' ? 'tasks' : kind === 'segment' ? 'segments' : 'projects'; const column = kind === 'project' ? 'archived_at' : 'deleted_at'; db.run(`UPDATE ${table} SET ${column}=NULL, updated_at=? WHERE id=?`, [now(), id]); persist(); },
    list: (): DeletedItem[] => {
      const deletedTasks = rows<{ id: string; title: string; deleted_at: string }>(db, 'SELECT id,title,deleted_at FROM tasks WHERE deleted_at IS NOT NULL').map((item) => ({ id: item.id, title: item.title, deletedAt: item.deleted_at, kind: 'task' as const }));
      const deletedSegments = rows<{ id: string; title: string; deleted_at: string }>(db, "SELECT segments.id, tasks.title || ' · 时间记录' AS title, segments.deleted_at FROM segments JOIN tasks ON tasks.id=segments.task_id WHERE segments.deleted_at IS NOT NULL").map((item) => ({ id: item.id, title: item.title, deletedAt: item.deleted_at, kind: 'segment' as const }));
      const archivedProjects = rows<{ id: string; name: string; archived_at: string }>(db, 'SELECT id,name,archived_at FROM projects WHERE archived_at IS NOT NULL').map((item) => ({ id: item.id, title: item.name, deletedAt: item.archived_at, kind: 'project' as const }));
      return [...deletedTasks, ...deletedSegments, ...archivedProjects].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
    },
    permanentlyDelete: (kind: DeletedItem['kind'], id: string) => {
      db.run('BEGIN'); try {
        if (kind === 'task') { db.run('DELETE FROM task_tags WHERE task_id=?', [id]); db.run('DELETE FROM segments WHERE task_id=?', [id]); db.run('DELETE FROM tasks WHERE id=?', [id]); }
        else if (kind === 'segment') db.run('DELETE FROM segments WHERE id=?', [id]);
        else { db.run('UPDATE tasks SET project_id=NULL WHERE project_id=?', [id]); db.run('DELETE FROM projects WHERE id=?', [id]); }
        db.run('COMMIT');
      } catch (error) { db.run('ROLLBACK'); throw error; }
      persist();
    }
  };

  const calendar = {
    query: (query: CalendarQuery): CalendarData => {
      const allSegments = segments.list(Boolean(query.includeDeleted)).filter((segment) => segment.start < query.end && (segment.end ?? now()) > query.start);
      const segmentTaskIds = new Set(allSegments.map((segment) => segment.taskId));
      let allTasks = tasks.list(Boolean(query.includeDeleted)).filter((task) => {
        const planned = Boolean(task.plannedStart && task.plannedEnd && task.plannedStart < query.end && task.plannedEnd > query.start);
        return planned || segmentTaskIds.has(task.id);
      });
      if (query.search?.trim()) { const needle = query.search.trim().toLocaleLowerCase(); allTasks = allTasks.filter((task) => `${task.title} ${task.notes}`.toLocaleLowerCase().includes(needle)); }
      if (query.projectIds?.length) allTasks = allTasks.filter((task) => task.projectId && query.projectIds!.includes(task.projectId));
      if (query.tagIds?.length) allTasks = allTasks.filter((task) => query.tagIds!.some((tagId) => task.tagIds.includes(tagId)));
      if (query.statuses?.length) allTasks = allTasks.filter((task) => query.statuses!.includes(task.status));
      const ids = new Set(allTasks.map((task) => task.id));
      return { tasks: allTasks, segments: allSegments.filter((segment) => ids.has(segment.taskId)), projects: projects.list(), tags: tags.list() };
    }
  };

  return { projects, tags, tasks, segments, reviews, settings, recycle, calendar };
}

export type Repositories = ReturnType<typeof createRepositories>;
