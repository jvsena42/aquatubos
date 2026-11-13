import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  type SetStateAction,
} from 'react';
import { INITIAL_VIEW, zoomAt, type Point, type Size, type View } from './geometry';
import {
  DOUBLE_TAP_ZOOM,
  exceedsSlop,
  isDoubleTap,
  panView,
  pinchView,
  tapSlop,
  type Tap,
} from './gestures';
import { hitReach } from './hit';

/** Used until the container is measured (and in tests, where there is no layout). */
export const DEFAULT_SIZE: Size = { width: 800, height: 480 };

/** A tap on the drawing that is neither the end of a drag nor the second tap of a double tap. */
export interface DrawingTap {
  /** Where, in px from the top left of the drawing; null where there is no layout (tests). */
  point: Point | null;
  /** How far (px) from the tap an element may be and still be selected. */
  reach: number;
}

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
  /**
   * Reads a click on the drawing. Returns null when it ends a drag or pinch, or when it is the
   * second tap of a double tap (which zooms in about the tap); otherwise the tap to resolve.
   */
  consumeTap: (event: MouseEvent<SVGSVGElement>) => DrawingTap | null;
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
  const gesture = useRef({ start: { x: 0, y: 0 }, moved: false, slop: tapSlop('mouse') });
  const pointerType = useRef('mouse');
  const lastTap = useRef<Tap | null>(null);
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
    // A mouse is one pointer: whatever is still tracked lost its release.
    if (event.pointerType === 'mouse') pointers.current.clear();
    const point = localPoint(event);
    pointers.current.set(event.pointerId, point);
    pointerType.current = event.pointerType || 'mouse';
    if (pointers.current.size === 1) {
      gesture.current = { start: point, moved: false, slop: tapSlop(pointerType.current) };
    } else {
      // A second finger makes it a pinch even if no finger moves.
      gesture.current.moved = true;
    }
  }, []);

  const onPointerMove = useCallback((event: PointerEvent<SVGSVGElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const point = localPoint(event);
    const others = [...pointers.current.entries()].filter(([id]) => id !== event.pointerId);
    pointers.current.set(event.pointerId, point);

    if (others.length === 0) {
      const { start, slop } = gesture.current;
      if (!gesture.current.moved) {
        if (!exceedsSlop(start, point, slop)) {
          // Not a drag yet. Keeping the press point leaves the drawing under the finger once the
          // pan starts.
          pointers.current.set(event.pointerId, previous);
          return;
        }
        gesture.current.moved = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }
      setView((v) => panView(v, previous, point));
      return;
    }

    // Pinch: zoom by the change in distance between two fingers and follow their midpoint.
    const other = others[0]![1];
    gesture.current.moved = true;
    setView((v) => pinchView(v, previous, point, other, sizeRef.current));
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

  const consumeTap = useCallback(
    (event: MouseEvent<SVGSVGElement>): DrawingTap | null => {
      if (consumeDrag()) {
        lastTap.current = null;
        return null;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return { point: null, reach: hitReach(pointerType.current) };
      }
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const tap = { point, time: event.timeStamp };
      if (isDoubleTap(lastTap.current, tap)) {
        lastTap.current = null;
        setView((v) => zoomAt(v, DOUBLE_TAP_ZOOM, point, sizeRef.current));
        return null;
      }
      lastTap.current = tap;
      return { point, reach: hitReach(pointerType.current) };
    },
    [consumeDrag],
  );

  return {
    canvasRef,
    svgRef,
    size,
    view,
    setView,
    zoomBy,
    reset,
    consumeDrag,
    consumeTap,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
  };
}
