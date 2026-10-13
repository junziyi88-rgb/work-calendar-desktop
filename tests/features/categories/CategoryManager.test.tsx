import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CategoryManager } from '../../../src/features/categories/CategoryManager';
import type { Category } from '../../../src/shared/contracts';

const category: Category = {
  id: 'category-1', name: '内容制作', color: '#EDF3EC', keywords: ['脚本'], deletedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z'
};

describe('category manager', () => {
  it('explains that keywords match item names rather than work content', () => {
    render(<CategoryManager categories={[]} onSave={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('系统只根据事项名称匹配关键词；工作内容不会参与分类。')).toBeInTheDocument();
  });

  it('creates a category with trimmed and de-duplicated keywords', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<CategoryManager categories={[]} onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText('分类名称'), '项目协作');
    await user.type(screen.getByLabelText('分类关键词'), '会议， 排期,会议');
    await user.click(screen.getByRole('button', { name: '保存分类' }));
    expect(onSave).toHaveBeenCalledWith({ name: '项目协作', color: '#E1F3FE', keywords: ['会议', '排期'] });
  });

  it('edits and confirms deletion inside the panel', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onDelete = vi.fn();
    render(<CategoryManager categories={[category]} onSave={onSave} onDelete={onDelete} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '编辑 内容制作' }));
    await user.clear(screen.getByLabelText('分类名称'));
    await user.type(screen.getByLabelText('分类名称'), '文字内容');
    await user.click(screen.getByRole('button', { name: '保存分类' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'category-1', name: '文字内容' }));

    await user.click(screen.getByRole('button', { name: '删除 内容制作' }));
    await user.click(screen.getByRole('button', { name: '确认删除 内容制作' }));
    expect(onDelete).toHaveBeenCalledWith('category-1');
  });
});
