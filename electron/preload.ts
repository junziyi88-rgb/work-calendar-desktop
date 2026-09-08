import { contextBridge, ipcRenderer } from 'electron';
import type { WorkCalendarBridge } from '../src/shared/contracts';

const invoke = <T>(channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args) as Promise<T>;

const bridge: WorkCalendarBridge = {
  bootstrap: () => invoke('app:bootstrap'),
  saveWorkItem: (input) => invoke('work-item:save', input),
  completeWorkItem: (id) => invoke('work-item:complete', id),
  reopenWorkItem: (id) => invoke('work-item:reopen', id),
  deleteWorkItem: (id) => invoke('work-item:delete', id),
  restoreWorkItem: (id) => invoke('work-item:restore', id),
  saveWorkLog: (input) => invoke('work-log:save', input),
  deleteWorkLog: (id) => invoke('work-log:delete', id),
  restoreWorkLog: (id) => invoke('work-log:restore', id),
  saveSettings: (input) => invoke('settings:save', input),
  createBackup: () => invoke('backup:create'),
  listBackups: () => invoke('backup:list'),
  restoreBackup: (path) => invoke('backup:restore', path),
  exportData: (format) => invoke('export:data', format),
  on: (event, callback) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(event, listener);
    return () => ipcRenderer.removeListener(event, listener);
  }
};

contextBridge.exposeInMainWorld('workCalendar', bridge);
