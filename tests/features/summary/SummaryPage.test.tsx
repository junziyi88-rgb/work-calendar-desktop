import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SummaryPage } from '../../../src/features/summary/SummaryPage';
import type { WorkLogData } from '../../../src/shared/contracts';

const data: WorkLogData = {
  items: [{ id: 'item-1', title: '课程上线', status: 'active', summary: '完成修改', completedAt: null, deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' }],
  logs: [{ id: 'log-1', workItemId: 'item-1', content: '完成第三轮脚本修改', effortMinutes: 210, periodKind: 'day', periodStart: '2026-09-08', occurredAt: '2026-09-08T00:00:00.000Z', categoryId: 'category-1', categoryMode: 'auto', deletedAt: null, createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' }],
  categories: [{ id: 'category-1', name: '内容制作', color: '#EDF3EC', keywords: ['脚本'], deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' }],
  contentOptions: ['完成第三轮脚本修改'],
  settings: { theme: 'system', backupRetention: 14 }
};

describe('work summaries', () => {
  beforeEach(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } }));

  it('copies a weekly summary from existing work logs', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    render(<SummaryPage data={data} initialAnchor="2026-09-08" onExport={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '恢复总结日历默认大小' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '恢复总结筛选默认大小' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '恢复总结内容默认大小' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2026年第37周 · 9月7日—9月13日' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '回到本周' })).toBeInTheDocument();
    expect(screen.getByText('持续推进')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '复制周总结' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('完成第三轮脚本修改'));
  });

  it('selects an unambiguous week from the summary calendar', async () => {
    const user = userEvent.setup();
    render(<SummaryPage data={data} initialAnchor="2026-09-08" onExport={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '选择 2026-09-16' }));
    expect(screen.getByRole('heading', { name: '2026年第38周 · 9月14日—9月20日' })).toBeInTheDocument();
  });

  it('filters summaries by historical content and category', async () => {
    const user = userEvent.setup();
    render(<SummaryPage data={data} initialAnchor="2026-09-08" onExport={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText('总结筛选工作内容'), '完成第三轮脚本修改');
    await user.selectOptions(screen.getByLabelText('总结筛选分类'), 'category-1');
    expect(screen.getByText('事项进展')).toBeInTheDocument();
    expect(screen.getAllByText('完成第三轮脚本修改').length).toBeGreaterThan(0);
  });
});
