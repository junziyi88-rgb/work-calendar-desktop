import { useState } from 'react';
import { BarChart3, CalendarDays, FolderKanban, RotateCcw, Settings, Sparkles } from 'lucide-react';

type Page = 'calendar' | 'review' | 'insights' | 'projects' | 'recycle' | 'settings';

const navigation: Array<{ id: Page; label: string; icon: typeof CalendarDays }> = [
  { id: 'calendar', label: '日历', icon: CalendarDays },
  { id: 'review', label: '复盘', icon: Sparkles },
  { id: 'insights', label: '洞察', icon: BarChart3 },
  { id: 'projects', label: '项目', icon: FolderKanban },
  { id: 'recycle', label: '回收站', icon: RotateCcw },
  { id: 'settings', label: '设置', icon: Settings }
];

export function App() {
  const [page, setPage] = useState<Page>('calendar');
  const active = navigation.find((item) => item.id === page)!;

  return (
    <div className="app-shell">
      <aside className="side-rail" aria-label="主导航">
        <div className="brand-mark" aria-label="工作日历">工</div>
        <nav>
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={page === id ? 'nav-button active' : 'nav-button'}
              aria-label={label}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => setPage(id)}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <main className="main-stage">
        <header className="stage-header">
          <div>
            <p className="eyebrow">WORK CALENDAR</p>
            <h1>{active.label}</h1>
          </div>
        </header>
        <section className="empty-stage" aria-live="polite">
          <CalendarDays size={32} strokeWidth={1.4} />
          <h2>今天，从一段清晰的时间开始</h2>
          <p>在日历上划出时间，添加第一项工作。</p>
        </section>
      </main>
    </div>
  );
}
