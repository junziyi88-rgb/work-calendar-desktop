import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuickEntry } from '../../../src/features/records/QuickEntry';

afterEach(() => vi.useRealTimers());

describe('quick work entry', () => {
  it('turns a short typed update into a manual work log', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<QuickEntry items={[]} initialDate="2026-09-08" onSave={onSave} />);

    await user.type(screen.getByLabelText('工作内容'), '完成第三轮脚本修改');
    await user.type(screen.getByLabelText('工时'), '1.5h');
    await user.click(screen.getByRole('button', { name: '记录' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ content: '完成第三轮脚本修改', effortMinutes: 90, periodKind: 'day', periodStart: '2026-09-08', workItemId: null, categoryMode: 'auto' }), undefined);
  });

  it('can create an item while recording week-level progress', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<QuickEntry items={[]} initialDate="2026-09-10" onSave={onSave} />);

    await user.type(screen.getByLabelText('关联事项'), '课程上线');
    await user.type(screen.getByLabelText('工作内容'), '本周完成终审');
    await user.selectOptions(screen.getByLabelText('记录到'), 'week');
    await user.click(screen.getByRole('button', { name: '记录' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ content: '本周完成终审', periodKind: 'week', periodStart: '2026-09-07' }), '课程上线');
  });

  it('accepts a typed category name so the save layer can learn it', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<QuickEntry items={[]} initialDate="2026-09-08" onSave={onSave} />);

    await user.type(screen.getByLabelText('工作内容'), '完成课程脚本');
    expect(screen.getByLabelText('分类').tagName).toBe('INPUT');
    await user.type(screen.getByLabelText('分类'), '内容制作');
    await user.click(screen.getByRole('button', { name: '记录' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      content: '完成课程脚本', categoryName: '内容制作', categoryMode: 'manual'
    }), undefined);
  });

  it('selects a recent item with one click and protects unsaved text', async () => {
    const user = userEvent.setup();
    const item = { id: 'item-1', title: '课程上线', status: 'active' as const, summary: '', completedAt: null, deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' };
    render(<QuickEntry items={[item]} initialDate="2026-09-08" onSave={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '课程上线' }));
    expect(screen.getByLabelText('关联事项')).toHaveValue('课程上线');
    await user.type(screen.getByLabelText('工作内容'), '还有一段没有保存');
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('defaults to the system time, allows manual changes, and suggests historical content and category', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 9, 14, 5));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSave = vi.fn();
    const category = { id: 'category-1', name: '内容制作', color: '#EDF3EC', keywords: ['脚本'], deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };
    render(<QuickEntry items={[]} categories={[category]} contentOptions={['完成脚本初稿']} initialDate="2026-09-09" onSave={onSave} />);

    expect(screen.getByLabelText('记录日期')).toHaveValue('2026-09-09');
    expect(screen.getByLabelText('记录时间')).toHaveValue('14:05');
    const contentList = document.getElementById(screen.getByLabelText('工作内容').getAttribute('list')!);
    expect(contentList?.querySelector('option[value="完成脚本初稿"]')).toBeInTheDocument();
    await user.type(screen.getByLabelText('工作内容'), '修改脚本');
    expect(screen.getByLabelText('分类')).toHaveValue('内容制作');
    await user.clear(screen.getByLabelText('记录日期'));
    await user.type(screen.getByLabelText('记录日期'), '2026-09-10');
    await user.clear(screen.getByLabelText('记录时间'));
    await user.type(screen.getByLabelText('记录时间'), '09:40');
    await user.click(screen.getByRole('button', { name: '记录' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      periodStart: '2026-09-10', occurredAt: new Date(2026, 8, 10, 9, 40).toISOString(),
      categoryId: 'category-1', categoryMode: 'auto'
    }), undefined);
  });
});
