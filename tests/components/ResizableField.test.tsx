import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResizableField } from '../../src/components/ResizableField';
import '../../src/styles/app.css';

class ResizeObserverStub {
  static callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) { ResizeObserverStub.callback = callback; }
  observe() {}
  disconnect() {}
  unobserve() {}
}

describe('resizable text fields', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  });

  it('restores and persists the size of an editable field', () => {
    localStorage.setItem('work-log:field:record-content', JSON.stringify({ width: 520, height: 96 }));
    render(<ResizableField id="record-content" label="工作内容"><input aria-label="工作内容" /></ResizableField>);
    const field = screen.getByTitle('拖动右下角调整工作内容输入区域大小');
    expect(field).toHaveStyle({ width: '520px', height: '96px' });
    expect(getComputedStyle(field).overflow).toBe('hidden');

    Object.defineProperty(field, 'offsetWidth', { configurable: true, value: 560 });
    Object.defineProperty(field, 'offsetHeight', { configurable: true, value: 120 });
    ResizeObserverStub.callback([{ target: field } as unknown as ResizeObserverEntry], {} as ResizeObserver);
    expect(JSON.parse(localStorage.getItem('work-log:field:record-content')!)).toEqual({ width: 560, height: 120 });
  });
});
