import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LogList } from '../../../src/features/records/LogList';
import type { Category, WorkItem, WorkLog } from '../../../src/shared/contracts';

const items: WorkItem[] = [
  { id: 'item-old', title: '已完成事项', categoryId: 'category-1', categoryMode: 'auto', status: 'completed', summary: '', completedAt: '2026-09-09T00:00:00.000Z', deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-09T00:00:00.000Z' },
  { id: 'item-new', title: '当前事项', categoryId: null, categoryMode: 'auto', status: 'active', summary: '', completedAt: null, deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-09T00:00:00.000Z' }
];
const categories: Category[] = [
  { id: 'category-1', name: '内容制作', color: '#EDF3EC', keywords: ['脚本'], deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' }
];
const log: WorkLog = {
  id: 'log-1', workItemId: 'item-old', content: '完成脚本', effortMinutes: 60,
  periodKind: 'day', periodStart: '2026-09-09', occurredAt: new Date(2026, 8, 9, 14, 5).toISOString(),
  categoryId: 'category-1', categoryMode: 'auto', deletedAt: null,
  createdAt: '2026-09-09T06:05:00.000Z', updatedAt: '2026-09-09T06:05:00.000Z'
};

describe('work log editing', () => {
  it('renames the linked item while editing the record', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onSaveItem = vi.fn();
    render(<LogList logs={[log]} items={items} categories={categories} contentOptions={['完成脚本']} onSave={onSave} onSaveItem={onSaveItem} onDelete={vi.fn()} onRestore={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '编辑记录' }));
    expect(screen.getByLabelText('编辑关联事项')).toHaveValue('已完成事项');
    await user.clear(screen.getByLabelText('编辑关联事项'));
    await user.type(screen.getByLabelText('编辑关联事项'), '交付归档事项');
    await user.clear(screen.getByLabelText('编辑工作内容'));
    await user.type(screen.getByLabelText('编辑工作内容'), '整理本月进展');
    expect(screen.queryByLabelText('编辑工时')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('编辑记录到'), 'week');
    await user.clear(screen.getByLabelText('编辑日期'));
    await user.type(screen.getByLabelText('编辑日期'), '2026-09-10');
    await user.clear(screen.getByLabelText('编辑时间'));
    await user.type(screen.getByLabelText('编辑时间'), '09:40');
    expect(screen.queryByLabelText('编辑分类')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    expect(onSaveItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-old', title: '交付归档事项' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      id: 'log-1', workItemId: 'item-old', content: '整理本月进展',
      periodKind: 'week', periodStart: '2026-09-07',
      occurredAt: new Date(2026, 8, 10, 9, 40).toISOString(), categoryMode: 'auto'
    }), undefined);
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('effortMinutes');
  }, 10_000);

  it('relinks to an exact existing item without renaming the original', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onSaveItem = vi.fn();
    render(<LogList logs={[log]} items={items} categories={categories} onSave={onSave} onSaveItem={onSaveItem} onDelete={vi.fn()} onRestore={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '编辑记录' }));
    await user.clear(screen.getByLabelText('编辑关联事项'));
    await user.type(screen.getByLabelText('编辑关联事项'), '当前事项');
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    expect(onSaveItem).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ workItemId: 'item-new' }), undefined);
  });

  it('creates an item title from an unlinked record', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onSaveItem = vi.fn();
    render(<LogList logs={[{ ...log, workItemId: null }]} items={items} categories={categories} onSave={onSave} onSaveItem={onSaveItem} onDelete={vi.fn()} onRestore={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '编辑记录' }));
    await user.type(screen.getByLabelText('编辑关联事项'), '新事项');
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    expect(onSaveItem).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ workItemId: null }), '新事项');
  });

  it('displays the item category even when a legacy record has an override', () => {
    render(<LogList logs={[{ ...log, categoryId: null, categoryMode: 'manual' }]} items={items} categories={categories} onSave={vi.fn()} onSaveItem={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} />);
    expect(screen.getByText('内容制作')).toBeInTheDocument();
  });

  it('does not display saved effort values in record cards', () => {
    render(<LogList logs={[log]} items={items} categories={categories} onSave={vi.fn()} onSaveItem={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} />);
    expect(screen.queryByText('1 小时')).not.toBeInTheDocument();
    expect(screen.queryByText('待补工时')).not.toBeInTheDocument();
  });
});
