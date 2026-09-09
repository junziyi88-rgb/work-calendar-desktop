import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LogList } from '../../../src/features/records/LogList';
import type { Category, WorkItem, WorkLog } from '../../../src/shared/contracts';

const items: WorkItem[] = [
  { id: 'item-old', title: '已完成事项', status: 'completed', summary: '', completedAt: '2026-09-09T00:00:00.000Z', deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-09T00:00:00.000Z' },
  { id: 'item-new', title: '当前事项', status: 'active', summary: '', completedAt: null, deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-09T00:00:00.000Z' }
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
  it('edits the linked item, content, date, time, period, effort, and category', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<LogList logs={[log]} items={items} categories={categories} contentOptions={['完成脚本']} onSave={onSave} onDelete={vi.fn()} onRestore={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '编辑记录' }));
    expect(screen.getByLabelText('编辑关联事项')).toHaveDisplayValue('已完成事项');
    await user.selectOptions(screen.getByLabelText('编辑关联事项'), 'item-new');
    await user.clear(screen.getByLabelText('编辑工作内容'));
    await user.type(screen.getByLabelText('编辑工作内容'), '整理本月进展');
    await user.clear(screen.getByLabelText('编辑工时'));
    await user.type(screen.getByLabelText('编辑工时'), '1.5h');
    await user.selectOptions(screen.getByLabelText('编辑记录到'), 'week');
    await user.clear(screen.getByLabelText('编辑日期'));
    await user.type(screen.getByLabelText('编辑日期'), '2026-09-10');
    await user.clear(screen.getByLabelText('编辑时间'));
    await user.type(screen.getByLabelText('编辑时间'), '09:40');
    await user.selectOptions(screen.getByLabelText('编辑分类'), 'manual:__none__');
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      id: 'log-1', workItemId: 'item-new', content: '整理本月进展', effortMinutes: 90,
      periodKind: 'week', periodStart: '2026-09-07',
      occurredAt: new Date(2026, 8, 10, 9, 40).toISOString(), categoryId: null, categoryMode: 'manual'
    }));
  }, 10_000);
});
