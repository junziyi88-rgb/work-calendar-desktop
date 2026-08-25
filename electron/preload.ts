import { contextBridge, ipcRenderer } from 'electron';
import type { WorkCalendarBridge } from '../src/shared/contracts';

const invoke = <T>(channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args) as Promise<T>;

const bridge: WorkCalendarBridge = {
  bootstrap: () => invoke('app:bootstrap'),
  calendar: (query) => invoke('calendar:query', query),
  saveTask: (input) => invoke('task:save', input),
  deleteTask: (id) => invoke('task:delete', id),
  saveSegment: (input) => invoke('segment:save', input),
  stopSegment: (id, end) => invoke('segment:stop', id, end),
  deleteSegment: (id) => invoke('segment:delete', id),
  listProjects: () => invoke('project:list'),
  saveProject: (input) => invoke('project:save', input),
  archiveProject: (id) => invoke('project:archive', id),
  listTags: () => invoke('tag:list'),
  saveTag: (input) => invoke('tag:save', input),
  getReview: (date) => invoke('review:get', date),
  saveReview: (input) => invoke('review:save', input),
  getSettings: () => invoke('settings:get'),
  saveSettings: (input) => invoke('settings:save', input),
  listDeleted: () => invoke('recycle:list'),
  restoreDeleted: (kind, id) => invoke('recycle:restore', kind, id),
  permanentlyDelete: (kind, id) => invoke('recycle:permanent-delete', kind, id),
  createBackup: () => invoke('backup:create'),
  listBackups: () => invoke('backup:list'),
  restoreBackup: (path) => invoke('backup:restore', path),
  exportData: (format) => invoke('export:data', format),
  showFloatingTimer: (show) => invoke('desktop:floating-timer', show),
  showMainWindow: () => invoke('desktop:show-main'),
  quit: () => invoke('desktop:quit'),
  on: (event, callback) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(event, listener);
    return () => ipcRenderer.removeListener(event, listener);
  }
};

contextBridge.exposeInMainWorld('workCalendar', bridge);
