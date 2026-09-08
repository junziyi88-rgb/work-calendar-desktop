import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { parseEffort } from '../../domain/effort';
import { weekStart } from '../../domain/periods';
import type { WorkItem, WorkLogInput, WorkLogPeriodKind } from '../../shared/contracts';

interface Props {
  items: WorkItem[];
  initialDate: string;
  initialItemId?: string | null;
  compact?: boolean;
  onSave(input: WorkLogInput, newItemTitle?: string): void | Promise<unknown>;
}

export function QuickEntry({ items, initialDate, initialItemId = null, compact = false, onSave }: Props) {
  const listId = useId();
  const initialItem = items.find((item) => item.id === initialItemId);
  const [itemText, setItemText] = useState(initialItem?.title ?? '');
  const [content, setContent] = useState('');
  const [effort, setEffort] = useState('');
  const [periodKind, setPeriodKind] = useState<WorkLogPeriodKind>('day');
  const [periodDate, setPeriodDate] = useState(initialDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const activeItems = useMemo(() => items.filter((item) => item.status === 'active' && !item.deletedAt), [items]);

  useEffect(() => setPeriodDate(initialDate), [initialDate]);
  useEffect(() => {
    const item = items.find((candidate) => candidate.id === initialItemId);
    if (item) setItemText(item.title);
  }, [initialItemId, items]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      const matchesExisting = activeItems.some((item) => item.title === itemText.trim());
      if (!content.trim() && !effort.trim() && (!itemText.trim() || matchesExisting)) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [activeItems, content, effort, itemText]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim()) { setError('写一句这次完成了什么'); return; }
    setSaving(true); setError('');
    try {
      const effortMinutes = parseEffort(effort);
      const matched = activeItems.find((item) => item.title.trim().toLocaleLowerCase() === itemText.trim().toLocaleLowerCase());
      await onSave({
        content: content.trim(), effortMinutes, periodKind,
        periodStart: periodKind === 'week' ? weekStart(periodDate) : periodDate,
        workItemId: matched?.id ?? null
      }, itemText.trim() && !matched ? itemText.trim() : undefined);
      setContent(''); setEffort('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存失败，请重试');
    } finally { setSaving(false); }
  };

  return <form className={compact ? 'quick-entry compact-entry' : 'quick-entry'} onSubmit={submit}>
    <div className="entry-primary">
      <label className="entry-item-field">
        <span>关联事项</span>
        <input aria-label="关联事项" list={listId} value={itemText} onChange={(event) => setItemText(event.target.value)} placeholder="选择或新建事项（可选）" />
        <datalist id={listId}>{activeItems.map((item) => <option key={item.id} value={item.title} />)}</datalist>
      </label>
      <label className="entry-content-field">
        <span>工作内容</span>
        <input aria-label="工作内容" autoFocus={!compact} value={content} onChange={(event) => setContent(event.target.value)} placeholder="这次做了什么，推进到了哪一步？" />
      </label>
    </div>
    {!compact && activeItems.length > 0 && <div className="recent-items"><span>最近事项</span>{activeItems.slice(0, 5).map((item) => <button type="button" key={item.id} onClick={() => setItemText(item.title)}>{item.title}</button>)}</div>}
    <div className="entry-meta">
      <label><span>工时</span><input aria-label="工时" value={effort} onChange={(event) => setEffort(event.target.value)} placeholder="如 1.5h" /></label>
      <label><span>记录到</span><select aria-label="记录到" value={periodKind} onChange={(event) => setPeriodKind(event.target.value as WorkLogPeriodKind)}><option value="day">某一天</option><option value="week">某一周</option></select></label>
      <label><span>{periodKind === 'day' ? '日期' : '周内日期'}</span><input aria-label="记录日期" type="date" value={periodDate} onChange={(event) => setPeriodDate(event.target.value)} /></label>
      <button className="record-button" type="submit" disabled={saving}>{saving ? '保存中' : '记录'}<ArrowRight size={17} /></button>
    </div>
    {error && <p className="inline-error" role="alert">{error}</p>}
  </form>;
}
