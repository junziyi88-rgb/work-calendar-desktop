export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled';
export type SegmentSource = 'timer' | 'manual';
export type ThemePreference = 'system' | 'light' | 'dark';

export interface Project {
  id: string;
  name: string;
  color: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  projectId: string | null;
  notes: string;
  status: TaskStatus;
  plannedStart: string | null;
  plannedEnd: string | null;
  completedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tagIds: string[];
}

export interface TimeSegment {
  id: string;
  taskId: string;
  start: string;
  end: string | null;
  source: SegmentSource;
  note: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailyReview {
  date: string;
  accomplishments: string;
  blockers: string;
  tomorrowFocus: string;
  targetMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  theme: ThemePreference;
  weekStartsOn: 0 | 1;
  dayStartHour: number;
  dayEndHour: number;
  defaultPlannedMinutes: number;
  allowParallelTimers: boolean;
  privateNotifications: boolean;
  launchAtStartup: boolean;
  globalShortcut: string;
  longTimerMinutes: number;
  backupRetention: number;
  floatingTimer: boolean;
}

export interface CalendarQuery {
  start: string;
  end: string;
  projectIds?: string[];
  tagIds?: string[];
  statuses?: TaskStatus[];
  search?: string;
  includeDeleted?: boolean;
}

export interface CalendarData {
  tasks: Task[];
  segments: TimeSegment[];
  projects: Project[];
  tags: Tag[];
}

export interface TaskInput {
  id?: string;
  title: string;
  projectId?: string | null;
  notes?: string;
  status?: TaskStatus;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  tagIds?: string[];
}

export interface SegmentInput {
  id?: string;
  taskId: string;
  start: string;
  end?: string | null;
  source: SegmentSource;
  note?: string;
}

export interface DeletedItem {
  id: string;
  kind: 'task' | 'segment' | 'project';
  title: string;
  deletedAt: string;
}

export interface BackupInfo {
  path: string;
  name: string;
  createdAt: string;
  size: number;
}

export interface ExportResult {
  cancelled: boolean;
  path?: string;
}

export interface WorkCalendarBridge {
  bootstrap(): Promise<{ data: CalendarData; settings: AppSettings }>;
  calendar(query: CalendarQuery): Promise<CalendarData>;
  saveTask(input: TaskInput): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  saveSegment(input: SegmentInput): Promise<TimeSegment>;
  stopSegment(id: string, end: string): Promise<TimeSegment>;
  deleteSegment(id: string): Promise<void>;
  listProjects(): Promise<Project[]>;
  saveProject(input: Pick<Project, 'name' | 'color'> & { id?: string }): Promise<Project>;
  archiveProject(id: string): Promise<void>;
  listTags(): Promise<Tag[]>;
  saveTag(input: Pick<Tag, 'name' | 'color'> & { id?: string }): Promise<Tag>;
  getReview(date: string): Promise<DailyReview | null>;
  saveReview(input: Partial<DailyReview> & Pick<DailyReview, 'date'>): Promise<DailyReview>;
  getSettings(): Promise<AppSettings>;
  saveSettings(input: Partial<AppSettings>): Promise<AppSettings>;
  listDeleted(): Promise<DeletedItem[]>;
  restoreDeleted(kind: DeletedItem['kind'], id: string): Promise<void>;
  permanentlyDelete(kind: DeletedItem['kind'], id: string): Promise<void>;
  createBackup(): Promise<BackupInfo>;
  listBackups(): Promise<BackupInfo[]>;
  restoreBackup(path: string): Promise<void>;
  exportData(format: 'csv' | 'json' | 'ics'): Promise<ExportResult>;
  showFloatingTimer(show: boolean): Promise<void>;
  showMainWindow(): Promise<void>;
  quit(): Promise<void>;
  on(event: 'data-changed' | 'quick-add' | 'power-resume', callback: (...args: unknown[]) => void): () => void;
}
