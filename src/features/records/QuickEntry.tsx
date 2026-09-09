import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { parseEffort } from '../../domain/effort';
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
  const categoryListId = useId();
  const initialItem = items.find((item) => item.id === initialItemId);
  const [itemText, setItemText] = useState(initialItem?.title ?? '');
  const [content, setContent] = useState('');
  const [effort, setEffort] = useState('');
  const [periodKind, setPeriodKind] = useState<WorkLogPeriodKind>('day');
  const [periodDate, setPeriodDate] = useState(initialDate);
  const [recordTime, setRecordTime] = useState(() => localTime(new Date()));
  const [categoryText, setCategoryText] = useState('');
  const [categoryIsManual, setCategoryIsManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const activeItems = useMemo(() => items.filter((item) => item.status === 'active' && !item.deletedAt), [items]);
  const matchedItem = useMemo(() => activeItems.find((item) => item.title.trim().toLocaleLowerCase() === itemText.trim().toLocaleLowerCase()), [activeItems, itemText]);
  const suggestedCategoryId = useMemo(() => matchCategory(categories, matchedItem?.title ?? itemText, content), [categories, content, itemText, matchedItem]);
  const suggestedCategory = categories.find((category) => category.id === suggestedCategoryId);
  const fieldScope = compact ? 'item-entry' : 'record-entry';

  useEffect(() => setPeriodDate(initialDate), [initialDate]);
  useEffect(() => {
    const item = items.find((candidate) => candidate.id === initialItemId);
    if (item) setItemText(item.title);
  }, [initialItemId, items]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      const matchesExisting = activeItems.some((item) => item.title === itemText.trim());
      if (!content.trim() && !effort.trim() && !categoryText.trim() && (!itemText.trim() || matchesExisting)) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [activeItems, categoryText, content, effort, itemText]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim()) { setError('写一句这次完成了什么'); return; }
    setSaving(true); setError('');
    try {
      const effortMinutes = parseEffort(effort);
      await onSave({
        content: content.trim(), effortMinutes, periodKind,
        periodStart: periodKind === 'week' ? weekStart(periodDate) : periodDate,
        occurredAt: occurredAt(periodDate, recordTime),
        workItemId: matchedItem?.id ?? null,
        categoryId: categoryIsManual ? null : suggestedCategoryId,
        categoryName: categoryIsManual ? categoryText.trim() || null : undefined,
        categoryMode: categoryIsManual ? 'manual' : 'auto'
      }, itemText.trim() && !matchedItem ? itemText.trim() : undefined);
      const current = new Date();
      setContent(''); setEffort(''); setPeriodDate(dateKey(current)); setRecordTime(localTime(current)); setCategoryText(''); setCategoryIsManual(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存失败，请重试');
    } finally { setSaving(false); }
  };

  return <form className={compact ? 'quick-entry compact-entry' : 'quick-entry'} onSubmit={submit}>
    <div className="entry-primary">
      <label className="entry-item-field">
        <span>关联事项</span>
        <ResizableField id={`${fieldScope}-item`} label="关联事项" minHeight={49}><input aria-label="关联事项" list={itemListId} value={itemText} onChange={(event) => setItemText(event.target.value)} placeholder="选择或新建事项（可选）" /></ResizableField>
        <datalist id={itemListId}>{activeItems.map((item) => <option key={item.id} value={item.title} />)}</datalist>
      </label>
      <label className="entry-content-field">
        <span>工作内容</span>
        <ResizableField id={`${fieldScope}-content`} label="工作内容" minHeight={49}><input aria-label="工作内容" list={contentListId} autoFocus={!compact} value={content} onChange={(event) => setContent(event.target.value)} placeholder="这次做了什么，推进到了哪一步？" /></ResizableField>
        <datalist id={contentListId}>{contentOptions.map((option) => <option key={option.toLocaleLowerCase()} value={option} />)}</datalist>
      </label>
    </div>
    {!compact && activeItems.length > 0 && <div className="recent-items"><span>最近事项</span>{activeItems.slice(0, 5).map((item) => <button type="button" key={item.id} onClick={() => setItemText(item.title)}>{item.title}</button>)}</div>}
    <div className="entry-meta">
      <label><span>工时</span><ResizableField id={`${fieldScope}-effort`} label="工时"><input aria-label="工时" value={effort} onChange={(event) => setEffort(event.target.value)} placeholder="如 1.5h" /></ResizableField></label>
      <label><span>记录到</span><select aria-label="记录到" value={periodKind} onChange={(event) => setPeriodKind(event.target.value as WorkLogPeriodKind)}><option value="day">某一天</option><option value="week">某一周</option></select></label>
      <label><span>{periodKind === 'day' ? '日期' : '周内日期'}</span><input aria-label="记录日期" type="date" value={periodDate} onChange={(event) => setPeriodDate(event.target.value)} /></label>
      <label><span>时间</span><input aria-label="记录时间" type="time" value={recordTime} onChange={(event) => setRecordTime(event.target.value)} /></label>
      <label><span>分类</span><ResizableField id={`${fieldScope}-category`} label="分类"><input aria-label="分类" list={categoryListId} maxLength={80} value={categoryIsManual ? categoryText : suggestedCategory?.name ?? ''} onChange={(event) => { setCategoryText(event.target.value); setCategoryIsManual(true); }} placeholder="输入分类，或等待自动匹配" /></ResizableField><datalist id={categoryListId}>{categories.map((category) => <option key={category.id} value={category.name} />)}</datalist></label>
      <button className="record-button" type="submit" disabled={saving}>{saving ? '保存中' : '记录'}<ArrowRight size={17} /></button>
    </div>
    {error && <p className="inline-error" role="alert">{error}</p>}
  </form>;
}
