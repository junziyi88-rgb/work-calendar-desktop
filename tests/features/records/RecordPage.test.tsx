import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RecordPage } from '../../../src/features/records/RecordPage';
import type { WorkLogData } from '../../../src/shared/contracts';

const data: WorkLogData = {
  items: [
    { id: 'item-1', title: '课程上线', categoryId: 'category-1', categoryMode: 'auto', status: 'active', summary: '', completedAt: null, deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-09T00:00:00.000Z' },
    { id: 'item-2', title: '内部协作', categoryId: null, categoryMode: 'auto', status: 'active', summary: '', completedAt: null, deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-09T00:00:00.000Z' }
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
  it('searches the current period by partial item title and work content', async () => {
    const user = userEvent.setup();
    render(<RecordPage data={data} initialDate="2026-09-09" onSaveItem={vi.fn()} onSaveLog={vi.fn()} onDeleteLog={vi.fn()} onRestoreLog={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '恢复记录输入默认大小' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '恢复记录列表默认大小' })).not.toBeInTheDocument();
    expect([...document.querySelectorAll('.log-main p')].map((node) => node.textContent)).toEqual(['完成脚本', '参加会议']);
    await user.type(screen.getByLabelText('搜索事项'), '课程');
    await user.type(screen.getByLabelText('搜索工作内容'), '脚');
    await user.selectOptions(screen.getByLabelText('筛选分类'), 'category-1');
    expect([...document.querySelectorAll('.log-main p')].map((node) => node.textContent)).toEqual(['完成脚本']);
  });

  it('uses a compact header without promotional copy', () => {
    render(<RecordPage data={data} initialDate="2026-09-09" onSaveItem={vi.fn()} onSaveLog={vi.fn()} onDeleteLog={vi.fn()} onRestoreLog={vi.fn()} />);
    expect(screen.getByRole('heading', { name: '记录' })).toBeInTheDocument();
    expect(screen.queryByText('做完了，就记一句。')).not.toBeInTheDocument();
    expect(screen.queryByText('不用计时，也不用整理复杂字段。')).not.toBeInTheDocument();
  });

  it('places the compact week strip inside the period toolbar and uses a three-column record grid', () => {
    const { container } = render(<RecordPage data={data} initialDate="2026-09-09" onSaveItem={vi.fn()} onSaveLog={vi.fn()} onDeleteLog={vi.fn()} onRestoreLog={vi.fn()} />);
    expect(container.querySelector('.period-toolbar > .week-strip')).toBeInTheDocument();
    expect(container.querySelector('.log-list.three-column-list')).toBeInTheDocument();
  });
});
