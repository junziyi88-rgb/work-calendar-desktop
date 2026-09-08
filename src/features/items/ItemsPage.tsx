import { useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, Plus, RotateCcw } from 'lucide-react';
import { formatEffort } from '../../domain/effort';
import { formatWeekRange, dateKey } from '../../domain/periods';
import type { WorkItemInput, WorkLogData, WorkLogInput } from '../../shared/contracts';
import { QuickEntry } from '../records/QuickEntry';

interface Props {
  data: WorkLogData;
  onSaveItem(input: WorkItemInput): void | Promise<unknown>;
  onComplete(id: string): void | Promise<void>;
  onReopen(id: string): void | Promise<void>;
  onSaveLog(input: WorkLogInput, newItemTitle?: string): void | Promise<unknown>;
  onDeleteLog(id: string): void | Promise<void>;
  onRestoreLog(id: string): void | Promise<void>;
}

export function ItemsPage({ data, onSaveItem, onComplete, onReopen, onSaveLog }: Props) {
  const [filter, setFilter] = useState<'active' | 'completed'>('active');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const items = data.items.filter((item) => item.status === filter && !item.deletedAt);
  const selected = data.items.find((item) => item.id === selectedId) ?? null;
  const logs = useMemo(() => data.logs.filter((log) => log.workItemId === selectedId && !log.deletedAt).sort((a, b) => b.periodStart.localeCompare(a.periodStart) || b.createdAt.localeCompare(a.createdAt)), [data.logs, selectedId]);
  const total = logs.reduce((sum, log) => sum + (log.effortMinutes ?? 0), 0);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!newTitle.trim()) return;
    await onSaveItem({ title: newTitle.trim() });
    setNewTitle('');
  };

  if (selected) return <section className="page item-detail">
    <button className="back-button" onClick={() => setSelectedId(null)}><ArrowLeft size={16} />返回事项</button>
    <header className="detail-header"><div><span className="status-label">{selected.status === 'active' ? '进行中' : '已完成'}</span><h1>{selected.title}</h1><p>{selected.summary ? `当前进展：${selected.summary}` : '还没有进展摘要'}</p></div><div className="detail-actions"><div><strong>累计 {formatEffort(total)}</strong></div>{selected.status === 'active' ? <button className="quiet-button" onClick={() => void onComplete(selected.id)}><CheckCircle2 size={16} />标记完成</button> : <button className="quiet-button" onClick={() => void onReopen(selected.id)}><RotateCcw size={16} />重新打开</button>}</div></header>
    {selected.status === 'active' && <QuickEntry compact items={data.items} initialDate={dateKey(new Date())} initialItemId={selected.id} onSave={onSaveLog} />}
    <div className="timeline-section"><div className="section-heading"><div><span>PROGRESS</span><h2>进展时间线</h2></div><span>{logs.length} 条记录</span></div>
      {logs.length ? <div className="timeline">{logs.map((log) => <article key={log.id}><div className="timeline-date"><strong>{log.periodKind === 'week' ? '周' : log.periodStart.slice(8, 10)}</strong><span>{log.periodKind === 'week' ? formatWeekRange(log.periodStart) : `${Number(log.periodStart.slice(5, 7))}月`}</span></div><div className="timeline-copy"><p>{log.content}</p><span>{log.effortMinutes == null ? '待补工时' : formatEffort(log.effortMinutes)}</span></div></article>)}</div> : <div className="empty-state"><strong>还没有进展</strong><p>在上面追加第一条记录。</p></div>}
    </div>
  </section>;

  return <section className="page items-page">
    <header className="page-intro"><div><p className="kicker">长期事项</p><h1>每条工作都有来路。</h1><p>跨天、跨周推进的工作，都收在同一条时间线上。</p></div></header>
    <form className="new-item-row" onSubmit={create}><Plus size={17} /><input aria-label="新事项名称" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="新建一个长期事项" /><button type="submit">添加</button></form>
    <div className="items-toolbar"><div className="segmented"><button className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>进行中</button><button className={filter === 'completed' ? 'active' : ''} onClick={() => setFilter('completed')}>已完成</button></div><span>{items.length} 个事项</span></div>
    <div className="item-list">{items.map((item) => {
      const itemLogs = data.logs.filter((log) => log.workItemId === item.id && !log.deletedAt);
      const minutes = itemLogs.reduce((sum, log) => sum + (log.effortMinutes ?? 0), 0);
      const first = [...itemLogs].sort((a, b) => a.periodStart.localeCompare(b.periodStart))[0]?.periodStart ?? item.createdAt.slice(0, 10);
      const latest = itemLogs[0]?.periodStart ?? item.updatedAt.slice(0, 10);
      return <button className="item-row" key={item.id} onClick={() => setSelectedId(item.id)} aria-label={`${item.title}，查看进展`}><div className="item-state" /><div><h2>{item.title}</h2><p>最近：{item.summary || '等待第一条进展'}</p></div><div className="item-range"><span>{first} — {latest}</span><strong>{formatEffort(minutes)}</strong></div></button>;
    })}{!items.length && <div className="empty-state"><strong>{filter === 'active' ? '还没有进行中的事项' : '还没有完成的事项'}</strong><p>事项只用来串起长期进展，不需要提前规划。</p></div>}</div>
  </section>;
}
