import { useEffect, useState } from 'react';
import { BookOpenText, Ellipsis, FileText, Layers3 } from 'lucide-react';
import { ItemsPage } from './features/items/ItemsPage';
import { RecordPage } from './features/records/RecordPage';
import { SummaryPage } from './features/summary/SummaryPage';
import { CategoryManager } from './features/categories/CategoryManager';
import { useAppStore } from './store/useAppStore';

type Page = 'records' | 'items' | 'summary';

const navigation = [
  { id: 'records' as const, label: '记录', icon: BookOpenText },
  { id: 'items' as const, label: '事项', icon: Layers3 },
  { id: 'summary' as const, label: '总结', icon: FileText }
];

export function App() {
  const [page, setPage] = useState<Page>('records');
  const [menuOpen, setMenuOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const { data, loading, error, hydrate, saveItem, completeItem, reopenItem, saveLog, deleteLog, restoreLog, saveCategory, deleteCategory, saveSettings, createBackup, exportData } = useAppStore();

  useEffect(() => {
    void hydrate();
    return window.workCalendar?.on('data-changed', () => void hydrate());
  }, [hydrate]);

  useEffect(() => { document.documentElement.dataset.theme = data.settings.theme; }, [data.settings.theme]);

  const content = page === 'records'
    ? <RecordPage data={data} onSaveItem={saveItem} onSaveLog={saveLog} onDeleteLog={deleteLog} onRestoreLog={restoreLog} />
    : page === 'items'
      ? <ItemsPage data={data} onSaveItem={saveItem} onComplete={completeItem} onReopen={reopenItem} onSaveLog={saveLog} onDeleteLog={deleteLog} onRestoreLog={restoreLog} />
      : <SummaryPage data={data} onExport={exportData} />;

  return <div className="work-log-app">
    <header className="app-header">
      <div className="wordmark"><span>工</span><div><strong>工作记录</strong><small>只记做过的事</small></div></div>
      <nav aria-label="主导航">{navigation.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-label={label} aria-current={page === id ? 'page' : undefined} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><Icon size={17} /><span>{label}</span></button>)}</nav>
      <div className="app-menu"><button aria-label="更多操作" className="icon-button" onClick={() => setMenuOpen((value) => !value)}><Ellipsis size={19} /></button>{menuOpen && <div className="overflow-menu"><button onClick={() => { setCategoryOpen(true); setMenuOpen(false); }}>管理分类</button><div className="menu-divider" /><button onClick={() => void createBackup()}>立即备份</button><button onClick={() => void exportData('json')}>导出完整数据</button><button onClick={() => void exportData('csv')}>导出工时 CSV</button><div className="menu-divider" /><label>主题<select aria-label="主题" value={data.settings.theme} onChange={(event) => void saveSettings({ theme: event.target.value as 'system' | 'light' | 'dark' })}><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label></div>}</div>
    </header>
    {error && <div className="app-error" role="alert">{error}</div>}
    {loading && <div className="loading-line" />}
    <main>{content}</main>
    {categoryOpen && <CategoryManager categories={data.categories} onSave={saveCategory} onDelete={deleteCategory} onClose={() => setCategoryOpen(false)} />}
  </div>;
}
