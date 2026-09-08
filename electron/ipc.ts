import fs from 'node:fs';
import path from 'node:path';
import { app, dialog, ipcMain, type BrowserWindow } from 'electron';
import { workItemInputSchema, workLogInputSchema } from '../src/shared/schemas';
import { serializeWorkLogCsv, serializeWorkLogJson } from '../src/domain/exports';
import type { AppDatabase } from './database';
import type { Repositories } from './repositories';
import { createBackup, listBackups, restoreBackup } from './backup';

interface IpcDependencies {
  repositories: Repositories;
  database: AppDatabase;
  databasePath: string;
  backupDirectory: string;
  getMainWindow: () => BrowserWindow | null;
}

export function registerIpc(deps: IpcDependencies) {
  const r = deps.repositories;
  const handle = (channel: string, fn: (...args: any[]) => unknown) => ipcMain.handle(channel, (_event, ...args) => fn(...args));
  const changed = () => deps.getMainWindow()?.webContents.send('data-changed');
  const mutate = (fn: (...args: any[]) => unknown) => (...args: any[]) => { const result = fn(...args); changed(); return result; };

  handle('app:bootstrap', () => r.workLogData());
  handle('work-item:save', mutate((input) => r.workItems.save(workItemInputSchema.parse(input))));
  handle('work-item:complete', mutate((id) => r.workItems.complete(String(id))));
  handle('work-item:reopen', mutate((id) => r.workItems.reopen(String(id))));
  handle('work-item:delete', mutate((id) => r.workItems.softDelete(String(id))));
  handle('work-item:restore', mutate((id) => r.workItems.restore(String(id))));
  handle('work-log:save', mutate((input) => r.workLogs.save(workLogInputSchema.parse(input))));
  handle('work-log:delete', mutate((id) => r.workLogs.softDelete(String(id))));
  handle('work-log:restore', mutate((id) => r.workLogs.restore(String(id))));
  handle('settings:save', mutate((input) => {
    const current = r.settings.get();
    const next = r.settings.save({ theme: input?.theme ?? current.theme, backupRetention: input?.backupRetention ?? current.backupRetention });
    return { theme: next.theme, backupRetention: next.backupRetention };
  }));
  handle('backup:create', () => { deps.database.flush(); return createBackup(deps.databasePath, deps.backupDirectory, r.settings.get().backupRetention); });
  handle('backup:list', () => listBackups(deps.backupDirectory));
  handle('backup:restore', (backupPath) => {
    deps.database.close();
    restoreBackup(String(backupPath), deps.databasePath, deps.backupDirectory);
    app.relaunch();
    app.exit(0);
  });
  handle('export:data', async (format: 'csv' | 'json') => {
    const extension = format;
    const result = await dialog.showSaveDialog(deps.getMainWindow()!, {
      title: format === 'csv' ? '导出工时记录' : '备份工作记录',
      defaultPath: path.join(app.getPath('documents'), `工作记录-${new Date().toISOString().slice(0, 10)}.${extension}`),
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
    });
    if (result.canceled || !result.filePath) return { cancelled: true };
    const data = r.workLogData();
    const content = format === 'csv' ? serializeWorkLogCsv(data) : serializeWorkLogJson(data);
    const temp = `${result.filePath}.partial`;
    try {
      fs.writeFileSync(temp, content, 'utf8');
      fs.renameSync(temp, result.filePath);
    } catch (error) {
      if (fs.existsSync(temp)) fs.unlinkSync(temp);
      throw error;
    }
    return { cancelled: false, path: result.filePath };
  });
}
