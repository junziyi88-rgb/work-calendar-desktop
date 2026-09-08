export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled';
export type SegmentSource = 'timer' | 'manual';
export type ThemePreference = 'system' | 'light' | 'dark';

export type WorkItemStatus = 'active' | 'completed';
export type WorkLogPeriodKind = 'day' | 'week';
export type SummaryKind = 'week' | 'month';

export interface WorkItem {
  id: string;
  title: string;
  status: WorkItemStatus;
  summary: string;
  completedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkLog {
  id: string;
  workItemId: string | null;
  content: string;
  effortMinutes: number | null;
  periodKind: WorkLogPeriodKind;
  periodStart: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkItemInput {
  id?: string;
  title: string;
  summary?: string;
}

export interface WorkLogInput {
  id?: string;
  workItemId?: string | null;
  content: string;
  effortMinutes?: number | null;
  periodKind: WorkLogPeriodKind;
  periodStart: string;
}

export interface WorkLogSettings {
  theme: ThemePreference;
  backupRetention: number;
}

export interface WorkLogData {
  items: WorkItem[];
  logs: WorkLog[];
  settings: WorkLogSettings;
}

export interface SummaryGroup {
  itemId: string | null;
  itemTitle: string;
  minutes: number;
  logs: WorkLog[];
}

export interface SummaryResult {
  kind: SummaryKind;
  start: string;
  end: string;
  totalMinutes: number;
  groups: SummaryGroup[];
  missingEffort: WorkLog[];
  completedItems: WorkItem[];
  progressedItems: WorkItem[];
  copyText: string;
}

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
  bootstrap(): Promise<WorkLogData>;
  saveWorkItem(input: WorkItemInput): Promise<WorkItem>;
  completeWorkItem(id: string): Promise<WorkItem>;
  reopenWorkItem(id: string): Promise<WorkItem>;
  deleteWorkItem(id: string): Promise<void>;
  restoreWorkItem(id: string): Promise<void>;
  saveWorkLog(input: WorkLogInput): Promise<WorkLog>;
  deleteWorkLog(id: string): Promise<void>;
  restoreWorkLog(id: string): Promise<void>;
  saveSettings(input: Partial<WorkLogSettings>): Promise<WorkLogSettings>;
  createBackup(): Promise<BackupInfo>;
  listBackups(): Promise<BackupInfo[]>;
  restoreBackup(path: string): Promise<void>;
  exportData(format: 'csv' | 'json'): Promise<ExportResult>;
  on(event: 'data-changed', callback: (...args: unknown[]) => void): () => void;
}
