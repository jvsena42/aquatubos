import { useEffect, useRef, useState, type RefObject } from 'react';

const MIN_WIDTH = 280;

/**
 * Width in px of the element the returned ref is attached to, kept up to date. Charts draw at
 * this width so that text keeps its size on narrow screens. `fallback` is used until the
 * element is measured and where ResizeObserver does not exist.
 */
export function useChartWidth(fallback = 720): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width;
      if (measured && measured > 0) setWidth(Math.max(MIN_WIDTH, Math.round(measured)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
