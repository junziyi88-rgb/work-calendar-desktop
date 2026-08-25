import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarCheck2, Clock3, Target } from 'lucide-react';
import { summarizeDay } from '../../domain/statistics';
import { useAppStore } from '../../store/useAppStore';

const today = () => new Date().toLocaleDateString('en-CA');
const minutesText = (minutes: number) => `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`;

export function ReviewPage() {
  const { data, saveReview, saveTask } = useAppStore();
  const [date, setDate] = useState(today());
  const [accomplishments, setAccomplishments] = useState('');
  const [blockers, setBlockers] = useState('');
  const [tomorrowFocus, setTomorrowFocus] = useState('');
  const [targetMinutes, setTargetMinutes] = useState(480);
  const [saved, setSaved] = useState(false);
  const summary = useMemo(() => summarizeDay({ date, ...data, offsetMinutes: -new Date().getTimezoneOffset() }), [date, data]);
  const unfinished = data.tasks.filter((task) => task.status !== 'completed' && task.status !== 'cancelled' && task.plannedStart?.slice(0, 10) === date);

  useEffect(() => {
    void window.workCalendar?.getReview(date).then((review) => {
      setAccomplishments(review?.accomplishments ?? ''); setBlockers(review?.blockers ?? '');
      setTomorrowFocus(review?.tomorrowFocus ?? ''); setTargetMinutes(review?.targetMinutes ?? 480); setSaved(false);
    });
  }, [date]);

  const save = async () => { await saveReview({ date, accomplishments, blockers, tomorrowFocus, targetMinutes }); setSaved(true); };
  const carry = async () => {
    if (!unfinished.length || !window.confirm(`将 ${unfinished.length} 个未完成任务顺延到下一天？`)) return;
    for (const task of unfinished) await saveTask({ ...task, plannedStart: task.plannedStart ? new Date(new Date(task.plannedStart).getTime() + 86_400_000).toISOString() : null, plannedEnd: task.plannedEnd ? new Date(new Date(task.plannedEnd).getTime() + 86_400_000).toISOString() : null });
  };

  return <div className="content-page review-page">
    <div className="page-toolbar"><div><p className="eyebrow">DAY CLOSE</p><h2>把今天收好</h2></div><input className="date-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
    <div className="metric-grid three"><article><Clock3 /><span>实际投入</span><strong>{minutesText(summary.actualMinutes)}</strong><small>计划 {minutesText(summary.plannedMinutes)}</small></article><article><CalendarCheck2 /><span>计划完成率</span><strong>{Math.round(summary.completionRate * 100)}%</strong><small>{unfinished.length} 项尚未完成</small></article><article><Target /><span>目标进度</span><strong>{Math.round(summary.actualMinutes / Math.max(1, targetMinutes) * 100)}%</strong><small>目标 {minutesText(targetMinutes)}</small></article></div>
    <div className="review-grid">
      <section className="panel review-form"><h3>复盘笔记</h3><label className="field"><span>今天完成了什么</span><textarea rows={4} value={accomplishments} onChange={(event) => setAccomplishments(event.target.value)} placeholder="写下真正完成的产出" /></label><label className="field"><span>遇到的问题</span><textarea rows={3} value={blockers} onChange={(event) => setBlockers(event.target.value)} placeholder="阻碍、风险或需要协助的事" /></label><label className="field"><span>明日重点</span><textarea rows={3} value={tomorrowFocus} onChange={(event) => setTomorrowFocus(event.target.value)} placeholder="明天最值得优先推进的一件事" /></label><div className="review-actions"><label>每日目标 <input type="number" min="30" step="30" value={targetMinutes} onChange={(event) => setTargetMinutes(Number(event.target.value))} /> 分钟</label><button className="primary-button" onClick={save}>{saved ? '已保存' : '保存复盘'}</button></div></section>
      <section className="panel"><div className="panel-heading"><h3>时间分布</h3><span>{summary.projectShares.length} 个项目</span></div><div className="distribution-list">{summary.projectShares.length ? summary.projectShares.map((item) => <div key={item.projectId ?? 'none'}><div><span><i style={{ background: item.color }} />{item.name}</span><strong>{minutesText(item.minutes)}</strong></div><b><i style={{ width: `${item.share * 100}%`, background: item.color }} /></b></div>) : <p className="empty-copy">这一天还没有实际时间记录。</p>}</div><div className="carry-card"><div><strong>{unfinished.length} 项计划未完成</strong><span>由你决定是否顺延，应用不会擅自修改。</span></div><button className="secondary-button" disabled={!unfinished.length} onClick={carry}>顺延到明天 <ArrowRight size={14} /></button></div></section>
    </div>
  </div>;
}
