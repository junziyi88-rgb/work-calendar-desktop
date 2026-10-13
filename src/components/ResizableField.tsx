import { useLayoutEffect, useRef, type ReactNode } from 'react';

interface Props {
  id: string;
  label: string;
  children: ReactNode;
  minWidth?: number;
  minHeight?: number;
}

const storageKey = (id: string) => `work-log:field:${id}`;

export function ResizableField({ id, label, children, minWidth = 72, minHeight = 40 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

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

  return <span ref={ref} className="resizable-field" style={{ minWidth, minHeight }} title={`拖动右下角调整${label}输入区域大小`}>
    {children}
  </span>;
}
