import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';

describe('application shell', () => {
  it('contains only the three primary work-log destinations', () => {
    render(<App />);
    const navigation = within(screen.getByRole('navigation', { name: '主导航' }));
    expect(navigation.getByRole('button', { name: '记录' })).toBeInTheDocument();
    expect(navigation.getByRole('button', { name: '事项' })).toBeInTheDocument();
    expect(navigation.getByRole('button', { name: '总结' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '计时' })).not.toBeInTheDocument();
  });

  it('opens category management from the existing overflow menu', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '更多操作' }));
    expect(screen.getByRole('button', { name: '导出记录 CSV' })).toBeInTheDocument();
    expect(screen.queryByText('导出工时 CSV')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '管理分类' }));
    expect(screen.getByRole('dialog', { name: '分类管理' })).toBeInTheDocument();
  });
});
