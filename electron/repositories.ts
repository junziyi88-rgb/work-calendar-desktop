import { randomUUID } from 'node:crypto';
import type { BindParams, Database } from 'sql.js';
import type {
  AppSettings, CalendarData, CalendarQuery, Category, CategoryInput, DailyReview, DeletedItem, Project,
  SegmentInput, Tag, Task, TaskInput, TimeSegment, WorkItem, WorkItemInput,
  WorkLog, WorkLogData, WorkLogInput
} from '../src/shared/contracts';
import { historicalContentOptions, matchCategory } from '../src/domain/categories';
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
type WorkItemRow = { id: string; title: string; status: WorkItem['status']; summary: string; category_id: string | null; category_mode: WorkItem['categoryMode']; completed_at: string | null; deleted_at: string | null; created_at: string; updated_at: string };
type WorkLogRow = { id: string; work_item_id: string | null; content: string; effort_minutes: number | null; period_kind: WorkLog['periodKind']; period_start: string; occurred_at: string; category_id: string | null; category_mode: WorkLog['categoryMode']; deleted_at: string | null; created_at: string; updated_at: string };
type CategoryRow = { id: string; name: string; color: string; keywords_json: string; deleted_at: string | null; created_at: string; updated_at: string };

const mapProject = (item: ProjectRow): Project => ({ id: item.id, name: item.name, color: item.color, archivedAt: item.archived_at, createdAt: item.created_at, updatedAt: item.updated_at });
const mapTag = (item: TagRow): Tag => ({ id: item.id, name: item.name, color: item.color, createdAt: item.created_at, updatedAt: item.updated_at });
const mapSegment = (item: SegmentRow): TimeSegment => ({ id: item.id, taskId: item.task_id, start: item.start, end: item.end, source: item.source, note: item.note, deletedAt: item.deleted_at, createdAt: item.created_at, updatedAt: item.updated_at });
const mapWorkItem = (item: WorkItemRow): WorkItem => ({ id: item.id, title: item.title, categoryId: item.category_id, categoryMode: item.category_mode, status: item.status, summary: item.summary, completedAt: item.completed_at, deletedAt: item.deleted_at, createdAt: item.created_at, updatedAt: item.updated_at });
const mapWorkLog = (item: WorkLogRow): WorkLog => ({ id: item.id, workItemId: item.work_item_id, content: item.content, effortMinutes: item.effort_minutes, periodKind: item.period_kind, periodStart: item.period_start, occurredAt: item.occurred_at, categoryId: item.category_id, categoryMode: item.category_mode, deletedAt: item.deleted_at, createdAt: item.created_at, updatedAt: item.updated_at });
const mapCategory = (item: CategoryRow): Category => ({ id: item.id, name: item.name, color: item.color, keywords: JSON.parse(item.keywords_json) as string[], deletedAt: item.deleted_at, createdAt: item.created_at, updatedAt: item.updated_at });

