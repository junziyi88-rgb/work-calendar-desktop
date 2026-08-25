import { useEffect, useState } from 'react';
import { DatabaseBackup, Download, FileJson, FileSpreadsheet, Moon, PanelTop, ShieldCheck } from 'lucide-react';
import type { BackupInfo } from '../../shared/contracts';
import { useAppStore } from '../../store/useAppStore';

export function SettingsPage() {
  const { settings, saveSettings } = useAppStore();
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [notice, setNotice] = useState('');
  const loadBackups = () => void window.workCalendar?.listBackups().then(setBackups);
  useEffect(loadBackups, []);
  const exportData = async (format: 'csv' | 'json' | 'ics') => { const result = await window.workCalendar?.exportData(format); if (result && !result.cancelled) setNotice(`已导出到 ${result.path}`); };
  const update = (value: Parameters<typeof saveSettings>[0]) => void saveSettings(value);
  return <div className="content-page settings-page"><div className="page-toolbar"><div><p className="eyebrow">PREFERENCES</p><h2>应用设置</h2></div>{notice && <span className="success-notice">{notice}</span>}</div><div className="settings-grid">
    <section className="panel settings-section"><div className="settings-title"><Moon /><div><h3>外观与日历</h3><p>让日历适应你的工作节奏。</p></div></div><label className="setting-row"><span><strong>主题</strong><small>默认跟随 Windows</small></span><select value={settings.theme} onChange={(event) => update({ theme: event.target.value as typeof settings.theme })}><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label><label className="setting-row"><span><strong>一天开始时间</strong><small>周视图顶部时间</small></span><input type="number" min="0" max="12" value={settings.dayStartHour} onChange={(event) => update({ dayStartHour: Number(event.target.value) })} /></label><label className="setting-row"><span><strong>一天结束时间</strong><small>周视图底部时间</small></span><input type="number" min="13" max="24" value={settings.dayEndHour} onChange={(event) => update({ dayEndHour: Number(event.target.value) })} /></label></section>
    <section className="panel settings-section"><div className="settings-title"><PanelTop /><div><h3>桌面行为</h3><p>计时器在窗口关闭后仍然运行。</p></div></div><Toggle label="开机启动" detail="登录 Windows 后自动打开" checked={settings.launchAtStartup} onChange={(value) => update({ launchAtStartup: value })} /><Toggle label="允许并行计时" detail="默认建议一次只专注一个任务" checked={settings.allowParallelTimers} onChange={(value) => update({ allowParallelTimers: value })} /><Toggle label="悬浮计时器" detail="显示在其他窗口上方" checked={settings.floatingTimer} onChange={(value) => { update({ floatingTimer: value }); void window.workCalendar?.showFloatingTimer(value); }} /><Toggle label="通知隐藏任务标题" detail="在公共场合保护工作内容" checked={settings.privateNotifications} onChange={(value) => update({ privateNotifications: value })} /></section>
    <section className="panel settings-section span-two"><div className="settings-title"><Download /><div><h3>导出与便携</h3><p>所有文件均由本机生成，不经过云端。</p></div></div><div className="export-actions"><button className="secondary-button" onClick={() => exportData('csv')}><FileSpreadsheet size={16} />导出 CSV</button><button className="secondary-button" onClick={() => exportData('json')}><FileJson size={16} />导出 JSON</button><button className="secondary-button" onClick={() => exportData('ics')}><Download size={16} />导出 ICS</button></div></section>
    <section className="panel settings-section span-two"><div className="settings-title"><DatabaseBackup /><div><h3>本地备份</h3><p>每天自动保留一个 SQLite 备份，默认保留 14 份。</p></div></div><div className="backup-toolbar"><button className="primary-button" onClick={async () => { await window.workCalendar?.createBackup(); loadBackups(); setNotice('已创建本地备份'); }}><DatabaseBackup size={15} />立即备份</button><span><ShieldCheck size={14} />{backups.length} 份可用备份</span></div><div className="backup-list">{backups.slice(0, 5).map((backup) => <div key={backup.path}><span>{backup.name}</span><small>{new Date(backup.createdAt).toLocaleString('zh-CN')} · {(backup.size / 1024).toFixed(0)} KB</small><button className="text-button" onClick={() => window.confirm('恢复后应用将重新启动。继续吗？') && window.workCalendar?.restoreBackup(backup.path)}>恢复</button></div>)}</div></section>
  </div></div>;
}

function Toggle({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange(value: boolean): void }) {
  return <label className="setting-row"><span><strong>{label}</strong><small>{detail}</small></span><input className="switch" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>;
}
