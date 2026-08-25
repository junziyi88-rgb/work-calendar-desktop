import { useMemo, useState, type FormEvent } from 'react';
import { Clock3, Play, Square, Trash2, X } from 'lucide-react';
import type { Project, SegmentInput, Tag, Task, TaskInput, TimeSegment } from '../../shared/contracts';

export interface InitialRange { start: string; end: string }

interface Props {
  task: Task | null;
  initialRange: InitialRange | null;
  projects: Project[];
  tags: Tag[];
  segments: TimeSegment[];
  recordActual?: boolean;
  onSave(input: TaskInput): void | Promise<unknown>;
  onDelete(id: string): void | Promise<void>;
  onClose(): void;
  onStartTimer(taskId: string): void | Promise<void>;
  onStopTimer(segmentId: string): void | Promise<void>;
  onSaveSegment(input: SegmentInput): void | Promise<unknown>;
}

export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const date = new Date(iso); const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIso(value: string) { return value ? new Date(value).toISOString() : null; }

export function TaskEditor({ task, initialRange, projects, tags, segments, recordActual = false, onSave, onDelete, onClose, onStartTimer, onStopTimer, onSaveSegment }: Props) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [projectId, setProjectId] = useState(task?.projectId ?? projects[0]?.id ?? '');
  const [status, setStatus] = useState<Task['status']>(task?.status ?? 'todo');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [plannedStart, setPlannedStart] = useState(toLocalInput(task?.plannedStart ?? initialRange?.start));
  const [plannedEnd, setPlannedEnd] = useState(toLocalInput(task?.plannedEnd ?? initialRange?.end));
  const [tagIds, setTagIds] = useState(task?.tagIds ?? []);
  const [error, setError] = useState('');
  const [manualStart, setManualStart] = useState(toLocalInput(new Date().toISOString()));
  const [manualEnd, setManualEnd] = useState(toLocalInput(new Date(Date.now() + 30 * 60_000).toISOString()));
  const [saving, setSaving] = useState(false);
  const taskSegments = useMemo(() => segments.filter((item) => item.taskId === task?.id && !item.deletedAt), [segments, task?.id]);
  const active = taskSegments.find((item) => !item.end);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) { setError('请输入任务标题'); return; }
    const start = toIso(plannedStart); const end = toIso(plannedEnd);
    if (start && end && new Date(end) <= new Date(start)) { setError('结束时间必须晚于开始时间'); return; }
    setSaving(true); setError('');
    try {
      const saved = await onSave({ id: task?.id, title: title.trim(), projectId: projectId || null, status: recordActual ? 'in_progress' : status, notes, plannedStart: recordActual ? null : start, plannedEnd: recordActual ? null : end, tagIds });
      if (recordActual && !task && initialRange && saved && typeof saved === 'object' && 'id' in saved) await onSaveSegment({ taskId: String(saved.id), start: initialRange.start, end: initialRange.end, source: 'manual' });
      onClose();
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : '保存失败，请重试'); }
    finally { setSaving(false); }
  };

  const addManual = async () => {
    if (!task) return;
    const start = toIso(manualStart); const end = toIso(manualEnd);
    if (!start || !end || new Date(end) <= new Date(start)) { setError('手动记录的结束时间必须晚于开始时间'); return; }
    await onSaveSegment({ taskId: task.id, start, end, source: 'manual' });
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="task-editor" role="dialog" aria-modal="true" aria-labelledby="task-editor-title">
        <header className="editor-header">
          <div><p className="eyebrow">{task ? 'EDIT WORK' : recordActual ? 'LOG WORK' : 'PLAN WORK'}</p><h2 id="task-editor-title">{task ? '编辑任务' : recordActual ? '补记实际工作' : '添加计划'}</h2></div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}><X size={18} /></button>
        </header>
        <form onSubmit={submit}>
          <label className="field span-2"><span>任务标题</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="这段时间准备做什么？" /></label>
          <label className="field"><span>项目</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">未分类</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label className="field"><span>状态</span><select value={recordActual ? 'in_progress' : status} disabled={recordActual} onChange={(event) => setStatus(event.target.value as Task['status'])}><option value="todo">待办</option><option value="in_progress">进行中</option><option value="completed">已完成</option><option value="cancelled">已取消</option></select></label>
          <label className="field"><span>{recordActual ? '实际开始' : '计划开始'}</span><input type="datetime-local" value={plannedStart} onChange={(event) => setPlannedStart(event.target.value)} /></label>
          <label className="field"><span>{recordActual ? '实际结束' : '计划结束'}</span><input type="datetime-local" value={plannedEnd} onChange={(event) => setPlannedEnd(event.target.value)} /></label>
          <label className="field span-2"><span>备注</span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="背景、产出或需要记住的细节" /></label>
          {tags.length > 0 && <fieldset className="tag-picker span-2"><legend>标签</legend>{tags.map((tag) => <label key={tag.id}><input type="checkbox" checked={tagIds.includes(tag.id)} onChange={() => setTagIds((current) => current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id])} /><span style={{ '--tag-color': tag.color } as React.CSSProperties}>{tag.name}</span></label>)}</fieldset>}

          {task && <section className="time-records span-2">
            <div className="section-title"><div><Clock3 size={16} /><strong>实际时间</strong></div><span>{taskSegments.length} 段记录</span></div>
            <div className="segment-list">{taskSegments.length ? taskSegments.map((segment) => <div key={segment.id} className="segment-row"><span>{toLocalInput(segment.start).replace('T', ' ')}</span><span>→</span><span>{segment.end ? toLocalInput(segment.end).replace('T', ' ') : '正在计时'}</span><em>{segment.source === 'timer' ? '自动' : '手动'}</em></div>) : <p className="muted-copy">还没有实际工作记录。</p>}</div>
            <div className="manual-row"><input aria-label="手动开始时间" type="datetime-local" value={manualStart} onChange={(event) => setManualStart(event.target.value)} /><input aria-label="手动结束时间" type="datetime-local" value={manualEnd} onChange={(event) => setManualEnd(event.target.value)} /><button className="secondary-button" type="button" onClick={addManual}>补记时间</button></div>
          </section>}

          {error && <p className="form-error span-2" role="alert">{error}</p>}
          <footer className="editor-actions span-2">
            <div>{task && <><button className="danger-text-button" type="button" onClick={() => window.confirm('将任务移到回收站？') && onDelete(task.id)}><Trash2 size={15} />删除</button>{active ? <button className="secondary-button" type="button" onClick={() => onStopTimer(active.id)}><Square size={14} fill="currentColor" />停止计时</button> : <button className="secondary-button" type="button" onClick={() => onStartTimer(task.id)}><Play size={14} fill="currentColor" />开始计时</button>}</>}</div>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? '保存中…' : recordActual ? '保存记录' : '保存任务'}</button>
          </footer>
        </form>
      </div>
    </div>
  );
}
