import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ItemsPage } from '../../../src/features/items/ItemsPage';
import type { WorkLogData } from '../../../src/shared/contracts';

const data: WorkLogData = {
  items: [
    { id: 'item-1', title: '桌面工作记录工具', categoryId: 'category-1', categoryMode: 'auto', status: 'active', summary: '重新梳理真实需求', completedAt: null, deletedAt: null, createdAt: '2026-08-25T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' },
    { id: 'item-2', title: '课程发布', categoryId: null, categoryMode: 'auto', status: 'active', summary: '等待发布', completedAt: null, deletedAt: null, createdAt: '2026-08-26T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' }
  ],
  logs: [
    { id: 'log-1', workItemId: 'item-1', content: '重新梳理真实需求', effortMinutes: 1110, periodKind: 'week', periodStart: '2026-09-07', occurredAt: '2026-09-08T00:00:00.000Z', categoryId: 'category-1', categoryMode: 'auto', deletedAt: null, createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' },
    { id: 'log-2', workItemId: 'item-2', content: '校对上线清单', effortMinutes: 30, periodKind: 'day', periodStart: '2026-09-08', occurredAt: '2026-09-08T00:00:00.000Z', categoryId: null, categoryMode: 'auto', deletedAt: null, createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' }
  ],
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
    expect(screen.queryByText(/累计.*小时/)).not.toBeInTheDocument();
    expect(screen.queryByText('18.5 小时')).not.toBeInTheDocument();
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

  it('searches items by item title or linked work content', async () => {
    const user = userEvent.setup();
    render(<ItemsPage data={data} onSaveItem={vi.fn()} onComplete={vi.fn()} onReopen={vi.fn()} onSaveLog={vi.fn()} onDeleteLog={vi.fn()} onRestoreLog={vi.fn()} />);

    await user.type(screen.getByLabelText('搜索事项或工作内容'), '清单');
    expect(screen.getByRole('button', { name: /课程发布/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /桌面工作记录工具/ })).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('搜索事项或工作内容'));
    await user.type(screen.getByLabelText('搜索事项或工作内容'), '桌面工作');
    expect(screen.getByRole('button', { name: /桌面工作记录工具/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /课程发布/ })).not.toBeInTheDocument();
  });

  it('uses a compact header without promotional copy', () => {
    render(<ItemsPage data={data} onSaveItem={vi.fn()} onComplete={vi.fn()} onReopen={vi.fn()} onSaveLog={vi.fn()} onDeleteLog={vi.fn()} onRestoreLog={vi.fn()} />);
    expect(screen.getByRole('heading', { name: '事项' })).toBeInTheDocument();
    expect(screen.queryByText('每条工作都有来路。')).not.toBeInTheDocument();
    expect(screen.queryByText('跨天、跨周推进的工作，都收在同一条时间线上。')).not.toBeInTheDocument();
  });

  it('lays out item summaries in a three-column grid', () => {
    const { container } = render(<ItemsPage data={data} onSaveItem={vi.fn()} onComplete={vi.fn()} onReopen={vi.fn()} onSaveLog={vi.fn()} onDeleteLog={vi.fn()} onRestoreLog={vi.fn()} />);
    expect(container.querySelector('.item-list.three-column-list')).toBeInTheDocument();
  });
});
