import { useId, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { filterWorkLogs } from '../../domain/categories';
import { addDays, dateKey, formatWeekRange, periodRange, weekStart } from '../../domain/periods';
import type { WorkItemInput, WorkLogData, WorkLogInput } from '../../shared/contracts';
import { QuickEntry } from './QuickEntry';
import { LogList } from './LogList';

interface Props {
  data: WorkLogData;
  initialDate?: string;
  onSaveItem(input: WorkItemInput): void | Promise<unknown>;
  onSaveLog(input: WorkLogInput, newItemTitle?: string): void | Promise<unknown>;
  onDeleteLog(id: string): void | Promise<void>;
  onRestoreLog(id: string): void | Promise<void>;
}

export function RecordPage({ data, initialDate, onSaveItem, onSaveLog, onDeleteLog, onRestoreLog }: Props) {
  const itemSearchListId = useId();
  const contentSearchListId = useId();
  const today = initialDate ?? dateKey(new Date());
  const [selected, setSelected] = useState(today);
  const [scope, setScope] = useState<'day' | 'week'>('day');
  const [filterItem, setFilterItem] = useState('');
  const [filterContent, setFilterContent] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart(selected), index)), [selected]);
  const visibleLogs = useMemo(() => {
    const periodLogs = scope === 'day'
      ? data.logs.filter((log) => log.periodKind === 'day' && log.periodStart === selected)
      : (() => { const { start, end } = periodRange('week', selected); return data.logs.filter((log) => log.periodStart >= start && log.periodStart < end); })();
    return filterWorkLogs(periodLogs, { itemQuery: filterItem || undefined, contentQuery: filterContent || undefined, categoryId: filterCategory || undefined }, data.items);
  }, [data.items, data.logs, filterCategory, filterContent, filterItem, scope, selected]);
  const move = (amount: number) => setSelected(addDays(selected, amount * (scope === 'week' ? 7 : 1)));
  return <section className="page record-page">
    <header className="compact-page-header"><h1>记录</h1></header>
    <QuickEntry items={data.items} categories={data.categories} contentOptions={data.contentOptions} initialDate={selected} onSave={onSaveLog} />
    <div className="period-panel">
      <div className="period-toolbar compact-period-toolbar">
        <div className="period-nav"><button aria-label="上一周期" onClick={() => move(-1)}><ChevronLeft size={17} /></button><button className="today-link" onClick={() => setSelected(today)}>今天</button><button aria-label="下一周期" onClick={() => move(1)}><ChevronRight size={17} /></button><input aria-label="浏览日期" type="date" value={selected} onChange={(event) => setSelected(event.target.value)} /></div>
        <div className="week-strip">
          {weekDays.map((day, index) => {
            return <button key={day} className={selected === day ? 'selected' : ''} onClick={() => { setSelected(day); setScope('day'); }}><span>{['一','二','三','四','五','六','日'][index]}</span><strong>{Number(day.slice(8, 10))}</strong></button>;
          })}
        </div>
        <div className="segmented"><button className={scope === 'day' ? 'active' : ''} onClick={() => setScope('day')}>日</button><button className={scope === 'week' ? 'active' : ''} onClick={() => setScope('week')}>周</button></div>
      </div>
      <div className="filter-row" aria-label="记录筛选">
        <label><span>事项</span><input aria-label="搜索事项" list={itemSearchListId} value={filterItem} onChange={(event) => setFilterItem(event.target.value)} placeholder="搜索事项名称" /><datalist id={itemSearchListId}>{data.items.map((item) => <option key={item.id} value={item.title} />)}</datalist></label>
        <label><span>工作内容</span><input aria-label="搜索工作内容" list={contentSearchListId} value={filterContent} onChange={(event) => setFilterContent(event.target.value)} placeholder="搜索工作内容" /><datalist id={contentSearchListId}>{data.contentOptions.map((content) => <option key={content.toLocaleLowerCase()} value={content} />)}</datalist></label>
        <label><span>分类</span><select aria-label="筛选分类" value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}><option value="">全部分类</option><option value="__none__">未分类</option>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        {(filterItem || filterContent || filterCategory) && <button className="clear-filters" onClick={() => { setFilterItem(''); setFilterContent(''); setFilterCategory(''); }}>清除筛选</button>}
      </div>
      <div className="section-heading"><div><span>{scope === 'day' ? selected.replaceAll('-', '.') : formatWeekRange(selected)}</span><h2>{scope === 'day' ? '当天记录' : '本周进展'}</h2></div><span>{visibleLogs.length} 条</span></div>
      <LogList logs={visibleLogs} items={data.items} categories={data.categories} contentOptions={data.contentOptions} onSave={onSaveLog} onSaveItem={onSaveItem} onDelete={onDeleteLog} onRestore={onRestoreLog} />
    </div>
  </section>;
}
