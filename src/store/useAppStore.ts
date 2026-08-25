import { create } from 'zustand';
import type { AppSettings, CalendarData, DailyReview, DeletedItem, Project, SegmentInput, Tag, Task, TaskInput, TimeSegment } from '../shared/contracts';

const EMPTY_DATA: CalendarData = { tasks: [], segments: [], projects: [], tags: [] };
const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system', weekStartsOn: 1, dayStartHour: 7, dayEndHour: 22, defaultPlannedMinutes: 60,
  allowParallelTimers: false, privateNotifications: false, launchAtStartup: false,
  globalShortcut: 'CommandOrControl+Shift+Space', longTimerMinutes: 180, backupRetention: 14, floatingTimer: false
};

interface AppState {
  data: CalendarData;
  settings: AppSettings;
  loading: boolean;
  error: string | null;
  hydrate(): Promise<void>;
  saveTask(input: TaskInput): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  saveSegment(input: SegmentInput): Promise<TimeSegment>;
  deleteSegment(id: string): Promise<void>;
  startTimer(taskId: string): Promise<void>;
  stopTimer(segmentId?: string): Promise<void>;
  saveProject(input: { id?: string; name: string; color: string }): Promise<Project>;
  archiveProject(id: string): Promise<void>;
  saveTag(input: { id?: string; name: string; color: string }): Promise<Tag>;
  saveReview(input: Partial<DailyReview> & Pick<DailyReview, 'date'>): Promise<DailyReview>;
  saveSettings(input: Partial<AppSettings>): Promise<void>;
  listDeleted(): Promise<DeletedItem[]>;
}

function bridge() {
  if (!window.workCalendar) throw new Error('桌面服务尚未就绪');
  return window.workCalendar;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请重试';
}

export const useAppStore = create<AppState>((set, get) => ({
  data: EMPTY_DATA,
  settings: DEFAULT_SETTINGS,
  loading: false,
  error: null,
  hydrate: async () => {
    if (!window.workCalendar) return;
    set({ loading: true, error: null });
    try { const result = await bridge().bootstrap(); set({ data: result.data, settings: result.settings, loading: false }); }
    catch (error) { set({ error: message(error), loading: false }); }
  },
  saveTask: async (input) => {
    try { const task = await bridge().saveTask(input); await get().hydrate(); return task; }
    catch (error) { set({ error: message(error) }); throw error; }
  },
  deleteTask: async (id) => { await bridge().deleteTask(id); await get().hydrate(); },
  saveSegment: async (input) => { const segment = await bridge().saveSegment(input); await get().hydrate(); return segment; },
  deleteSegment: async (id) => { await bridge().deleteSegment(id); await get().hydrate(); },
  startTimer: async (taskId) => {
    const active = get().data.segments.filter((segment) => !segment.end && !segment.deletedAt);
    const conflicting = active.find((segment) => segment.taskId !== taskId);
    if (conflicting && !get().settings.allowParallelTimers) {
      const task = get().data.tasks.find((item) => item.id === conflicting.taskId);
      if (!window.confirm(`“${task?.title ?? '当前任务'}”正在计时。停止它并开始新任务吗？`)) return;
      await bridge().stopSegment(conflicting.id, new Date().toISOString());
    }
    if (active.some((segment) => segment.taskId === taskId)) return;
    await bridge().saveSegment({ taskId, start: new Date().toISOString(), end: null, source: 'timer' });
    await get().hydrate();
  },
  stopTimer: async (segmentId) => {
    const active = get().data.segments.find((segment) => !segment.end && (!segmentId || segment.id === segmentId));
    if (!active) return;
    await bridge().stopSegment(active.id, new Date().toISOString()); await get().hydrate();
  },
  saveProject: async (input) => { const value = await bridge().saveProject(input); await get().hydrate(); return value; },
  archiveProject: async (id) => { await bridge().archiveProject(id); await get().hydrate(); },
  saveTag: async (input) => { const value = await bridge().saveTag(input); await get().hydrate(); return value; },
  saveReview: (input) => bridge().saveReview(input),
  saveSettings: async (input) => { const settings = await bridge().saveSettings(input); set({ settings }); },
  listDeleted: () => bridge().listDeleted()
}));
