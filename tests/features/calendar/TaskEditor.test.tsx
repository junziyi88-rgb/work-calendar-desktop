import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TaskEditor } from '../../../src/features/calendar/TaskEditor';

describe('TaskEditor', () => {
  it('keeps the editor open and explains when the title is empty', async () => {
    const save = vi.fn();
    render(<TaskEditor task={null} initialRange={null} projects={[]} tags={[]} segments={[]} onSave={save} onDelete={vi.fn()} onClose={vi.fn()} onStartTimer={vi.fn()} onStopTimer={vi.fn()} onSaveSegment={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: '保存任务' }));
    expect(screen.getByText('请输入任务标题')).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
});
