import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RecordPage } from '../../../src/features/records/RecordPage';
import type { WorkLogData } from '../../../src/shared/contracts';

const data: WorkLogData = {
  items: [
    { id: 'item-1', title: '课程上线', status: 'active', summary: '', completedAt: null, deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-09T00:00:00.000Z' },
    { id: 'item-2', title: '内部协作', status: 'active', summary: '', completedAt: null, deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-09T00:00:00.000Z' }
  ],
  categories: [{ id: 'category-1', name: '内容制作', color: '#EDF3EC', keywords: ['脚本'], deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' }],
  contentOptions: ['完成脚本', '参加会议'],
  logs: [
    { id: 'log-1', workItemId: 'item-1', content: '完成脚本', effortMinutes: 60, periodKind: 'day', periodStart: '2026-09-09', occurredAt: '2026-09-09T01:00:00.000Z', categoryId: 'category-1', categoryMode: 'auto', deletedAt: null, createdAt: '2026-09-09T01:00:00.000Z', updatedAt: '2026-09-09T01:00:00.000Z' },
    { id: 'log-2', workItemId: 'item-2', content: '参加会议', effortMinutes: 30, periodKind: 'day', periodStart: '2026-09-09', occurredAt: '2026-09-09T02:00:00.000Z', categoryId: null, categoryMode: 'auto', deletedAt: null, createdAt: '2026-09-09T02:00:00.000Z', updatedAt: '2026-09-09T02:00:00.000Z' }
  ],
  settings: { theme: 'system', backupRetention: 14 }
};

describe('record filters', () => {
  it('filters the current period by historical work content and category', async () => {
    const user = userEvent.setup();
    render(<RecordPage data={data} initialDate="2026-09-09" onSaveLog={vi.fn()} onDeleteLog={vi.fn()} onRestoreLog={vi.fn()} />);
    expect([...document.querySelectorAll('.log-main p')].map((node) => node.textContent)).toEqual(['完成脚本', '参加会议']);
    await user.selectOptions(screen.getByLabelText('筛选工作内容'), '完成脚本');
    await user.selectOptions(screen.getByLabelText('筛选分类'), 'category-1');
    expect([...document.querySelectorAll('.log-main p')].map((node) => node.textContent)).toEqual(['完成脚本']);
  });
});
