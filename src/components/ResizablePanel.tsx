import { useLayoutEffect, useRef, type ReactNode } from 'react';

interface Props {
  id: string;
  label: string;
  children: ReactNode;
  className?: string;
  minHeight?: number;
}

const storageKey = (id: string) => `work-log:panel:${id}`;

export function ResizablePanel({ id, label, children, className = '', minHeight = 80 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const saved = localStorage.getItem(storageKey(id));
    if (saved) {
      try {
        const size = JSON.parse(saved) as { width?: number; height?: number };
        if (size.width && size.width > 0) element.style.width = `${size.width}px`;
        if (size.height && size.height > 0) element.style.height = `${size.height}px`;
      } catch { localStorage.removeItem(storageKey(id)); }
    }
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (!element.style.width && !element.style.height) return;
      localStorage.setItem(storageKey(id), JSON.stringify({ width: element.offsetWidth, height: element.offsetHeight }));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [id]);

  const reset = () => {
    const element = ref.current;
    if (!element) return;
    element.style.removeProperty('width');
    element.style.removeProperty('height');
    localStorage.removeItem(storageKey(id));
  };

  return <div ref={ref} data-testid={`resizable-${id}`} className={`resizable-panel ${className}`.trim()} style={{ minHeight }} title="拖动右下角调整模块大小">
    {children}
    <button type="button" className="resize-reset" aria-label={`恢复${label}默认大小`} onClick={reset}>复原</button>
  </div>;
}
