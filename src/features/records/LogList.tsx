import { useState } from 'react';
import { Check, Pencil, RotateCcw, Trash2, X } from 'lucide-react';
import { formatEffort, parseEffort } from '../../domain/effort';
import { formatWeekRange } from '../../domain/periods';
import type { WorkItem, WorkLog, WorkLogInput } from '../../shared/contracts';

interface Props {
  logs: WorkLog[];
  items: WorkItem[];
  onSave(input: WorkLogInput): void | Promise<unknown>;
  onDelete(id: string): void | Promise<void>;
  onRestore(id: string): void | Promise<void>;
}

export function LogList({ logs, items, onSave, onDelete, onRestore }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [effort, setEffort] = useState('');
  const [undoId, setUndoId] = useState<string | null>(null);
  const itemMap = new Map(items.map((item) => [item.id, item.title]));

  if (!logs.length) return <div className="empty-state"><strong>这里还没有记录</strong><p>做完一件事后，在上面写一句就够了。</p></div>;

  const startEdit = (log: WorkLog) => { setEditing(log.id); setContent(log.content); setEffort(log.effortMinutes == null ? '' : String(log.effortMinutes / 60)); };
  const saveEdit = async (log: WorkLog) => {
    await onSave({ ...log, content: content.trim(), effortMinutes: parseEffort(effort) });
    setEditing(null);
  };
  const remove = async (id: string) => { await onDelete(id); setUndoId(id); };
  const undo = async () => { if (!undoId) return; await onRestore(undoId); setUndoId(null); };

  return <>
    <div className="log-list">
      {logs.map((log) => <article className="log-row" key={log.id}>
        <div className="log-marker" />
        <div className="log-main">
          <div className="log-meta"><span>{log.workItemId ? itemMap.get(log.workItemId) ?? '已删除事项' : '其他工作'}</span><time>{log.periodKind === 'week' ? formatWeekRange(log.periodStart) : log.periodStart.replaceAll('-', '.')}</time></div>
          {editing === log.id ? <div className="inline-editor"><input aria-label="编辑工作内容" value={content} onChange={(event) => setContent(event.target.value)} /><input aria-label="编辑工时" value={effort} onChange={(event) => setEffort(event.target.value)} placeholder="小时" /><button aria-label="保存修改" onClick={() => void saveEdit(log)}><Check size={16} /></button><button aria-label="取消修改" onClick={() => setEditing(null)}><X size={16} /></button></div> : <p>{log.content}</p>}
        </div>
        <div className="log-effort">{log.effortMinutes == null ? <span className="missing-effort">待补工时</span> : <strong>{formatEffort(log.effortMinutes)}</strong>}</div>
        <div className="row-actions"><button aria-label="编辑记录" onClick={() => startEdit(log)}><Pencil size={15} /></button><button aria-label="删除记录" onClick={() => void remove(log.id)}><Trash2 size={15} /></button></div>
      </article>)}
    </div>
    {undoId && <div className="undo-toast"><span>记录已删除</span><button onClick={() => void undo()}><RotateCcw size={14} />撤销</button></div>}
  </>;
}