export function createRepositories(database: AppDatabase, now: () => string = () => new Date().toISOString()) {
  const { db } = database;
  const tagIdsForTask = (taskId: string) => rows<{ tag_id: string }>(db, 'SELECT tag_id FROM task_tags WHERE task_id = ? ORDER BY tag_id', [taskId]).map((item) => item.tag_id);
  const mapTask = (item: TaskRow): Task => ({ id: item.id, title: item.title, projectId: item.project_id, notes: item.notes, status: item.status, plannedStart: item.planned_start, plannedEnd: item.planned_end, completedAt: item.completed_at, deletedAt: item.deleted_at, createdAt: item.created_at, updatedAt: item.updated_at, tagIds: tagIdsForTask(item.id) });
  const persist = () => database.flush();

  const migrated = row<{ value: string }>(db, "SELECT value FROM meta WHERE key='legacy_migrated_v2'");
  if (!migrated) {
    const timestamp = now();
    db.run('BEGIN');
    try {
      const legacyTasks = rows<TaskRow>(db, 'SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY created_at');
      const legacySegments = rows<SegmentRow>(db, 'SELECT * FROM segments WHERE deleted_at IS NULL ORDER BY start');
      for (const task of legacyTasks) {
        db.run(`INSERT OR IGNORE INTO work_items (id,title,status,summary,completed_at,deleted_at,created_at,updated_at)
          VALUES (?,?,?,?,?,NULL,?,?)`, [task.id, task.title, task.status === 'completed' ? 'completed' : 'active', task.notes, task.status === 'completed' ? task.completed_at ?? timestamp : null, task.created_at, task.updated_at]);
        if (task.notes.trim()) {
          db.run(`INSERT OR IGNORE INTO work_logs (id,work_item_id,content,effort_minutes,period_kind,period_start,occurred_at,category_id,category_mode,deleted_at,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,NULL,'auto',NULL,?,?)`, [`legacy-note-${task.id}`, task.id, task.notes.trim(), null, 'day', task.updated_at.slice(0, 10), task.updated_at, task.updated_at, task.updated_at]);
        }
      }
      for (const segment of legacySegments) {
        const task = legacyTasks.find((candidate) => candidate.id === segment.task_id);
        if (!task) continue;
        const end = segment.end ?? timestamp;
        const duration = Math.max(0, Math.min(1440, Math.round((new Date(end).getTime() - new Date(segment.start).getTime()) / 60_000)));
        const content = segment.note.trim() || (segment.end ? task.title : `${task.title}（旧版计时迁移估算）`);
        db.run(`INSERT OR IGNORE INTO work_logs (id,work_item_id,content,effort_minutes,period_kind,period_start,occurred_at,category_id,category_mode,deleted_at,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,NULL,'auto',NULL,?,?)`, [`legacy-segment-${segment.id}`, task.id, content, duration, 'day', segment.start.slice(0, 10), segment.start, segment.created_at, segment.updated_at]);
      }
      db.run("INSERT INTO meta(key,value) VALUES ('legacy_migrated_v2','1')");
      db.run('COMMIT');
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
    persist();
  }

  const normalizedKeywords = (keywords: string[]) => {
    const seen = new Set<string>();
    return keywords.flatMap((keyword) => {
      const value = keyword.trim(); const key = value.toLocaleLowerCase();
      if (!value || seen.has(key)) return [];
      seen.add(key); return [value];
    });
  };

  const categoryRows = (includeDeleted = false) => rows<CategoryRow>(db, `SELECT * FROM categories ${includeDeleted ? '' : 'WHERE deleted_at IS NULL'} ORDER BY created_at, id`);
  const saveCategoryRow = (input: CategoryInput) => {
    const name = input.name.trim();
    if (!name) throw new Error('请输入分类名称');
    const id = input.id ?? randomUUID(); const timestamp = now();
    const keywords = normalizedKeywords(input.keywords);
    const existing = input.id ? row<CategoryRow>(db, 'SELECT * FROM categories WHERE id=?', [input.id]) : null;
    if (existing) db.run('UPDATE categories SET name=?,color=?,keywords_json=?,deleted_at=NULL,updated_at=? WHERE id=?', [name, input.color, JSON.stringify(keywords), timestamp, id]);
    else db.run('INSERT INTO categories (id,name,color,keywords_json,deleted_at,created_at,updated_at) VALUES (?,?,?,?,NULL,?,?)', [id, name, input.color, JSON.stringify(keywords), timestamp, timestamp]);
    return id;
  };

  const resolveTypedCategory = (categoryName: string | null | undefined, itemTitle: string) => {
    const name = categoryName?.trim() ?? '';
    if (!name) return null;
    const normalizedName = name.toLocaleLowerCase();
    const existing = categoryRows().map(mapCategory).find((category) => category.name.trim().toLocaleLowerCase() === normalizedName);
    const learnedTitle = itemTitle.trim();
    const learnedKey = learnedTitle.toLocaleLowerCase();
    const keywords = existing?.keywords ?? [];
    const hasLearnedTitle = !learnedTitle || keywords.some((keyword) => keyword.trim().toLocaleLowerCase() === learnedKey);
    if (existing && hasLearnedTitle) return existing.id;
    const colors = ['#E1F3FE', '#EDF3EC', '#FBF3DB', '#FDEBEC'];
    return saveCategoryRow({
      ...(existing ? { id: existing.id } : {}),
      name: existing?.name ?? name,
      color: existing?.color ?? colors[categoryRows().length % colors.length],
      keywords: hasLearnedTitle ? keywords : [...keywords, learnedTitle]
    });
  };

  const reclassifyAutoItemsAndLogs = () => {
    const available = categoryRows().map(mapCategory);
    for (const item of rows<WorkItemRow>(db, "SELECT * FROM work_items WHERE category_mode!='manual'")) {
      const categoryId = matchCategory(available, item.title);
      db.run("UPDATE work_items SET category_id=?, category_mode='auto' WHERE id=?", [categoryId, item.id]);
      db.run("UPDATE work_logs SET category_id=?, category_mode='auto' WHERE work_item_id=? AND category_mode!='manual'", [categoryId, item.id]);
    }
    db.run("UPDATE work_logs SET category_id=NULL, category_mode='auto' WHERE work_item_id IS NULL AND category_mode!='manual'");
  };

  const workItems = {
    list: (includeDeleted = false) => rows<WorkItemRow>(db, `SELECT * FROM work_items ${includeDeleted ? '' : 'WHERE deleted_at IS NULL'} ORDER BY updated_at DESC, title`).map(mapWorkItem),
    get: (id: string) => { const item = row<WorkItemRow>(db, 'SELECT * FROM work_items WHERE id=?', [id]); return item ? mapWorkItem(item) : null; },
    save: (input: WorkItemInput) => {
      const title = input.title.trim();
      if (!title) throw new Error('请输入事项名称');
      const id = input.id ?? randomUUID(); const timestamp = now();
      const existing = input.id ? row<WorkItemRow>(db, 'SELECT * FROM work_items WHERE id=?', [input.id]) : null;
      const categoryMode = input.categoryMode ?? existing?.category_mode ?? 'auto';
      db.run('BEGIN');
      try {
        let categoryId: string | null;
        if (categoryMode === 'auto') categoryId = matchCategory(categoryRows().map(mapCategory), title);
        else if (input.categoryName !== undefined) categoryId = resolveTypedCategory(input.categoryName, title);
        else if (input.categoryId !== undefined) categoryId = input.categoryId;
        else {
          categoryId = existing?.category_id ?? null;
          const currentCategory = categoryId ? categoryRows().map(mapCategory).find((category) => category.id === categoryId) : null;
          if (currentCategory) categoryId = resolveTypedCategory(currentCategory.name, title);
        }
        if (existing) db.run('UPDATE work_items SET title=?,summary=?,category_id=?,category_mode=?,updated_at=? WHERE id=?', [title, input.summary ?? existing.summary, categoryId, categoryMode, timestamp, id]);
        else db.run(`INSERT INTO work_items (id,title,status,summary,category_id,category_mode,completed_at,deleted_at,created_at,updated_at)
          VALUES (?,?,'active',?,?,?,NULL,NULL,?,?)`, [id, title, input.summary ?? '', categoryId, categoryMode, timestamp, timestamp]);
        if (categoryMode === 'manual') reclassifyAutoItemsAndLogs();
        db.run("UPDATE work_logs SET category_id=?,category_mode='auto' WHERE work_item_id=? AND category_mode!='manual'", [categoryId, id]);
        db.run('COMMIT');
      } catch (error) { db.run('ROLLBACK'); throw error; }
      persist(); return workItems.get(id)!;
    },
    complete: (id: string) => { const timestamp = now(); db.run("UPDATE work_items SET status='completed', completed_at=?, updated_at=? WHERE id=?", [timestamp, timestamp, id]); persist(); return workItems.get(id)!; },
    reopen: (id: string) => { const timestamp = now(); db.run("UPDATE work_items SET status='active', completed_at=NULL, updated_at=? WHERE id=?", [timestamp, id]); persist(); return workItems.get(id)!; },
    softDelete: (id: string) => { const timestamp = now(); db.run('UPDATE work_items SET deleted_at=?, updated_at=? WHERE id=?', [timestamp, timestamp, id]); persist(); },
    restore: (id: string) => { db.run('UPDATE work_items SET deleted_at=NULL, updated_at=? WHERE id=?', [now(), id]); persist(); }
  };

  const categories = {
    list: (includeDeleted = false) => categoryRows(includeDeleted).map(mapCategory),
    get: (id: string) => { const item = row<CategoryRow>(db, 'SELECT * FROM categories WHERE id=?', [id]); return item ? mapCategory(item) : null; },
    save: (input: CategoryInput) => {
      let id = input.id ?? '';
      db.run('BEGIN');
      try {
        id = saveCategoryRow(input);
        reclassifyAutoItemsAndLogs();
        db.run('COMMIT');
      } catch (error) { db.run('ROLLBACK'); throw error; }
      persist(); return categories.get(id)!;
    },
    softDelete: (id: string) => {
      const timestamp = now(); db.run('BEGIN');
      try {
        db.run('UPDATE categories SET deleted_at=?,updated_at=? WHERE id=?', [timestamp, timestamp, id]);
        reclassifyAutoItemsAndLogs();
        db.run('COMMIT');
      } catch (error) { db.run('ROLLBACK'); throw error; }
      persist();
    }
  };

  const itemCategoriesMigrated = row<{ value: string }>(db, "SELECT value FROM meta WHERE key='item_categories_migrated_v4'");
  if (!itemCategoriesMigrated) {
    db.run('BEGIN');
    try {
      reclassifyAutoItemsAndLogs();
      db.run("INSERT INTO meta(key,value) VALUES ('item_categories_migrated_v4','1')");
      db.run('COMMIT');
    } catch (error) { db.run('ROLLBACK'); throw error; }
    persist();
  }

  const itemTitleKeywordsMigrated = row<{ value: string }>(db, "SELECT value FROM meta WHERE key='item_title_keywords_migrated_v5'");
  if (!itemTitleKeywordsMigrated) {
    db.run('BEGIN');
    try {
      const available = categoryRows().map(mapCategory);
      const availableIds = new Set(available.map((category) => category.id));
      const categoryNameRules = available.map((category) => ({ ...category, keywords: [category.name] }));
      const titlesByCategory = new Map(available.map((category) => [category.id, [] as string[]]));
      const manualLogCounts = rows<{ work_item_id: string; category_id: string; count: number }>(db, `
        SELECT work_item_id, category_id, COUNT(*) AS count
        FROM work_logs
        WHERE deleted_at IS NULL AND work_item_id IS NOT NULL AND category_id IS NOT NULL AND category_mode='manual'
        GROUP BY work_item_id, category_id
      `);

      for (const item of rows<WorkItemRow>(db, 'SELECT * FROM work_items WHERE deleted_at IS NULL ORDER BY created_at, id')) {
        let categoryId = item.category_mode === 'manual' && item.category_id && availableIds.has(item.category_id)
          ? item.category_id
          : matchCategory(categoryNameRules, item.title);
        if (!categoryId) {
          categoryId = manualLogCounts
            .filter((entry) => entry.work_item_id === item.id && availableIds.has(entry.category_id))
            .sort((a, b) => b.count - a.count
              || available.findIndex((category) => category.id === a.category_id)
                - available.findIndex((category) => category.id === b.category_id))[0]?.category_id ?? null;
        }
        if (categoryId) titlesByCategory.get(categoryId)?.push(item.title);
      }

      const timestamp = now();
      for (const category of available) {
        const keywords = normalizedKeywords([category.name, ...(titlesByCategory.get(category.id) ?? [])]);
        db.run('UPDATE categories SET keywords_json=?,updated_at=? WHERE id=?', [JSON.stringify(keywords), timestamp, category.id]);
      }
      reclassifyAutoItemsAndLogs();
      db.run("INSERT INTO meta(key,value) VALUES ('item_title_keywords_migrated_v5','1')");
      db.run('COMMIT');
    } catch (error) { db.run('ROLLBACK'); throw error; }
    persist();
  }

  const partialItemKeywordsMigrated = row<{ value: string }>(db, "SELECT value FROM meta WHERE key='partial_item_keywords_migrated_v6'");
  if (!partialItemKeywordsMigrated) {
    db.run('BEGIN');
    try {
      reclassifyAutoItemsAndLogs();
      db.run("INSERT INTO meta(key,value) VALUES ('partial_item_keywords_migrated_v6','1')");
      db.run('COMMIT');
    } catch (error) { db.run('ROLLBACK'); throw error; }
    persist();
  }

  const workLogs = {
    list: (includeDeleted = false) => rows<WorkLogRow>(db, `SELECT * FROM work_logs ${includeDeleted ? '' : 'WHERE deleted_at IS NULL'} ORDER BY period_start DESC, created_at DESC`).map(mapWorkLog),
    get: (id: string) => { const item = row<WorkLogRow>(db, 'SELECT * FROM work_logs WHERE id=?', [id]); return item ? mapWorkLog(item) : null; },
    save: (input: WorkLogInput) => {
      const content = input.content.trim();
      if (!content) throw new Error('请输入工作内容');
      if (input.effortMinutes != null && (input.effortMinutes < 0 || input.effortMinutes > 1440)) throw new Error('单条记录不能超过 24 小时');
      const id = input.id ?? randomUUID(); const timestamp = now();
      const existing = input.id ? row<WorkLogRow>(db, 'SELECT * FROM work_logs WHERE id=?', [input.id]) : null;
      if (input.workItemId && workItems.get(input.workItemId)?.status === 'completed' && existing?.work_item_id !== input.workItemId) throw new Error('请先重新打开事项');
      const categoryMode = input.categoryMode ?? existing?.category_mode ?? 'auto';
      const categoryId = categoryMode === 'manual'
        ? input.categoryName !== undefined ? resolveTypedCategory(input.categoryName, '') : input.categoryId ?? null
        : input.workItemId ? workItems.get(input.workItemId)?.categoryId ?? null : null;
      const occurredAt = input.occurredAt ?? existing?.occurred_at ?? timestamp;
      const effortMinutes = input.effortMinutes === undefined ? existing?.effort_minutes ?? null : input.effortMinutes;
      if (existing) db.run('UPDATE work_logs SET work_item_id=?,content=?,effort_minutes=?,period_kind=?,period_start=?,occurred_at=?,category_id=?,category_mode=?,updated_at=? WHERE id=?', [input.workItemId ?? null, content, effortMinutes, input.periodKind, input.periodStart, occurredAt, categoryId, categoryMode, timestamp, id]);
      else db.run(`INSERT INTO work_logs (id,work_item_id,content,effort_minutes,period_kind,period_start,occurred_at,category_id,category_mode,deleted_at,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,NULL,?,?)`, [id, input.workItemId ?? null, content, effortMinutes, input.periodKind, input.periodStart, occurredAt, categoryId, categoryMode, timestamp, timestamp]);
      if (input.workItemId) db.run('UPDATE work_items SET summary=?, updated_at=? WHERE id=?', [content, timestamp, input.workItemId]);
      persist(); return workLogs.get(id)!;
    },
    softDelete: (id: string) => { const timestamp = now(); db.run('UPDATE work_logs SET deleted_at=?, updated_at=? WHERE id=?', [timestamp, timestamp, id]); persist(); },
    restore: (id: string) => { db.run('UPDATE work_logs SET deleted_at=NULL, updated_at=? WHERE id=?', [now(), id]); persist(); }
  };

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

  const workLogData = (): WorkLogData => ({
    items: workItems.list(),
    logs: workLogs.list(),
    categories: categories.list(),
    contentOptions: historicalContentOptions(workLogs.list()),
    settings: { theme: settings.get().theme, backupRetention: settings.get().backupRetention }
  });

  return { workItems, workLogs, categories, workLogData, projects, tags, tasks, segments, reviews, settings, recycle, calendar };
}

export type Repositories = ReturnType<typeof createRepositories>;
