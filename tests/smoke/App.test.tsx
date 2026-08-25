import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';

describe('application shell', () => {
  it('provides the primary work calendar destinations', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: '日历' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复盘' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '洞察' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '设置' })).toBeInTheDocument();
  });
});
