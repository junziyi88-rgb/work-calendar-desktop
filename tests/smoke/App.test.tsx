import { render, screen, within } from '@testing-library/react';
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
});
