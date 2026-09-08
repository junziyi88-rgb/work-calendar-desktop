import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Clipboard, Download } from 'lucide-react';
import { addDays, dateKey, periodRange } from '../../domain/periods';
import { buildSummary } from '../../domain/summaries';
import { formatEffort } from '../../domain/effort';
import type { SummaryKind, WorkLogData } from '../../shared/contracts';

interface Props { data: WorkLogData; initialAnchor?: string; onExport(format: 'csv'): void | Promise<void> }

export function SummaryPage({ data, initialAnchor = dateKey(new Date()), onExport }: Props) {
  const [kind, setKind] = useState<SummaryKind>('week');
  const [anchor, setAnchor] = useState(initialAnchor);
  const [copied, setCopied] = useState(false);
  const summary = useMemo(() => buildSummary(data, kind, anchor), [data, kind, anchor]);
  const { start } = periodRange(kind, anchor);
  const heading = kind === 'week' ? `本周共 ${formatEffort(summary.totalMinutes)}` : `${Number(start.slice(5, 7))}月共 ${formatEffort(summary.totalMinutes)}`;

  const move = (amount: number) => {
    if (kind === 'week') setAnchor(addDays(anchor, amount * 7));
    else {
      const date = new Date(`${anchor}T12:00:00`);
      date.setMonth(date.getMonth() + amount);
      setAnchor(dateKey(date));
    }
  };
  const copy = async () => { await navigator.clipboard.writeText(summary.copyText); setCopied(true); window.setTimeout(() => setCopied(false), 1600); };

  return <section className="page summary-page">
    <header className="page-intro summary-intro"><div><p className="kicker">自动整理，不重写</p><h1>{heading}</h1><p>{kind === 'week' ? '本周推进、完成事项和投入时间，都来自已经写过的记录。' : '月底直接回看工时分布，复制成 OKR 素材。'}</p></div><div className="summary-actions"><button className="quiet-button" onClick={() => void onExport('csv')}><Download size={16} />导出 CSV</button><button className="record-button" onClick={() => void copy()}>{copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? '已复制' : kind === 'week' ? '复制周总结' : '复制 OKR 素材'}</button></div></header>
    <div className="summary-toolbar"><div className="period-nav"><button aria-label="上一周期" onClick={() => move(-1)}><ChevronLeft size={17} /></button><button className="today-link" onClick={() => setAnchor(dateKey(new Date()))}>本期</button><button aria-label="下一周期" onClick={() => move(1)}><ChevronRight size={17} /></button></div><div className="segmented"><button className={kind === 'week' ? 'active' : ''} onClick={() => setKind('week')}>周总结</button><button className={kind === 'month' ? 'active' : ''} onClick={() => setKind('month')}>月总结</button></div></div>
    <div className="summary-grid"><div className="summary-main"><div className="section-heading"><div><span>WORK STREAMS</span><h2>事项进展</h2></div><span>{summary.groups.length} 项</span></div>{summary.groups.length ? summary.groups.map((group) => <article className="summary-group" key={group.itemId ?? 'other'}><header><h3>{group.itemTitle}</h3><strong>{formatEffort(group.minutes)}</strong></header><ul>{group.logs.map((log) => <li key={log.id}><span>{log.content}</span><small>{log.periodStart}</small></li>)}</ul></article>) : <div className="empty-state"><strong>本期还没有工作记录</strong><p>完成工作后记一句，总结会自动长出来。</p></div>}</div>
      <aside className="summary-aside"><section><span>总工时</span><strong>{formatEffort(summary.totalMinutes)}</strong><small>{summary.groups.reduce((sum, group) => sum + group.logs.length, 0)} 条记录</small></section><section><span>本期完成</span>{summary.completedItems.length ? <ul>{summary.completedItems.map((item) => <li key={item.id}>{item.title}</li>)}</ul> : <p>暂无完成事项</p>}</section><section className={summary.missingEffort.length ? 'needs-attention' : ''}><span>待补工时</span><strong>{summary.missingEffort.length}</strong><small>条记录</small></section></aside>
    </div>
  </section>;
}
