import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SummaryPage } from '../../../src/features/summary/SummaryPage';
import type { WorkLogData } from '../../../src/shared/contracts';

const data: WorkLogData = {
  items: [{ id: 'item-1', title: '课程上线', status: 'active', summary: '完成修改', completedAt: null, deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' }],
  logs: [{ id: 'log-1', workItemId: 'item-1', content: '完成第三轮脚本修改', effortMinutes: 210, periodKind: 'day', periodStart: '2026-09-08', deletedAt: null, createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' }],
  settings: { theme: 'system', backupRetention: 14 }
};

describe('work summaries', () => {
  beforeEach(() => Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } }));

  it('copies a weekly summary from existing work logs', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    render(<SummaryPage data={data} initialAnchor="2026-09-08" onExport={vi.fn()} />);
    expect(screen.getByText('本周共 3.5 小时')).toBeInTheDocument();
    expect(screen.getByText('持续推进')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '复制周总结' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('完成第三轮脚本修改'));
  });
});
