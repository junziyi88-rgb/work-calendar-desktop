import fs from 'node:fs';
import path from 'node:path';
import type { BackupInfo } from '../src/shared/contracts';

function info(filePath: string): BackupInfo {
  const stat = fs.statSync(filePath);
  return { path: filePath, name: path.basename(filePath), createdAt: stat.birthtime.toISOString(), size: stat.size };
}

export function listBackups(directory: string) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith('.sqlite'))
    .map((name) => info(path.join(directory, name)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createBackup(databasePath: string, directory: string, retention = 14, dailyOnly = false) {
  fs.mkdirSync(directory, { recursive: true });
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const prefix = dailyOnly ? `work-calendar-${date}-daily` : `work-calendar-${date}-${now.toISOString().slice(11, 19).replaceAll(':', '')}`;
  const existing = dailyOnly ? listBackups(directory).find((item) => item.name.startsWith(prefix)) : null;
  if (existing) return existing;
  const target = path.join(directory, `${prefix}.sqlite`);
  fs.copyFileSync(databasePath, target);
  const backups = listBackups(directory);
  for (const old of backups.slice(Math.max(1, retention))) fs.unlinkSync(old.path);
  return info(target);
}

export function restoreBackup(backupPath: string, databasePath: string, directory: string) {
  if (!fs.existsSync(backupPath)) throw new Error('备份文件不存在');
  if (fs.existsSync(databasePath)) createBackup(databasePath, directory, 100, false);
  fs.copyFileSync(backupPath, databasePath);
}
