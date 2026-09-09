import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ItemsPage } from '../../../src/features/items/ItemsPage';
import type { WorkLogData } from '../../../src/shared/contracts';

const data: WorkLogData = {
  items: [{ id: 'item-1', title: '桌面工作记录工具', status: 'active', summary: '重新梳理真实需求', completedAt: null, deletedAt: null, createdAt: '2026-08-25T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' }],
  logs: [{ id: 'log-1', workItemId: 'item-1', content: '重新梳理真实需求', effortMinutes: 1110, periodKind: 'week', periodStart: '2026-09-07', occurredAt: '2026-09-08T00:00:00.000Z', categoryId: null, categoryMode: 'auto', deletedAt: null, createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' }],
  categories: [],
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
});
