import { useId, useMemo, useState } from 'react';
import { Check, Pencil, RotateCcw, Trash2, X } from 'lucide-react';
import { matchCategory } from '../../domain/categories';
import { dateKey, formatWeekRange, weekStart } from '../../domain/periods';
import type { Category, WorkItem, WorkItemInput, WorkLog, WorkLogInput, WorkLogPeriodKind } from '../../shared/contracts';
import { ResizableField } from '../../components/ResizableField';

interface Props {
  logs: WorkLog[];
  items: WorkItem[];
  categories?: Category[];
  contentOptions?: string[];
  onSave(input: WorkLogInput, newItemTitle?: string): void | Promise<unknown>;
  onSaveItem(input: WorkItemInput): void | Promise<unknown>;
  onDelete(id: string): void | Promise<void>;
  onRestore(id: string): void | Promise<void>;
}

interface EditDraft {
  id: string;
  itemText: string;
  content: string;
  periodKind: WorkLogPeriodKind;
  date: string;
  time: string;
  categoryName: string;
  categoryMode: 'auto' | 'manual';
}

const localTime = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
const toIso = (date: string, time: string) => {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute).toISOString();
};

export function LogList({ logs, items, categories = [], contentOptions = [], onSave, onSaveItem, onDelete, onRestore }: Props) {
  const contentListId = useId();
  const categoryListId = useId();
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [editError, setEditError] = useState('');
  const [undoId, setUndoId] = useState<string | null>(null);
  const itemMap = new Map(items.map((item) => [item.id, item.title]));
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const availableItems = useMemo(() => items.filter((item) => !item.deletedAt), [items]);

  if (!logs.length) return <div className="empty-state"><strong>这里还没有记录</strong><p>做完一件事后，在上面写一句就够了。</p></div>;

  const startEdit = (log: WorkLog) => {
    const occurred = new Date(log.occurredAt);
    setDraft({
      id: log.id, itemText: log.workItemId ? itemMap.get(log.workItemId) ?? '' : '', content: log.content,
      periodKind: log.periodKind,
      date: log.periodKind === 'day' ? log.periodStart : dateKey(occurred), time: localTime(occurred),
      categoryName: log.categoryId ? categoryMap.get(log.categoryId)?.name ?? '' : '',
      categoryMode: log.categoryMode
    });
    setEditError('');
  };
  const saveEdit = async (log: WorkLog) => {
    if (!draft?.content.trim()) return;
    const itemTitle = draft.itemText.trim();
    const normalizedTitle = itemTitle.toLocaleLowerCase();
    const exactItem = availableItems.find((item) => item.title.trim().toLocaleLowerCase() === normalizedTitle);
    let workItemId = exactItem?.id ?? null;
    let newItemTitle: string | undefined;
    setEditError('');
    try {
      if (!exactItem && log.workItemId && itemTitle) {
        await onSaveItem({ id: log.workItemId, title: itemTitle });
        workItemId = log.workItemId;
      } else if (!exactItem && !log.workItemId && itemTitle) newItemTitle = itemTitle;
      await onSave({
        id: log.id, workItemId, content: draft.content.trim(),
        periodKind: draft.periodKind,
        periodStart: draft.periodKind === 'week' ? weekStart(draft.date) : draft.date,
        occurredAt: toIso(draft.date, draft.time),
        categoryId: draft.categoryMode === 'auto' ? null : undefined,
        categoryName: draft.categoryMode === 'manual' ? draft.categoryName.trim() || null : undefined,
        categoryMode: draft.categoryMode
      }, newItemTitle);
      setDraft(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : '保存失败，请重试');
    }
  };
  const remove = async (id: string) => { await onDelete(id); setUndoId(id); };
  const undo = async () => { if (!undoId) return; await onRestore(undoId); setUndoId(null); };

  return <>
    <datalist id={contentListId}>{contentOptions.map((content) => <option key={content.toLocaleLowerCase()} value={content} />)}</datalist>
    <div className="log-list three-column-list">
      {logs.map((log) => {
        const editing = draft?.id === log.id;
        const category = log.categoryId ? categoryMap.get(log.categoryId) : null;
        const editItem = editing ? availableItems.find((item) => item.title.trim().toLocaleLowerCase() === draft.itemText.trim().toLocaleLowerCase()) : null;
        const suggestionId = editing ? editItem ? editItem.categoryId : matchCategory(categories, draft.itemText) : null;
        const suggestion = suggestionId ? categoryMap.get(suggestionId) : null;
        return <article className={editing ? 'log-row editing' : 'log-row'} key={log.id}>
          <div className="log-marker" style={category ? { backgroundColor: category.color } : undefined} />
          {editing ? <div className="log-edit-panel">
            <div className="edit-grid">
              <label><span>关联事项</span><ResizableField id="edit-log-item" label="编辑关联事项"><input aria-label="编辑关联事项" list={`${contentListId}-items`} value={draft.itemText} onChange={(event) => setDraft({ ...draft, itemText: event.target.value })} placeholder="选择、新建或重命名事项" /></ResizableField><datalist id={`${contentListId}-items`}>{availableItems.filter((item) => item.status === 'active' || item.id === log.workItemId).map((item) => <option key={item.id} value={item.title} />)}</datalist></label>
              <label className="edit-content"><span>工作内容</span><ResizableField id="edit-log-content" label="编辑工作内容"><input aria-label="编辑工作内容" list={contentListId} value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} /></ResizableField></label>
              <label><span>记录到</span><select aria-label="编辑记录到" value={draft.periodKind} onChange={(event) => setDraft({ ...draft, periodKind: event.target.value as WorkLogPeriodKind })}><option value="day">某一天</option><option value="week">某一周</option></select></label>
              <label><span>日期</span><input aria-label="编辑日期" type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
              <label><span>时间</span><input aria-label="编辑时间" type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} /></label>
              <label><span>分类</span><ResizableField id="edit-log-category" label="编辑分类"><input aria-label="编辑分类" list={categoryListId} maxLength={80} value={draft.categoryMode === 'auto' ? suggestion?.name ?? '' : draft.categoryName} onChange={(event) => setDraft({ ...draft, categoryName: event.target.value, categoryMode: 'manual' })} placeholder="输入分类，或留空" /></ResizableField><datalist id={categoryListId}>{categories.map((entry) => <option key={entry.id} value={entry.name} />)}</datalist></label>
            </div>
            {editError && <p className="inline-error" role="alert">{editError}</p>}
            <div className="edit-actions"><button className="quiet-button" aria-label="取消修改" onClick={() => setDraft(null)}><X size={15} />取消</button><button className="record-button" aria-label="保存修改" onClick={() => void saveEdit(log)}><Check size={15} />保存</button></div>
          </div> : <>
            <div className="log-main">
              <div className="log-meta"><span>{log.workItemId ? itemMap.get(log.workItemId) ?? '已删除事项' : '其他工作'}</span><time>{log.periodKind === 'week' ? formatWeekRange(log.periodStart) : log.periodStart.replaceAll('-', '.')} · {localTime(new Date(log.occurredAt))}</time>{category && <em style={{ backgroundColor: category.color }}>{category.name}</em>}</div>
              <p>{log.content}</p>
            </div>
            <div className="row-actions"><button aria-label="编辑记录" onClick={() => startEdit(log)}><Pencil size={15} /></button><button aria-label="删除记录" onClick={() => void remove(log.id)}><Trash2 size={15} /></button></div>
          </>}
        </article>;
      })}
    </div>
    {undoId && <div className="undo-toast"><span>记录已删除</span><button onClick={() => void undo()}><RotateCcw size={14} />撤销</button></div>}
  </>;
}
