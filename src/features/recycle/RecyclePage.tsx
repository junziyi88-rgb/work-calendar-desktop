import { useEffect, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import type { DeletedItem } from '../../shared/contracts';
import { useAppStore } from '../../store/useAppStore';

const kindText: Record<DeletedItem['kind'], string> = { task: '任务', segment: '时间记录', project: '项目' };

export function RecyclePage() {
  const { listDeleted, hydrate } = useAppStore();
  const [items, setItems] = useState<DeletedItem[]>([]);
  const load = () => void listDeleted().then(setItems);
  useEffect(load, []);
  return <div className="content-page"><div className="page-toolbar"><div><p className="eyebrow">RECOVERY</p><h2>回收站</h2></div><span className="subtle-badge">删除的数据可以恢复</span></div><section className="panel recycle-panel">{items.length ? <div className="recycle-list">{items.map((item) => <div key={`${item.kind}:${item.id}`}><div><span>{kindText[item.kind]}</span><strong>{item.title}</strong><small>{new Date(item.deletedAt).toLocaleString('zh-CN')}</small></div><div><button className="secondary-button" onClick={async () => { await window.workCalendar?.restoreDeleted(item.kind, item.id); await hydrate(); load(); }}><RotateCcw size={14} />恢复</button><button className="danger-text-button" onClick={async () => { if (!window.confirm('永久删除后无法恢复，确定继续？')) return; await window.workCalendar?.permanentlyDelete(item.kind, item.id); load(); }}><Trash2 size={14} />永久删除</button></div></div>)}</div> : <div className="large-empty"><RotateCcw size={28} /><h3>回收站是空的</h3><p>删除的任务、时间记录和项目会暂存在这里。</p></div>}</section></div>;
}
