import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent,
  type RefObject,
  type SetStateAction,
} from 'react';
import { INITIAL_VIEW, zoomAt, type Point, type Size, type View } from './geometry';

/** Used until the container is measured (and in tests, where there is no layout). */
export const DEFAULT_SIZE: Size = { width: 800, height: 480 };
/** Pointer travel in px after which a press is a drag and not a click. */
const DRAG_THRESHOLD = 4;

export interface PanZoom {
  canvasRef: RefObject<HTMLDivElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  /** Size of the canvas element, px. */
  size: Size;
  view: View;
  setView: Dispatch<SetStateAction<View>>;
  /** Zooms about the centre of the canvas. */
  zoomBy: (factor: number) => void;
  /** Back to the fitted view. */
  reset: () => void;
  /** True once after a drag or pinch, so the click that ends it does not select. */
  consumeDrag: () => boolean;
  /** Pointer handlers for the svg element. */
  handlers: {
    onPointerDown: (event: PointerEvent<SVGSVGElement>) => void;
    onPointerMove: (event: PointerEvent<SVGSVGElement>) => void;
    onPointerUp: (event: PointerEvent<SVGSVGElement>) => void;
    onPointerCancel: (event: PointerEvent<SVGSVGElement>) => void;
  };
}

/**
 * Pan (drag, one finger) and zoom (wheel, pinch, buttons) of a drawing that fills a container.
 * The drawing applies `view` on top of its own fit; see `toScreen` in geometry.ts.
 */
export function usePanZoom(): PanZoom {
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<Size>(DEFAULT_SIZE);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef({ start: { x: 0, y: 0 }, moved: false });
  const sizeRef = useRef(size);

  useLayoutEffect(() => {
    sizeRef.current = size;
  }, [size]);

  useLayoutEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const measure = () => {
      const { clientWidth: width, clientHeight: height } = element;
      if (width > 0 && height > 0) {
        setSize((prev) =>
          prev.width === width && prev.height === height ? prev : { width, height },
        );
      }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // React registers wheel listeners as passive, so the zoom needs a native one to stop the page
  // from scrolling.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      // Pinch on a trackpad arrives as ctrl + wheel with small deltas.
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0015));
      setView((v) => zoomAt(v, factor, anchor, { width: rect.width, height: rect.height }));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const localPoint = (event: PointerEvent<SVGSVGElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = useCallback((event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const point = localPoint(event);
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size === 1) gesture.current = { start: point, moved: false };
  }, []);

  const onPointerMove = useCallback((event: PointerEvent<SVGSVGElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const point = localPoint(event);
    const others = [...pointers.current.entries()].filter(([id]) => id !== event.pointerId);
    pointers.current.set(event.pointerId, point);

    if (others.length === 0) {
      const { start } = gesture.current;
      if (!gesture.current.moved) {
        if (Math.hypot(point.x - start.x, point.y - start.y) < DRAG_THRESHOLD) return;
        gesture.current.moved = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }
      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      return;
    }

    // Pinch: zoom by the change in distance between two fingers and follow their midpoint.
    const other = others[0]![1];
    const before = Math.hypot(previous.x - other.x, previous.y - other.y);
    const after = Math.hypot(point.x - other.x, point.y - other.y);
    const midBefore = { x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2 };
    const midAfter = { x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 };
    gesture.current.moved = true;
    if (before > 0 && after > 0) {
      setView((v) => {
        const panned = {
          ...v,
          x: v.x + midAfter.x - midBefore.x,
          y: v.y + midAfter.y - midBefore.y,
        };
        return zoomAt(panned, after / before, midAfter, sizeRef.current);
      });
    }
  }, []);

  const onPointerEnd = useCallback((event: PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId);
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const { width, height } = sizeRef.current;
    setView((v) => zoomAt(v, factor, { x: width / 2, y: height / 2 }, sizeRef.current));
  }, []);

  const reset = useCallback(() => setView(INITIAL_VIEW), []);

  const consumeDrag = useCallback(() => {
    const moved = gesture.current.moved;
    gesture.current.moved = false;
    return moved;
  }, []);

  return {
    canvasRef,
    svgRef,
    size,
    view,
    setView,
    zoomBy,
    reset,
    consumeDrag,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
  };
}
