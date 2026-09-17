import { useId, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, CheckCircle2, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import { ResizableField } from '../../components/ResizableField';
import { matchCategory } from '../../domain/categories';
import { formatEffort } from '../../domain/effort';
import { dateKey, formatWeekRange } from '../../domain/periods';
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
  const categoryListId = useId();
  const [filter, setFilter] = useState<'active' | 'completed'>('active');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [editingItem, setEditingItem] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [categoryIsManual, setCategoryIsManual] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [editError, setEditError] = useState('');
  const items = data.items.filter((item) => item.status === filter && !item.deletedAt);
  const selected = data.items.find((item) => item.id === selectedId) ?? null;
  const categoryMap = new Map(data.categories.map((category) => [category.id, category]));
  const logs = useMemo(() => data.logs.filter((log) => log.workItemId === selectedId && !log.deletedAt).sort((a, b) => b.periodStart.localeCompare(a.periodStart) || b.createdAt.localeCompare(a.createdAt)), [data.logs, selectedId]);
  const total = logs.reduce((sum, log) => sum + (log.effortMinutes ?? 0), 0);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!newTitle.trim()) return;
    await onSaveItem({ title: newTitle.trim() });
    setNewTitle('');
  };

  const startEdit = () => {
    if (!selected) return;
    setEditTitle(selected.title);
    setEditCategory(selected.categoryId ? categoryMap.get(selected.categoryId)?.name ?? '' : '');
    setCategoryIsManual(selected.categoryMode === 'manual');
    setEditError('');
    setEditingItem(true);
  };

  const saveItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !editTitle.trim()) { setEditError('请输入事项名称'); return; }
    setSavingItem(true);
    setEditError('');
    try {
      await onSaveItem({
        id: selected.id,
        title: editTitle.trim(),
        summary: selected.summary,
        categoryName: categoryIsManual ? editCategory.trim() || null : undefined,
        categoryMode: categoryIsManual ? 'manual' : 'auto'
      });
      setEditingItem(false);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : '保存失败，请重试');
    } finally {
      setSavingItem(false);
    }
  };

  if (selected) {
    const selectedCategory = selected.categoryId ? categoryMap.get(selected.categoryId) : null;
    const suggestedCategoryId = matchCategory(data.categories, editTitle);
    const suggestedCategory = suggestedCategoryId ? categoryMap.get(suggestedCategoryId) : null;
    return <section className="page item-detail">
      <button className="back-button" onClick={() => setSelectedId(null)}><ArrowLeft size={16} />返回事项</button>
      <header className="detail-header">
        <div>
          <div className="item-heading-meta"><span className="status-label">{selected.status === 'active' ? '进行中' : '已完成'}</span>{selectedCategory && <em style={{ backgroundColor: selectedCategory.color }}>{selectedCategory.name}</em>}</div>
          <h1>{selected.title}</h1>
          <p>{selected.summary ? `当前进展：${selected.summary}` : '还没有进展摘要'}</p>
        </div>
        <div className="detail-actions">
          <div><strong>累计 {formatEffort(total)}</strong></div>
          <button className="quiet-button" onClick={startEdit}><Pencil size={16} />编辑事项</button>
          {selected.status === 'active'
            ? <button className="quiet-button" onClick={() => void onComplete(selected.id)}><CheckCircle2 size={16} />标记完成</button>
            : <button className="quiet-button" onClick={() => void onReopen(selected.id)}><RotateCcw size={16} />重新打开</button>}
        </div>
      </header>
      {editingItem && <form className="item-edit-form" onSubmit={saveItem}>
        <div className="item-edit-grid">
          <label><span>事项名称</span><ResizableField id="edit-item-title" label="事项名称"><input aria-label="事项名称" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} /></ResizableField></label>
          <label><span>默认分类</span><ResizableField id="edit-item-category" label="事项分类"><input aria-label="事项分类" list={categoryListId} value={categoryIsManual ? editCategory : suggestedCategory?.name ?? ''} onChange={(event) => { setEditCategory(event.target.value); setCategoryIsManual(true); }} placeholder="输入分类，或按事项名称自动匹配" /></ResizableField><datalist id={categoryListId}>{data.categories.map((category) => <option key={category.id} value={category.name} />)}</datalist></label>
        </div>
        {editError && <p className="inline-error" role="alert">{editError}</p>}
        <div className="item-edit-actions"><button type="button" className="quiet-button" onClick={() => setEditingItem(false)}><X size={15} />取消</button><button type="submit" className="record-button" disabled={savingItem}><Check size={15} />{savingItem ? '保存中' : '保存事项'}</button></div>
      </form>}
      {selected.status === 'active' && <QuickEntry compact items={data.items} categories={data.categories} contentOptions={data.contentOptions} initialDate={dateKey(new Date())} initialItemId={selected.id} onSave={onSaveLog} />}
      <div className="timeline-section"><div className="section-heading"><div><span>PROGRESS</span><h2>进展时间线</h2></div><span>{logs.length} 条记录</span></div>
        {logs.length ? <div className="timeline">{logs.map((log) => <article key={log.id}><div className="timeline-date"><strong>{log.periodKind === 'week' ? '周' : log.periodStart.slice(8, 10)}</strong><span>{log.periodKind === 'week' ? formatWeekRange(log.periodStart) : `${Number(log.periodStart.slice(5, 7))}月`}</span></div><div className="timeline-copy"><p>{log.content}</p><span>{log.effortMinutes == null ? '待补工时' : formatEffort(log.effortMinutes)}</span></div></article>)}</div> : <div className="empty-state"><strong>还没有进展</strong><p>在上面追加第一条记录。</p></div>}
      </div>
    </section>;
  }

  return <section className="page items-page">
    <header className="page-intro"><div><p className="kicker">长期事项</p><h1>每条工作都有来路。</h1><p>跨天、跨周推进的工作，都收在同一条时间线上。</p></div></header>
    <form className="new-item-row" onSubmit={create}><Plus size={17} /><ResizableField id="new-item-title" label="新事项名称" minHeight={38}><input aria-label="新事项名称" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="新建一个长期事项" /></ResizableField><button type="submit">添加</button></form>
    <div className="items-toolbar"><div className="segmented"><button className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>进行中</button><button className={filter === 'completed' ? 'active' : ''} onClick={() => setFilter('completed')}>已完成</button></div><span>{items.length} 个事项</span></div>
    <div className="item-list">{items.map((item) => {
      const itemLogs = data.logs.filter((log) => log.workItemId === item.id && !log.deletedAt);
      const minutes = itemLogs.reduce((sum, log) => sum + (log.effortMinutes ?? 0), 0);
      const first = [...itemLogs].sort((a, b) => a.periodStart.localeCompare(b.periodStart))[0]?.periodStart ?? item.createdAt.slice(0, 10);
      const latest = itemLogs[0]?.periodStart ?? item.updatedAt.slice(0, 10);
      const category = item.categoryId ? categoryMap.get(item.categoryId) : null;
      return <button className="item-row" key={item.id} onClick={() => setSelectedId(item.id)} aria-label={`${item.title}，查看进展`}><div className="item-state" /><div><div className="item-title-line"><h2>{item.title}</h2>{category && <em style={{ backgroundColor: category.color }}>{category.name}</em>}</div><p>最近：{item.summary || '等待第一条进展'}</p></div><div className="item-range"><span>{first} — {latest}</span><strong>{formatEffort(minutes)}</strong></div></button>;
    })}{!items.length && <div className="empty-state"><strong>{filter === 'active' ? '还没有进行中的事项' : '还没有完成的事项'}</strong><p>事项只用来串起长期进展，不需要提前规划。</p></div>}</div>
  </section>;
}
