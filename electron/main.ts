import { app, BrowserWindow, Menu } from 'electron';
import path from 'node:path';
import { openDatabase, type AppDatabase } from './database';
import { createRepositories, type Repositories } from './repositories';
import { createBackup } from './backup';
import { registerIpc } from './ipc';
import { DesktopController } from './desktop';

let mainWindow: BrowserWindow | null = null;
let database: AppDatabase | null = null;
let repositories: Repositories | null = null;
let desktop: DesktopController | null = null;
let isQuitting = false;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 850,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#f5f7fa',
    title: '工作日历',
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
  mainWindow.on('close', (event) => {
    if (!isQuitting) { event.preventDefault(); mainWindow?.hide(); }
  });
}

void app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  const dataDirectory = path.join(app.getPath('userData'), 'data');
  const databasePath = path.join(dataDirectory, 'work-calendar.sqlite');
  const backupDirectory = path.join(app.getPath('userData'), 'backups');
  database = await openDatabase(databasePath);
  repositories = createRepositories(database);
  if (repositories.projects.list(true).length === 0) repositories.projects.save({ name: '日常工作', color: '#3a6fe8' });
  database.flush();
  createBackup(databasePath, backupDirectory, repositories.settings.get().backupRetention, true);
  createMainWindow();
  const rendererPath = path.join(__dirname, '..', '..', 'dist', 'index.html');
  desktop = new DesktopController(() => mainWindow, repositories, path.join(__dirname, 'preload.js'), rendererPath);
  desktop.start();
  registerIpc({ repositories, database, databasePath, backupDirectory, getMainWindow: () => mainWindow, showFloatingTimer: (show) => desktop?.showFloating(show) });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('before-quit', () => { isQuitting = true; desktop?.dispose(); database?.flush(); });
