import { useEffect, useState } from 'react';
import { BarChart3, CalendarDays, FolderKanban, RotateCcw, Settings, Sparkles } from 'lucide-react';
import { CalendarPage } from './features/calendar/CalendarPage';
import { ReviewPage } from './features/review/ReviewPage';
import { InsightsPage } from './features/insights/InsightsPage';
import { ProjectsPage } from './features/projects/ProjectsPage';
import { RecyclePage } from './features/recycle/RecyclePage';
import { SettingsPage } from './features/settings/SettingsPage';
import { TimerBar } from './features/timer/TimerBar';
import { SleepReconcileDialog } from './features/timer/SleepReconcileDialog';
import { useAppStore } from './store/useAppStore';

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
  const [quickAddSignal, setQuickAddSignal] = useState(0);
  const [resumeInfo, setResumeInfo] = useState<{ suspendedAt: string; resumedAt: string } | null>(null);
  const { hydrate, settings, loading, error } = useAppStore();
  const active = navigation.find((item) => item.id === page)!;

  useEffect(() => {
    void hydrate();
    const removeChanged = window.workCalendar?.on('data-changed', () => void hydrate());
    const removeQuickAdd = window.workCalendar?.on('quick-add', () => { setPage('calendar'); setQuickAddSignal((value) => value + 1); });
    const removeResume = window.workCalendar?.on('power-resume', (...args) => {
      const value = args[0] as { suspendedAt?: string | null; resumedAt?: string } | undefined;
      void hydrate();
      if (value?.suspendedAt && value.resumedAt && new Date(value.resumedAt).getTime() - new Date(value.suspendedAt).getTime() > 60_000) setResumeInfo({ suspendedAt: value.suspendedAt, resumedAt: value.resumedAt });
    });
    return () => { removeChanged?.(); removeQuickAdd?.(); removeResume?.(); };
  }, [hydrate]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  if (window.location.hash === '#floating') return <TimerBar floating />;

  const content = page === 'calendar' ? <CalendarPage quickAddSignal={quickAddSignal} />
    : page === 'review' ? <ReviewPage /> : page === 'insights' ? <InsightsPage />
      : page === 'projects' ? <ProjectsPage /> : page === 'recycle' ? <RecyclePage /> : <SettingsPage />;

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
          <TimerBar />
        </header>
        {error && <div className="app-error" role="alert">{error}</div>}
        {loading && <div className="loading-line" />}
        {content}
        {resumeInfo && <SleepReconcileDialog info={resumeInfo} onClose={() => setResumeInfo(null)} />}
      </main>
    </div>
  );
}
