import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { scrollEdges, type ScrollEdges } from './scrollEdges';
import './charts.css';

interface ScrollTableProps {
  /** Accessible name of the scrolling region. */
  label: string;
  className?: string;
  children: ReactNode;
}

const NO_EDGES: ScrollEdges = { start: false, end: false };

/**
 * Scrolling frame of a wide table. The table scrolls inside it in both directions, with the
 * header row and the cells marked `sticky-col` kept in view. `data-fade-start` and
 * `data-fade-end` say whether columns are hidden on each side; the style sheet draws a fade
 * on that side, which is the hint that the table scrolls sideways.
 */
export function ScrollTable({ label, className, children }: ScrollTableProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<ScrollEdges>(NO_EDGES);
  const [stickyWidth, setStickyWidth] = useState(0);

  const update = useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    const next = scrollEdges(element.scrollLeft, element.clientWidth, element.scrollWidth);
    setEdges((current) =>
      current.start === next.start && current.end === next.end ? current : next,
    );
    setStickyWidth(element.querySelector<HTMLElement>('.sticky-col')?.offsetWidth ?? 0);
  }, []);

  useEffect(() => {
    const element = scroller.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  }, [update]);

  return (
    <div
      className={className ? `hscroll ${className}` : 'hscroll'}
      data-fade-start={edges.start}
      data-fade-end={edges.end}
      style={{ '--hscroll-sticky': `${stickyWidth}px` } as CSSProperties}
    >
      <div
        ref={scroller}
        className="table-wrap hscroll__scroller"
        role="region"
        aria-label={label}
        tabIndex={0}
        onScroll={update}
      >
        {children}
      </div>
    </div>
  );
}
