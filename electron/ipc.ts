import fs from 'node:fs';
import path from 'node:path';
import { app, dialog, ipcMain, type BrowserWindow } from 'electron';
import { calendarQuerySchema, segmentInputSchema, taskInputSchema } from '../src/shared/schemas';
import { serializeCsv, serializeIcs, serializeJson } from '../src/domain/exports';
import type { AppDatabase } from './database';
import type { Repositories } from './repositories';
import { createBackup, listBackups, restoreBackup } from './backup';

interface IpcDependencies {
  repositories: Repositories;
  database: AppDatabase;
  databasePath: string;
  backupDirectory: string;
  getMainWindow: () => BrowserWindow | null;
  showFloatingTimer: (show: boolean) => void;
}

export function registerIpc(deps: IpcDependencies) {
  const { repositories: r } = deps;
  const handle = (channel: string, fn: (...args: any[]) => unknown) => ipcMain.handle(channel, (_event, ...args) => fn(...args));
  const changed = () => deps.getMainWindow()?.webContents.send('data-changed');
  const mutate = (fn: (...args: any[]) => unknown) => (...args: any[]) => { const result = fn(...args); changed(); return result; };

  handle('app:bootstrap', () => ({
    data: r.calendar.query({ start: '2000-01-01T00:00:00.000Z', end: '2100-01-01T00:00:00.000Z' }),
    settings: r.settings.get()
  }));
  handle('calendar:query', (input) => r.calendar.query(calendarQuerySchema.parse(input)));
  handle('task:save', mutate((input) => r.tasks.save(taskInputSchema.parse(input))));
  handle('task:delete', mutate((id) => r.recycle.softDelete('task', id)));
  handle('segment:save', mutate((input) => r.segments.save(segmentInputSchema.parse(input))));
  handle('segment:stop', mutate((id, end) => r.segments.stop(id, end)));
  handle('segment:delete', mutate((id) => r.recycle.softDelete('segment', id)));
  handle('project:list', () => r.projects.list());
  handle('project:save', mutate((input) => r.projects.save(input)));
  handle('project:archive', mutate((id) => r.projects.archive(id)));
  handle('tag:list', () => r.tags.list());
  handle('tag:save', mutate((input) => r.tags.save(input)));
  handle('review:get', (date) => r.reviews.get(date));
  handle('review:save', mutate((input) => r.reviews.save(input)));
  handle('settings:get', () => r.settings.get());
  handle('settings:save', mutate((input) => {
    const value = r.settings.save(input);
    app.setLoginItemSettings({ openAtLogin: value.launchAtStartup });
    return value;
  }));
  handle('recycle:list', () => r.recycle.list());
  handle('recycle:restore', mutate((kind, id) => r.recycle.restore(kind, id)));
  handle('recycle:permanent-delete', mutate((kind, id) => r.recycle.permanentlyDelete(kind, id)));
  handle('backup:create', () => { deps.database.flush(); return createBackup(deps.databasePath, deps.backupDirectory, r.settings.get().backupRetention); });
  handle('backup:list', () => listBackups(deps.backupDirectory));
  handle('backup:restore', (backupPath) => {
    deps.database.close(); restoreBackup(backupPath, deps.databasePath, deps.backupDirectory); app.relaunch(); app.exit(0);
  });
  handle('export:data', async (format: 'csv' | 'json' | 'ics') => {
    const data = r.calendar.query({ start: '2000-01-01T00:00:00.000Z', end: '2100-01-01T00:00:00.000Z' });
    const extension = format; const title = format === 'ics' ? '导出计划日历' : '导出工作数据';
    const result = await dialog.showSaveDialog(deps.getMainWindow()!, {
      title, defaultPath: path.join(app.getPath('documents'), `工作日历-${new Date().toISOString().slice(0, 10)}.${extension}`),
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
    });
    if (result.canceled || !result.filePath) return { cancelled: true };
    const content = format === 'csv' ? serializeCsv(data) : format === 'ics' ? serializeIcs(data.tasks) : serializeJson(data, { settings: r.settings.get() });
    const temp = `${result.filePath}.partial`;
    try { fs.writeFileSync(temp, content, 'utf8'); fs.renameSync(temp, result.filePath); }
    catch (error) { if (fs.existsSync(temp)) fs.unlinkSync(temp); throw error; }
    return { cancelled: false, path: result.filePath };
  });
  handle('desktop:floating-timer', (show) => deps.showFloatingTimer(Boolean(show)));
  handle('desktop:show-main', () => { const window = deps.getMainWindow(); window?.show(); window?.focus(); });
  handle('desktop:quit', () => app.quit());
}
