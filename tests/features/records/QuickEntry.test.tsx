import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuickEntry } from '../../../src/features/records/QuickEntry';

afterEach(() => vi.useRealTimers());

describe('quick work entry', () => {
  it('can mark an item completed while saving a work record', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<QuickEntry items={[]} initialDate="2026-09-08" onSave={onSave} />);
    expect(screen.getByRole('checkbox', { name: '事项已完成' })).toBeDisabled();
    await user.type(screen.getByLabelText('关联事项'), '完成的事项');
    await user.type(screen.getByLabelText('工作内容'), '完成交付');
    await user.click(screen.getByRole('checkbox', { name: '事项已完成' }));
    await user.click(screen.getByRole('button', { name: '记录' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ completeItem: true, content: '完成交付' }), '完成的事项');
    expect(screen.getByRole('checkbox', { name: '事项已完成' })).not.toBeChecked();
  });
  it('locks the confirmed existing item category regardless of keywords or work content', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const category = { id: 'known', name: '已确认分类', color: '#EDF3EC', keywords: [], deletedAt: null, createdAt: '', updatedAt: '' };
    const conflicting = { ...category, id: 'other', name: '关键词分类', keywords: ['已有事项', '工作内容'] };
    const item = { id: 'known-item', title: '已有事项', categoryId: category.id, categoryMode: 'manual' as const, status: 'active' as const, summary: '', completedAt: null, deletedAt: null, createdAt: '', updatedAt: '' };
    const { rerender } = render(<QuickEntry items={[item]} categories={[category, conflicting]} initialDate="2026-09-08" onSave={onSave} />);
    await user.type(screen.getByLabelText('关联事项'), item.title);
    expect(screen.getByLabelText('分类')).toHaveValue(category.name);
    await user.type(screen.getByLabelText('工作内容'), '工作内容匹配另一个分类');
    expect(screen.getByLabelText('分类')).toHaveValue(category.name);
    await user.click(screen.getByRole('button', { name: '记录' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ workItemId: item.id, categoryId: category.id }), undefined);
    rerender(<QuickEntry items={[{ ...item, categoryId: null }]} categories={[category, conflicting]} initialDate="2026-09-08" onSave={onSave} />);
    expect(screen.getByLabelText('分类')).toHaveValue('未分类');
  });

  it('recognizes a completed existing item and never recreates it with a guessed category', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const category = { id: 'known', name: '已确认分类', color: '#EDF3EC', keywords: [], deletedAt: null, createdAt: '', updatedAt: '' };
    const item = { id: 'completed', title: '之前做过的事项', categoryId: category.id, categoryMode: 'manual' as const, status: 'completed' as const, summary: '', completedAt: '2026-09-01', deletedAt: null, createdAt: '', updatedAt: '' };
    render(<QuickEntry items={[item]} categories={[category]} initialDate="2026-09-08" onSave={onSave} />);
    await user.type(screen.getByLabelText('关联事项'), item.title);
    expect(screen.getByLabelText('分类')).toHaveValue(category.name);
    await user.type(screen.getByLabelText('工作内容'), '追加记录');
    await user.click(screen.getByRole('button', { name: '记录' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('请先重新打开事项');
  });
  it('turns a short typed update into a manual work log', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<QuickEntry items={[]} initialDate="2026-09-08" onSave={onSave} />);

    await user.type(screen.getByLabelText('工作内容'), '完成第三轮脚本修改');
    expect(screen.queryByLabelText('工时')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '记录' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ content: '完成第三轮脚本修改', periodKind: 'day', periodStart: '2026-09-08', workItemId: null, categoryMode: 'auto' }), undefined);
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('effortMinutes');
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

  it('shows classification as read-only and leaves category changes to the item', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<QuickEntry items={[]} initialDate="2026-09-08" onSave={onSave} />);
    expect(screen.getByLabelText('分类')).toHaveAttribute('readonly');
    await user.type(screen.getByLabelText('工作内容'), '完成课程脚本');
    await user.click(screen.getByRole('button', { name: '记录' }));
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('categoryName');
  });

  it('suggests a category after any single matching item character', async () => {
    const user = userEvent.setup();
    const category = { id: 'classics', name: '小古文', color: '#FBF3DB', keywords: ['《守株待兔》'], deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };
    render(<QuickEntry items={[]} categories={[category]} initialDate="2026-09-08" onSave={vi.fn()} />);

    await user.type(screen.getByLabelText('关联事项'), '株');

    expect(screen.getByLabelText('分类')).toHaveValue('小古文');
  });

  it('selects a recent item with one click and protects unsaved text', async () => {
    const user = userEvent.setup();
    const item = { id: 'item-1', title: '课程上线', categoryId: null, categoryMode: 'auto' as const, status: 'active' as const, summary: '', completedAt: null, deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' };
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
    const item = { id: 'item-1', title: '课程脚本开发', categoryId: category.id, categoryMode: 'auto' as const, status: 'active' as const, summary: '', completedAt: null, deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' };
    render(<QuickEntry items={[item]} categories={[category]} contentOptions={['完成脚本初稿']} initialDate="2026-09-09" onSave={onSave} />);

    expect(screen.getByLabelText('记录日期')).toHaveValue('2026-09-09');
    expect(screen.getByLabelText('记录时间')).toHaveValue('14:05');
    const contentList = document.getElementById(screen.getByLabelText('工作内容').getAttribute('list')!);
    expect(contentList?.querySelector('option[value="完成脚本初稿"]')).toBeInTheDocument();
    await user.type(screen.getByLabelText('关联事项'), '课程脚本开发');
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
