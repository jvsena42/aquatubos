import { useEffect, useState } from 'react';

const MIN_WIDTH = 280;

/**
 * Width in px of the element that receives the returned ref callback, kept up to date. Charts
 * draw at this width so that text keeps its size on narrow screens. `fallback` is used until
 * the element is measured and where ResizeObserver does not exist.
 */
export function useChartWidth(fallback = 720): [(element: HTMLDivElement | null) => void, number] {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width;
      if (measured && measured > 0) setWidth(Math.max(MIN_WIDTH, Math.round(measured)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [setElement, width];
}
