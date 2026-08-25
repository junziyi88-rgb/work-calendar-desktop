import { useMemo } from 'react';
import { Activity, Clock3, Layers3, TrendingUp } from 'lucide-react';
import { summarizeDay } from '../../domain/statistics';
import { useAppStore } from '../../store/useAppStore';

export function InsightsPage() {
  const { data } = useAppStore();
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); const key = date.toLocaleDateString('en-CA'); return { date: key, label: date.toLocaleDateString('zh-CN', { weekday: 'short' }), summary: summarizeDay({ date: key, ...data, offsetMinutes: -date.getTimezoneOffset() }) }; }), [data]);
  const total = days.reduce((sum, day) => sum + day.summary.actualMinutes, 0);
  const completed = data.tasks.filter((task) => task.status === 'completed').length;
  const projectMinutes = new Map<string, { name: string; color: string; minutes: number }>();
  for (const day of days) for (const item of day.summary.projectShares) { const key = item.projectId ?? 'none'; const current = projectMinutes.get(key) ?? { name: item.name, color: item.color, minutes: 0 }; current.minutes += item.minutes; projectMinutes.set(key, current); }
  const maxDay = Math.max(...days.map((day) => day.summary.actualMinutes), 1);
  return <div className="content-page"><div className="page-toolbar"><div><p className="eyebrow">LAST 7 DAYS</p><h2>工作节奏</h2></div><span className="subtle-badge">本地统计 · 不上传数据</span></div>
    <div className="metric-grid four"><article><Clock3 /><span>七日投入</span><strong>{(total / 60).toFixed(1)}h</strong><small>日均 {(total / 7 / 60).toFixed(1)} 小时</small></article><article><Activity /><span>完成任务</span><strong>{completed}</strong><small>累计完成</small></article><article><Layers3 /><span>活跃项目</span><strong>{projectMinutes.size}</strong><small>最近七天</small></article><article><TrendingUp /><span>最长专注</span><strong>{Math.max(...days.map((day) => day.summary.focusMinutes))}m</strong><small>单项累计</small></article></div>
    <div className="insights-grid"><section className="panel"><div className="panel-heading"><h3>每日投入</h3><span>小时</span></div><div className="week-bars">{days.map((day) => <div key={day.date}><div className="bar-track"><i style={{ height: `${Math.max(3, day.summary.actualMinutes / maxDay * 100)}%` }} /><em>{day.summary.actualMinutes ? (day.summary.actualMinutes / 60).toFixed(1) : ''}</em></div><span>{day.label}</span></div>)}</div></section><section className="panel"><div className="panel-heading"><h3>项目占比</h3><span>{(total / 60).toFixed(1)}h</span></div><div className="rank-list">{Array.from(projectMinutes.values()).sort((a, b) => b.minutes - a.minutes).map((item) => <div key={item.name}><i style={{ background: item.color }} /><span>{item.name}</span><b>{(item.minutes / 60).toFixed(1)}h</b><em>{Math.round(item.minutes / Math.max(total, 1) * 100)}%</em></div>)}{!projectMinutes.size && <p className="empty-copy">开始计时后，这里会出现项目分布。</p>}</div></section></div>
  </div>;
}
