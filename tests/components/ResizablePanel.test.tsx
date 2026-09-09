import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResizablePanel } from '../../src/components/ResizablePanel';

class ResizeObserverStub {
  static callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) { ResizeObserverStub.callback = callback; }
  observe() {}
  disconnect() {}
  unobserve() {}
}

describe('resizable modules', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  });

  it('restores and persists a manually resized module', () => {
    localStorage.setItem('work-log:panel:records-entry', JSON.stringify({ width: 680, height: 260 }));
    render(<ResizablePanel id="records-entry" label="记录输入"><div>内容</div></ResizablePanel>);
    const panel = screen.getByTestId('resizable-records-entry');
    expect(panel).toHaveStyle({ width: '680px', height: '260px' });

    Object.defineProperty(panel, 'offsetWidth', { configurable: true, value: 720 });
    Object.defineProperty(panel, 'offsetHeight', { configurable: true, value: 300 });
    ResizeObserverStub.callback([{ target: panel } as unknown as ResizeObserverEntry], {} as ResizeObserver);
    expect(JSON.parse(localStorage.getItem('work-log:panel:records-entry')!)).toEqual({ width: 720, height: 300 });
  });

  it('resets a saved module size', async () => {
    const user = userEvent.setup();
    localStorage.setItem('work-log:panel:records-entry', JSON.stringify({ width: 680, height: 260 }));
    render(<ResizablePanel id="records-entry" label="记录输入"><div>内容</div></ResizablePanel>);
    const panel = screen.getByTestId('resizable-records-entry');
    await user.click(screen.getByRole('button', { name: '恢复记录输入默认大小' }));
    expect(panel.getAttribute('style')).not.toContain('680px');
    expect(localStorage.getItem('work-log:panel:records-entry')).toBeNull();
  });
});
