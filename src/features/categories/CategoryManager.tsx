import { useState, type FormEvent } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import type { Category, CategoryInput } from '../../shared/contracts';

interface Props {
  categories: Category[];
  onSave(input: CategoryInput): void | Promise<unknown>;
  onDelete(id: string): void | Promise<void>;
  onClose(): void;
}

const COLORS = [
  { value: '#E1F3FE', label: '雾蓝' },
  { value: '#EDF3EC', label: '浅绿' },
  { value: '#FBF3DB', label: '米黄' },
  { value: '#FDEBEC', label: '浅红' }
];

function parseKeywords(value: string) {
  const seen = new Set<string>();
  return value.split(/[,，]/).flatMap((part) => {
    const keyword = part.trim(); const key = keyword.toLocaleLowerCase();
    if (!keyword || seen.has(key)) return [];
    seen.add(key); return [keyword];
  });
}

export function CategoryManager({ categories, onSave, onDelete, onClose }: Props) {
  const [editingId, setEditingId] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#E1F3FE');
  const [keywords, setKeywords] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => { setEditingId(undefined); setName(''); setColor('#E1F3FE'); setKeywords(''); };
  const edit = (category: Category) => { setEditingId(category.id); setName(category.name); setColor(category.color); setKeywords(category.keywords.join('，')); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try { await onSave({ ...(editingId ? { id: editingId } : {}), name: name.trim(), color, keywords: parseKeywords(keywords) }); reset(); }
    finally { setSaving(false); }
  };

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="category-dialog" role="dialog" aria-modal="true" aria-label="分类管理">
      <header><div><span className="kicker">关键词自动匹配</span><h2>分类管理</h2><p>系统会同时识别关联事项和工作内容。</p></div><button className="icon-button" aria-label="关闭分类管理" onClick={onClose}><X size={17} /></button></header>
      <form className="category-form" onSubmit={submit}>
        <label><span>分类名称</span><input aria-label="分类名称" value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：内容制作" /></label>
        <label><span>颜色</span><select aria-label="分类颜色" value={color} onChange={(event) => setColor(event.target.value)}>{COLORS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label>
        <label className="category-keywords"><span>关键词</span><input aria-label="分类关键词" value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="脚本，文案，课程内容" /></label>
        <div className="category-form-actions">{editingId && <button type="button" className="quiet-button" onClick={reset}>取消编辑</button>}<button className="record-button" type="submit" disabled={saving}>{saving ? '保存中' : '保存分类'}</button></div>
      </form>
      <div className="category-list">
        {categories.length ? categories.map((category) => <article key={category.id}>
          <i style={{ backgroundColor: category.color }} /><div><strong>{category.name}</strong><p>{category.keywords.length ? category.keywords.join(' · ') : '尚未设置关键词'}</p></div>
          <button aria-label={`编辑 ${category.name}`} onClick={() => edit(category)}><Pencil size={15} /></button>
          {confirmDelete === category.id ? <button className="confirm-delete" aria-label={`确认删除 ${category.name}`} onClick={() => void onDelete(category.id)}>确认删除</button> : <button aria-label={`删除 ${category.name}`} onClick={() => setConfirmDelete(category.id)}><Trash2 size={15} /></button>}
        </article>) : <div className="empty-state"><strong>还没有分类</strong><p>添加关键词后，新记录会自动归类。</p></div>}
      </div>
    </section>
  </div>;
}
