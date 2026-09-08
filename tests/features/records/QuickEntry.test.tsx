import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuickEntry } from '../../../src/features/records/QuickEntry';

describe('quick work entry', () => {
  it('turns a short typed update into a manual work log', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<QuickEntry items={[]} initialDate="2026-09-08" onSave={onSave} />);

    await user.type(screen.getByLabelText('工作内容'), '完成第三轮脚本修改');
    await user.type(screen.getByLabelText('工时'), '1.5h');
    await user.click(screen.getByRole('button', { name: '记录' }));

    expect(onSave).toHaveBeenCalledWith({ content: '完成第三轮脚本修改', effortMinutes: 90, periodKind: 'day', periodStart: '2026-09-08', workItemId: null }, undefined);
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
});
