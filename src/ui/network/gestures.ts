import { zoomAt, type Point, type Size, type View } from './geometry';

/** Travel in px after which a press is a drag and not a tap: a finger is less steady. */
export const TAP_SLOP = { mouse: 4, touch: 8 } as const;
/** Two taps this close in time (ms) and place (px) are a double tap. */
export const DOUBLE_TAP_MS = 320;
export const DOUBLE_TAP_DISTANCE = 32;
export const DOUBLE_TAP_ZOOM = 1.8;

/** Slop of a pointer type as reported by pointer events ('mouse', 'touch', 'pen'). */
export function tapSlop(pointerType: string): number {
  return pointerType === 'mouse' ? TAP_SLOP.mouse : TAP_SLOP.touch;
}

/** True when the pointer went far enough from where it was pressed to count as a drag. */
export function exceedsSlop(start: Point, point: Point, slop: number): boolean {
  return Math.hypot(point.x - start.x, point.y - start.y) >= slop;
}

/** Pan by the movement of one pointer. */
export function panView(view: View, previous: Point, point: Point): View {
  return { ...view, x: view.x + point.x - previous.x, y: view.y + point.y - previous.y };
}

/**
 * One step of a pinch: a finger went from `previous` to `point` while the other stayed at
 * `other`. The drawing follows the midpoint of the two fingers and is scaled about it by the
 * change in their distance, so the point of the drawing under the midpoint stays under it.
 */
export function pinchView(
  view: View,
  previous: Point,
  point: Point,
  other: Point,
  size: Size,
): View {
  const before = Math.hypot(previous.x - other.x, previous.y - other.y);
  const after = Math.hypot(point.x - other.x, point.y - other.y);
  if (!(before > 0) || !(after > 0)) return view;
  const midBefore = { x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2 };
  const midAfter = { x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 };
  return zoomAt(panView(view, midBefore, midAfter), after / before, midAfter, size);
}

export interface Tap {
  point: Point;
  /** Timestamp, ms. */
  time: number;
}

/** True when `tap` follows `previous` closely enough to be the second tap of a double tap. */
export function isDoubleTap(previous: Tap | null, tap: Tap): boolean {
  if (!previous) return false;
  const elapsed = tap.time - previous.time;
  return (
    elapsed >= 0 &&
    elapsed <= DOUBLE_TAP_MS &&
    Math.hypot(tap.point.x - previous.point.x, tap.point.y - previous.point.y) <=
      DOUBLE_TAP_DISTANCE
  );
}
