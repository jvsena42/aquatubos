import { useEffect, useState } from 'react';
import { chartHeight } from './scale';

const MIN_WIDTH = 280;

type FrameRef = (element: HTMLDivElement | null) => void;

/**
 * Width in px of the element that receives the returned ref callback, kept up to date. Charts
 * draw at this width so that text keeps its size on narrow screens. `fallback` is used until
 * the element is measured and where ResizeObserver does not exist.
 */
export function useChartWidth(fallback = 720): [FrameRef, number] {
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

const viewportHeight = (): number =>
  typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerHeight;

/**
 * Width and height in px for a chart in the element that receives the ref callback. The width
 * is the one of the element; the height follows from it and from the height of the viewport
 * (see `chartHeight`), so the chart fits a phone in portrait and in landscape.
 */
export function useChartSize(fallback = 720): [FrameRef, { width: number; height: number }] {
  const [frameRef, width] = useChartWidth(fallback);
  const [viewport, setViewport] = useState(viewportHeight);

  useEffect(() => {
    const update = () => setViewport(viewportHeight());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return [frameRef, { width, height: chartHeight(width, viewport) }];
}
