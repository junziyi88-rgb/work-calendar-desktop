import { create } from 'zustand';
import type { Category, CategoryInput, WorkItem, WorkItemInput, WorkLog, WorkLogData, WorkLogInput, WorkLogSettings } from '../shared/contracts';

const EMPTY_DATA: WorkLogData = { items: [], logs: [], categories: [], contentOptions: [], settings: { theme: 'system', backupRetention: 14 } };

interface AppState {
  data: WorkLogData;
  loading: boolean;
  error: string | null;
  hydrate(): Promise<void>;
  saveItem(input: WorkItemInput): Promise<WorkItem>;
  completeItem(id: string): Promise<void>;
  reopenItem(id: string): Promise<void>;
  deleteItem(id: string): Promise<void>;
  restoreItem(id: string): Promise<void>;
  saveLog(input: WorkLogInput, newItemTitle?: string): Promise<WorkLog>;
  deleteLog(id: string): Promise<void>;
  restoreLog(id: string): Promise<void>;
  saveCategory(input: CategoryInput): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
  saveSettings(input: Partial<WorkLogSettings>): Promise<void>;
  createBackup(): Promise<void>;
  exportData(format: 'csv' | 'json'): Promise<void>;
}

function bridge() {
  if (!window.workCalendar) throw new Error('桌面服务尚未就绪');
  return window.workCalendar;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请重试';
}

export const useAppStore = create<AppState>((set, get) => ({
  data: EMPTY_DATA,
  loading: false,
  error: null,
  hydrate: async () => {
    if (!window.workCalendar) return;
    set({ loading: true, error: null });
    try { set({ data: await bridge().bootstrap(), loading: false }); }
    catch (error) { set({ error: errorMessage(error), loading: false }); }
  },
  saveItem: async (input) => {
    try { const item = await bridge().saveWorkItem(input); await get().hydrate(); return item; }
    catch (error) { set({ error: errorMessage(error) }); throw error; }
  },
  completeItem: async (id) => { await bridge().completeWorkItem(id); await get().hydrate(); },
  reopenItem: async (id) => { await bridge().reopenWorkItem(id); await get().hydrate(); },
  deleteItem: async (id) => { await bridge().deleteWorkItem(id); await get().hydrate(); },
  restoreItem: async (id) => { await bridge().restoreWorkItem(id); await get().hydrate(); },
  saveLog: async (input, newItemTitle) => {
    try {
      let workItemId = input.workItemId ?? null;
      if (!workItemId && newItemTitle?.trim()) workItemId = (await bridge().saveWorkItem({ title: newItemTitle.trim() })).id;
      const log = await bridge().saveWorkLog({ ...input, workItemId });
      await get().hydrate();
      return log;
    } catch (error) { set({ error: errorMessage(error) }); throw error; }
  },
  deleteLog: async (id) => { await bridge().deleteWorkLog(id); await get().hydrate(); },
  restoreLog: async (id) => { await bridge().restoreWorkLog(id); await get().hydrate(); },
  saveCategory: async (input) => { const category = await bridge().saveCategory(input); await get().hydrate(); return category; },
  deleteCategory: async (id) => { await bridge().deleteCategory(id); await get().hydrate(); },
  saveSettings: async (input) => {
    const settings = await bridge().saveSettings(input);
    set((state) => ({ data: { ...state.data, settings } }));
  },
  createBackup: async () => { await bridge().createBackup(); },
  exportData: async (format) => { await bridge().exportData(format); }
}));
