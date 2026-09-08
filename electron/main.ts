import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, Menu } from 'electron';
import { openDatabase, type AppDatabase } from './database';
import { createRepositories, type Repositories } from './repositories';
import { createBackup } from './backup';
import { registerIpc } from './ipc';

let mainWindow: BrowserWindow | null = null;
let database: AppDatabase | null = null;
let repositories: Repositories | null = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 820,
    minWidth: 820,
    minHeight: 640,
    backgroundColor: '#f4f1eb',
    title: '工作记录',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.setMenuBarVisibility(false);
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) void mainWindow.loadURL(devUrl);
  else void mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

void app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  const dataDirectory = path.join(app.getPath('userData'), 'data');
  const databasePath = path.join(dataDirectory, 'work-calendar.sqlite');
  const backupDirectory = path.join(app.getPath('userData'), 'backups');
  if (fs.existsSync(databasePath)) createBackup(databasePath, backupDirectory, 30, true);
  database = await openDatabase(databasePath);
  repositories = createRepositories(database);
  database.flush();
  createMainWindow();
  registerIpc({ repositories, database, databasePath, backupDirectory, getMainWindow: () => mainWindow });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => database?.flush());
