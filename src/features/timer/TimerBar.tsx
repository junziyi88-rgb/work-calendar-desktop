import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, Square } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

function formatElapsed(milliseconds: number) {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600); const minutes = Math.floor((total % 3600) / 60); const seconds = total % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export function TimerBar({ floating = false }: { floating?: boolean }) {
  const { data, stopTimer, startTimer } = useAppStore();
  const [now, setNow] = useState(Date.now());
  const active = data.segments.find((segment) => !segment.end && !segment.deletedAt);
  const task = data.tasks.find((item) => item.id === active?.taskId);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const elapsed = useMemo(() => active ? formatElapsed(now - new Date(active.start).getTime()) : '00:00:00', [active, now]);

  if (floating) return <div className="floating-timer" data-active={Boolean(active)}><div className="timer-pulse" /><div className="floating-copy"><strong>{task?.title ?? '尚未开始计时'}</strong><span>{elapsed}</span></div>{active ? <button aria-label="停止计时" onClick={() => stopTimer(active.id)}><Square size={15} fill="currentColor" /></button> : <button aria-label="打开主窗口" onClick={() => window.workCalendar?.showMainWindow()}><Play size={15} fill="currentColor" /></button>}</div>;

  return <div className={active ? 'timer-bar active' : 'timer-bar'}>
    <span className="timer-status-dot" />
    <div><small>{active ? '正在计时' : '计时器空闲'}</small><strong>{task?.title ?? '选择任务后开始'}</strong></div>
    <time>{elapsed}</time>
    {active && <button className="timer-stop" aria-label="停止计时" onClick={() => stopTimer(active.id)}><Square size={13} fill="currentColor" /></button>}
  </div>;
}
