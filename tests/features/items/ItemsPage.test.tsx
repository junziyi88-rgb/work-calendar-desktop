import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ItemsPage } from '../../../src/features/items/ItemsPage';
import type { WorkLogData } from '../../../src/shared/contracts';

const data: WorkLogData = {
  items: [{ id: 'item-1', title: '桌面工作记录工具', categoryId: 'category-1', categoryMode: 'auto', status: 'active', summary: '重新梳理真实需求', completedAt: null, deletedAt: null, createdAt: '2026-08-25T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' }],
  logs: [{ id: 'log-1', workItemId: 'item-1', content: '重新梳理真实需求', effortMinutes: 1110, periodKind: 'week', periodStart: '2026-09-07', occurredAt: '2026-09-08T00:00:00.000Z', categoryId: 'category-1', categoryMode: 'auto', deletedAt: null, createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' }],
  categories: [
    { id: 'category-1', name: '工具开发', color: '#E1F3FE', keywords: ['工作记录'], deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
    { id: 'category-2', name: '产品开发', color: '#EDF3EC', keywords: ['产品'], deletedAt: null, createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z' }
  ],
  contentOptions: ['重新梳理真实需求'],
  settings: { theme: 'system', backupRetention: 14 }
};

describe('long-running work items', () => {
  it('opens an item and shows its accumulated progress timeline', async () => {
    const user = userEvent.setup();
    render(<ItemsPage data={data} onSaveItem={vi.fn()} onComplete={vi.fn()} onReopen={vi.fn()} onSaveLog={vi.fn()} onDeleteLog={vi.fn()} onRestoreLog={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /桌面工作记录工具/ }));
    expect(screen.getByText('重新梳理真实需求')).toBeInTheDocument();
    expect(screen.getByText('累计 18.5 小时')).toBeInTheDocument();
  });

  it('edits the item name and chooses a manual default category', async () => {
    const user = userEvent.setup();
    const onSaveItem = vi.fn();
    render(<ItemsPage data={data} onSaveItem={onSaveItem} onComplete={vi.fn()} onReopen={vi.fn()} onSaveLog={vi.fn()} onDeleteLog={vi.fn()} onRestoreLog={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /桌面工作记录工具/ }));
    await user.click(screen.getByRole('button', { name: '编辑事项' }));
    await user.clear(screen.getByLabelText('事项名称'));
    await user.type(screen.getByLabelText('事项名称'), '桌面工作记录应用');
    await user.clear(screen.getByLabelText('事项分类'));
    await user.type(screen.getByLabelText('事项分类'), '产品开发');
    await user.click(screen.getByRole('button', { name: '保存事项' }));

    expect(onSaveItem).toHaveBeenCalledWith({
      id: 'item-1', title: '桌面工作记录应用', summary: '重新梳理真实需求',
      categoryName: '产品开发', categoryMode: 'manual'
    });
  });

  it('recomputes an untouched automatic category from the edited item name', async () => {
    const user = userEvent.setup();
    const onSaveItem = vi.fn();
    render(<ItemsPage data={data} onSaveItem={onSaveItem} onComplete={vi.fn()} onReopen={vi.fn()} onSaveLog={vi.fn()} onDeleteLog={vi.fn()} onRestoreLog={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /桌面工作记录工具/ }));
    await user.click(screen.getByRole('button', { name: '编辑事项' }));
    expect(screen.getByLabelText('事项分类')).toHaveValue('工具开发');
    await user.clear(screen.getByLabelText('事项名称'));
    await user.type(screen.getByLabelText('事项名称'), '工作记录应用');
    await user.click(screen.getByRole('button', { name: '保存事项' }));

    expect(onSaveItem).toHaveBeenCalledWith({
      id: 'item-1', title: '工作记录应用', summary: '重新梳理真实需求',
      categoryName: undefined, categoryMode: 'auto'
    });
  });
});
