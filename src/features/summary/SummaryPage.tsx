import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Clipboard, Download } from 'lucide-react';
import { filterWorkLogs } from '../../domain/categories';
import { addDays, dateKey, formatSummaryPeriod } from '../../domain/periods';
import { buildSummary } from '../../domain/summaries';
import type { SummaryKind, WorkLogData } from '../../shared/contracts';
import { PeriodCalendar } from './PeriodCalendar';

interface Props { data: WorkLogData; initialAnchor?: string; onExport(format: 'csv'): void | Promise<void> }

export function SummaryPage({ data, initialAnchor = dateKey(new Date()), onExport }: Props) {
  const [kind, setKind] = useState<SummaryKind>('week');
  const [anchor, setAnchor] = useState(initialAnchor);
  const [filterItem, setFilterItem] = useState('');
  const [filterContent, setFilterContent] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [copied, setCopied] = useState(false);
  const filteredData = useMemo(() => ({
    ...data,
    items: data.items.filter((item) => (!filterItem || item.id === filterItem)
      && (!filterCategory || (filterCategory === '__none__' ? item.categoryId === null : item.categoryId === filterCategory))),
    logs: filterWorkLogs(data.logs, { workItemId: filterItem || undefined, content: filterContent || undefined, categoryId: filterCategory || undefined }, data.items)
  }), [data, filterCategory, filterContent, filterItem]);
  const summary = useMemo(() => buildSummary(filteredData, kind, anchor), [filteredData, kind, anchor]);

  const move = (amount: number) => {
    if (kind === 'week') setAnchor(addDays(anchor, amount * 7));
    else {
      const [year, month, day] = anchor.split('-').map(Number);
      const date = new Date(year, month - 1 + amount, Math.min(day, 28));
      setAnchor(dateKey(date));
    }
  };
  const copy = async () => { await navigator.clipboard.writeText(summary.copyText); setCopied(true); window.setTimeout(() => setCopied(false), 1600); };
  const reset = () => setAnchor(dateKey(new Date()));

  return <section className="page summary-page">
    <header className="compact-page-header summary-intro"><div><h1>{formatSummaryPeriod(kind, anchor)}</h1><span>{kind === 'week' ? '周总结' : '月总结'}</span></div><div className="summary-actions"><button className="quiet-button" onClick={() => void onExport('csv')}><Download size={16} />导出 CSV</button><button className="record-button" onClick={() => void copy()}>{copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? '已复制' : kind === 'week' ? '复制周总结' : '复制 OKR 素材'}</button></div></header>
    <div className="summary-toolbar"><div className="period-nav"><button aria-label="上一周期" onClick={() => move(-1)}><ChevronLeft size={17} /></button><button className="today-link" onClick={reset}>{kind === 'week' ? '回到本周' : '回到本月'}</button><button aria-label="下一周期" onClick={() => move(1)}><ChevronRight size={17} /></button><input aria-label="总结日期" type="date" value={anchor} onChange={(event) => setAnchor(event.target.value)} /></div><div className="segmented"><button className={kind === 'week' ? 'active' : ''} onClick={() => setKind('week')}>周总结</button><button className={kind === 'month' ? 'active' : ''} onClick={() => setKind('month')}>月总结</button></div></div>
    <div className="summary-period-tools">
      <PeriodCalendar anchor={anchor} kind={kind} onSelect={setAnchor} />
      <div className="summary-filter-card"><span className="filter-title">筛选总结内容</span><label><span>事项</span><select aria-label="总结筛选关联事项" value={filterItem} onChange={(event) => setFilterItem(event.target.value)}><option value="">全部事项</option>{data.items.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label><span>工作内容</span><select aria-label="总结筛选工作内容" value={filterContent} onChange={(event) => setFilterContent(event.target.value)}><option value="">全部内容</option>{data.contentOptions.map((content) => <option key={content.toLocaleLowerCase()} value={content}>{content}</option>)}</select></label><label><span>分类</span><select aria-label="总结筛选分类" value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}><option value="">全部分类</option><option value="__none__">未分类</option>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>{(filterItem || filterContent || filterCategory) && <button className="clear-filters" onClick={() => { setFilterItem(''); setFilterContent(''); setFilterCategory(''); }}>清除筛选</button>}</div>
    </div>
    <div className="summary-grid"><div className="summary-main"><div className="section-heading"><div><span>WORK STREAMS</span><h2>事项进展</h2></div><span>{summary.groups.length} 项</span></div>{summary.groups.length ? summary.groups.map((group) => <article className="summary-group" key={group.itemId ?? 'other'}><header><h3>{group.itemTitle}</h3></header><ul>{group.logs.map((log) => <li key={log.id}><span>{log.content}</span><small>{log.periodStart}</small></li>)}</ul></article>) : <div className="empty-state"><strong>所选时期还没有工作记录</strong><p>完成工作后记一句，总结会自动整理。</p></div>}</div>
      <aside className="summary-aside"><section><span>持续推进</span>{summary.progressedItems.length ? <ul>{summary.progressedItems.map((item) => <li key={item.id}>{item.title}</li>)}</ul> : <p>暂无进行中事项</p>}</section><section><span>本期完成</span>{summary.completedItems.length ? <ul>{summary.completedItems.map((item) => <li key={item.id}>{item.title}</li>)}</ul> : <p>暂无完成事项</p>}</section></aside>
    </div>
  </section>;
}
