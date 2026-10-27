import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { dateKey, weekStart } from '../../domain/periods';
import { matchCategory } from '../../domain/categories';
import type { Category, WorkItem, WorkLogInput, WorkLogPeriodKind } from '../../shared/contracts';
import { ResizableField } from '../../components/ResizableField';

interface Props {
  items: WorkItem[];
  categories?: Category[];
  contentOptions?: string[];
  initialDate: string;
  initialItemId?: string | null;
  compact?: boolean;
  onSave(input: WorkLogInput, newItemTitle?: string): void | Promise<unknown>;
}

const localTime = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

function occurredAt(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

export function QuickEntry({ items, categories = [], contentOptions = [], initialDate, initialItemId = null, compact = false, onSave }: Props) {
  const itemListId = useId();
  const contentListId = useId();
  const initialItem = items.find((item) => item.id === initialItemId);
  const [itemText, setItemText] = useState(initialItem?.title ?? '');
  const [content, setContent] = useState('');
  const [periodKind, setPeriodKind] = useState<WorkLogPeriodKind>('day');
  const [periodDate, setPeriodDate] = useState(initialDate);
  const [recordTime, setRecordTime] = useState(() => localTime(new Date()));
  const [completeItem, setCompleteItem] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const availableItems = useMemo(() => items.filter((item) => !item.deletedAt), [items]);
  const activeItems = useMemo(() => availableItems.filter((item) => item.status === 'active'), [availableItems]);
  const matchedItem = useMemo(() => availableItems.find((item) => item.title.trim().toLocaleLowerCase() === itemText.trim().toLocaleLowerCase()), [availableItems, itemText]);
  const suggestedCategoryId = useMemo(() => matchedItem ? matchedItem.categoryId : matchCategory(categories, itemText), [categories, itemText, matchedItem]);
  const suggestedCategory = categories.find((category) => category.id === suggestedCategoryId);
  const fieldScope = compact ? 'item-entry' : 'record-entry';

  useEffect(() => setPeriodDate(initialDate), [initialDate]);
  useEffect(() => setCompleteItem(false), [itemText]);
  useEffect(() => {
    const item = items.find((candidate) => candidate.id === initialItemId);
    if (item) setItemText(item.title);
  }, [initialItemId, items]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      const matchesExisting = availableItems.some((item) => item.title.trim().toLocaleLowerCase() === itemText.trim().toLocaleLowerCase());
      if (!content.trim() && (!itemText.trim() || matchesExisting)) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [availableItems, content, itemText]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim()) { setError('写一句这次完成了什么'); return; }
    if (matchedItem?.status === 'completed') { setError('请先重新打开事项，再追加记录'); return; }
    setSaving(true); setError('');
    try {
      await onSave({
        content: content.trim(), periodKind,
        periodStart: periodKind === 'week' ? weekStart(periodDate) : periodDate,
        occurredAt: occurredAt(periodDate, recordTime),
        workItemId: matchedItem?.id ?? null,
        ...(completeItem ? { completeItem: true } : {}),
        categoryId: suggestedCategoryId,
        categoryMode: 'auto'
      }, itemText.trim() && !matchedItem ? itemText.trim() : undefined);
      const current = new Date();
      setContent(''); setPeriodDate(dateKey(current)); setRecordTime(localTime(current)); setCompleteItem(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存失败，请重试');
    } finally { setSaving(false); }
  };

  return <form className={compact ? 'quick-entry compact-entry' : 'quick-entry'} onSubmit={submit}>
    <div className="entry-primary">
      <label className="entry-item-field">
        <span>关联事项</span>
        <ResizableField id={`${fieldScope}-item`} label="关联事项" minHeight={49}><input aria-label="关联事项" readOnly={compact && !!initialItemId} list={itemListId} value={itemText} onChange={(event) => setItemText(event.target.value)} placeholder="选择或新建事项（可选）" /></ResizableField>
        <datalist id={itemListId}>{availableItems.map((item) => <option key={item.id} value={item.title} label={item.status === 'completed' ? `${item.title}（已完成）` : item.title} />)}</datalist>
      </label>
      <label className="entry-content-field">
        <span>工作内容</span>
        <ResizableField id={`${fieldScope}-content`} label="工作内容" minHeight={49}><input aria-label="工作内容" list={contentListId} autoFocus={!compact} value={content} onChange={(event) => setContent(event.target.value)} placeholder="这次做了什么，推进到了哪一步？" /></ResizableField>
        <datalist id={contentListId}>{contentOptions.map((option) => <option key={option.toLocaleLowerCase()} value={option} />)}</datalist>
      </label>
    </div>
    {!compact && activeItems.length > 0 && <div className="recent-items"><span>最近事项</span>{activeItems.slice(0, 5).map((item) => <button type="button" key={item.id} onClick={() => setItemText(item.title)}>{item.title}</button>)}</div>}
    <div className="entry-meta">
      <label><span>记录到</span><select aria-label="记录到" value={periodKind} onChange={(event) => setPeriodKind(event.target.value as WorkLogPeriodKind)}><option value="day">某一天</option><option value="week">某一周</option></select></label>
      <label><span>{periodKind === 'day' ? '日期' : '周内日期'}</span><input aria-label="记录日期" type="date" value={periodDate} onChange={(event) => setPeriodDate(event.target.value)} /></label>
      <label><span>时间</span><input aria-label="记录时间" type="time" value={recordTime} onChange={(event) => setRecordTime(event.target.value)} /></label>
      <label><span>分类（随事项）</span><ResizableField id={`${fieldScope}-category`} label="分类"><input aria-label="分类" readOnly value={suggestedCategory?.name ?? '未分类'} title="在事项详情中修改分类" /></ResizableField></label>
      <button className="record-button" type="submit" disabled={saving}>{saving ? '保存中' : '记录'}<ArrowRight size={17} /></button>
    </div>
    <label className="complete-item-option"><input aria-label="事项已完成" type="checkbox" checked={completeItem} disabled={!itemText.trim() || matchedItem?.status === 'completed' || saving} onChange={(event) => setCompleteItem(event.target.checked)} /><span>事项已完成</span><small>保存记录时同时标记事项完成</small></label>
    {error && <p className="inline-error" role="alert">{error}</p>}
  </form>;
}
