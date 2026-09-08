import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatEffort } from '../../domain/effort';
import { addDays, dateKey, formatWeekRange, periodRange, weekStart } from '../../domain/periods';
import type { WorkLogData, WorkLogInput } from '../../shared/contracts';
import { QuickEntry } from './QuickEntry';
import { LogList } from './LogList';

interface Props {
  data: WorkLogData;
  onSaveLog(input: WorkLogInput, newItemTitle?: string): void | Promise<unknown>;
  onDeleteLog(id: string): void | Promise<void>;
  onRestoreLog(id: string): void | Promise<void>;
}

export function RecordPage({ data, onSaveLog, onDeleteLog, onRestoreLog }: Props) {
  const today = dateKey(new Date());
  const [selected, setSelected] = useState(today);
  const [scope, setScope] = useState<'day' | 'week'>('day');
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart(selected), index)), [selected]);
  const visibleLogs = useMemo(() => {
    if (scope === 'day') return data.logs.filter((log) => log.periodKind === 'day' && log.periodStart === selected);
    const { start, end } = periodRange('week', selected);
    return data.logs.filter((log) => log.periodStart >= start && log.periodStart < end);
  }, [data.logs, scope, selected]);
  const total = visibleLogs.reduce((sum, log) => sum + (log.effortMinutes ?? 0), 0);

  const move = (amount: number) => setSelected(addDays(selected, amount * (scope === 'week' ? 7 : 1)));
  return <section className="page record-page">
    <header className="page-intro"><div><p className="kicker">轻量工作记录</p><h1>做完了，就记一句。</h1><p>不用计时，也不用整理复杂字段。</p></div><div className="today-total"><span>{scope === 'day' ? '当前日期' : '当前周'}工时</span><strong>{formatEffort(total)}</strong></div></header>
    <QuickEntry items={data.items} initialDate={selected} onSave={onSaveLog} />
    <div className="period-panel">
      <div className="period-toolbar">
        <div className="period-nav"><button aria-label="上一周期" onClick={() => move(-1)}><ChevronLeft size={17} /></button><button className="today-link" onClick={() => setSelected(today)}>今天</button><button aria-label="下一周期" onClick={() => move(1)}><ChevronRight size={17} /></button><input aria-label="浏览日期" type="date" value={selected} onChange={(event) => setSelected(event.target.value)} /></div>
        <div className="segmented"><button className={scope === 'day' ? 'active' : ''} onClick={() => setScope('day')}>日</button><button className={scope === 'week' ? 'active' : ''} onClick={() => setScope('week')}>周</button></div>
      </div>
      <div className="week-strip">
        {weekDays.map((day) => {
          const minutes = data.logs.filter((log) => log.periodKind === 'day' && log.periodStart === day).reduce((sum, log) => sum + (log.effortMinutes ?? 0), 0);
          return <button key={day} className={selected === day ? 'selected' : ''} onClick={() => { setSelected(day); setScope('day'); }}><span>{['一','二','三','四','五','六','日'][weekDays.indexOf(day)]}</span><strong>{Number(day.slice(8, 10))}</strong><small>{minutes ? `${Math.round(minutes / 6) / 10}h` : '—'}</small></button>;
        })}
      </div>
      <div className="section-heading"><div><span>{scope === 'day' ? selected.replaceAll('-', '.') : formatWeekRange(selected)}</span><h2>{scope === 'day' ? '当天记录' : '本周进展'}</h2></div><span>{visibleLogs.length} 条</span></div>
      <LogList logs={visibleLogs} items={data.items} onSave={onSaveLog} onDelete={onDeleteLog} onRestore={onRestoreLog} />
    </div>
  </section>;
}
