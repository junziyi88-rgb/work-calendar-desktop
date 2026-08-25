import { BrowserWindow, Menu, Notification, Tray, globalShortcut, nativeImage, powerMonitor } from 'electron';
import path from 'node:path';
import type { Repositories } from './repositories';
import { notificationCopy, type NotificationKind } from '../src/domain/notifications';

const TRAY_ICON = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAASVJREFUWEftl0EOgjAQRd/AmFtwCy7cuXHpDTyFG3cuwQNYGNu4AEVjSmktLW2ngf+TbprO9P8zQwvefC4PH4CfNMDcBJgk4aoqBLgDMAowCHAIcMrMFN8bgCsAzwFmAIYCjNdPbzkTAIeE1JqIZTYiltdZmLvK8gsEMoei3PxSMWuMVsyxaLuT22FwAJCcuQOG/gC6CLYBgErK3ATYEpWWSLcDZMaW1yCrNzeo0V+EjI8kEQE32O0lIoCeVpHqAoZFpclJLtBfapLnBI/oKqbs3FVgT89KvoFrQz8GJ+RWoLpG2VIYmSnPFt49y6hA1dQC51enbkE5AiOkMmVPJuFbqeSoJMHHDCtyNDpw/cDM4+JfAb/4sP4B/YHWc9r4LlQAAAABJRU5ErkJggg==';

export class DesktopController {
  private tray: Tray | null = null;
  private floatingWindow: BrowserWindow | null = null;
  private reminderTimer: NodeJS.Timeout | null = null;
  private suspendedAt: string | null = null;
  private reminded = new Set<string>();

  constructor(private readonly mainWindow: () => BrowserWindow | null, private readonly repositories: Repositories, private readonly preloadPath: string, private readonly rendererPath: string) {}

  start() {
    const image = nativeImage.createFromBuffer(Buffer.from(TRAY_ICON, 'base64')).resize({ width: 20, height: 20 });
    this.tray = new Tray(image);
    this.tray.setToolTip('工作日历');
    this.refreshTray();
    this.tray.on('double-click', () => this.showMain());

    const shortcut = this.repositories.settings.get().globalShortcut;
    globalShortcut.register(shortcut, () => { this.showMain(); this.mainWindow()?.webContents.send('quick-add'); });
    powerMonitor.on('suspend', () => { this.suspendedAt = new Date().toISOString(); });
    powerMonitor.on('resume', () => {
      this.mainWindow()?.webContents.send('power-resume', { suspendedAt: this.suspendedAt, resumedAt: new Date().toISOString() });
      this.suspendedAt = null;
    });
    this.reminderTimer = setInterval(() => this.checkReminders(), 60_000);
    this.checkReminders();
  }

  refreshTray() {
    const active = this.repositories.segments.list().find((segment) => !segment.end);
    const task = active ? this.repositories.tasks.get(active.taskId) : null;
    this.tray?.setContextMenu(Menu.buildFromTemplate([
      { label: task ? `正在计时 · ${task.title}` : '当前没有计时', enabled: false },
      { type: 'separator' },
      { label: '快速添加', click: () => { this.showMain(); this.mainWindow()?.webContents.send('quick-add'); } },
      active ? { label: '停止计时', click: () => { this.repositories.segments.stop(active.id, new Date().toISOString()); this.mainWindow()?.webContents.send('data-changed'); this.refreshTray(); } } : { label: '打开工作日历', click: () => this.showMain() },
      { label: '悬浮计时器', type: 'checkbox', checked: Boolean(this.floatingWindow), click: (item) => this.showFloating(item.checked) },
      { type: 'separator' },
      { label: '退出', click: () => { this.mainWindow()?.destroy(); process.exit(0); } }
    ]));
  }

  showMain() { const window = this.mainWindow(); window?.show(); window?.focus(); }

  showFloating(show: boolean) {
    if (!show) { this.floatingWindow?.close(); this.floatingWindow = null; this.refreshTray(); return; }
    if (this.floatingWindow) { this.floatingWindow.show(); return; }
    this.floatingWindow = new BrowserWindow({
      width: 340, height: 68, resizable: false, frame: false, transparent: true, alwaysOnTop: true,
      skipTaskbar: true, webPreferences: { preload: this.preloadPath, contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    if (devUrl) void this.floatingWindow.loadURL(`${devUrl}#floating`);
    else void this.floatingWindow.loadFile(this.rendererPath, { hash: 'floating' });
    this.floatingWindow.on('closed', () => { this.floatingWindow = null; this.refreshTray(); });
    this.refreshTray();
  }

  notify(title: string, body: string) { if (Notification.isSupported()) new Notification({ title, body }).show(); }
  private checkReminders() {
    const current = Date.now(); const settings = this.repositories.settings.get();
    const active = this.repositories.segments.list().filter((segment) => !segment.end);
    for (const segment of active) {
      if (current - new Date(segment.start).getTime() >= settings.longTimerMinutes * 60_000) this.remindOnce('long', segment.taskId, `segment:${segment.id}`, settings.privateNotifications);
    }
    for (const task of this.repositories.tasks.list()) {
      if (task.status === 'completed' || task.status === 'cancelled') continue;
      const start = task.plannedStart ? new Date(task.plannedStart).getTime() : 0;
      const end = task.plannedEnd ? new Date(task.plannedEnd).getTime() : 0;
      if (start && start >= current && start - current <= 5 * 60_000) this.remindOnce('upcoming', task.id, `upcoming:${task.id}:${task.plannedStart}`, settings.privateNotifications);
      if (end && end < current && current - end <= 24 * 60 * 60_000) this.remindOnce('overdue', task.id, `overdue:${task.id}:${task.plannedEnd}`, settings.privateNotifications);
    }
  }
  private remindOnce(kind: NotificationKind, taskId: string, key: string, privateMode: boolean) {
    if (this.reminded.has(key)) return;
    const task = this.repositories.tasks.get(taskId); if (!task) return;
    const copy = notificationCopy(kind, task.title, privateMode); this.notify(copy.title, copy.body); this.reminded.add(key);
  }
  dispose() { if (this.reminderTimer) clearInterval(this.reminderTimer); globalShortcut.unregisterAll(); this.tray?.destroy(); this.floatingWindow?.destroy(); }
}
