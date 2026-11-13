import type { Point } from './geometry';

/**
 * Tap resolution of the drawings. The invisible hit areas of neighbouring elements overlap on a
 * small screen, so the element is not chosen by what is painted on top: every element describes
 * what it draws as simple shapes, and the one whose drawing is nearest to the tap wins.
 */

/** A filled circle, screen px. */
export interface Disc {
  kind: 'disc';
  x: number;
  y: number;
  r: number;
}

/** A line with thickness (a pipe or street), screen px. */
export interface Capsule {
  kind: 'capsule';
  a: Point;
  b: Point;
  half: number;
}

export type HitShape = (Disc | Capsule) & {
  /**
   * Added to the distance, px. For the parts of an element that are not its main target (the
   * houses of a node line the streets), so that they win only where nothing else is close.
   */
  bias?: number;
};

export interface HitTarget<T> {
  data: T;
  /** What the element draws. The distance to the element is the distance to the nearest one. */
  shapes: readonly HitShape[];
  /** Breaks ties, higher first: a node sits on the ends of its pipes and must win there. */
  priority: number;
}

/** Half of the smallest comfortable touch target (44 px), and the reach of a mouse click. */
export const TOUCH_REACH = 22;
export const MOUSE_REACH = 12;
/** Diameter of the invisible hit areas for each kind of pointer, px. */
export const TOUCH_TARGET = 2 * TOUCH_REACH;
export const MOUSE_TARGET = 26;
/** Length (px) at each end of a pipe that goes to the node there. */
export const NODE_CLAIM = 16;
/** Tie-break of the kinds of element, higher first. */
export const HIT_PRIORITY = { node: 3, reservoir: 3, pump: 2, pipe: 1 } as const;

/** Diameter (px) of the invisible hit areas: 44 px for a finger, less for a mouse. */
export function hitTargetSize(coarse: boolean): number {
  return coarse ? TOUCH_TARGET : MOUSE_TARGET;
}

export function hitReach(pointerType: string): number {
  return pointerType === 'mouse' ? MOUSE_REACH : TOUCH_REACH;
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** Distance from a point to the edge of a shape; 0 inside it. */
export function distanceToShape(p: Point, shape: HitShape): number {
  const centre =
    shape.kind === 'disc'
      ? Math.hypot(p.x - shape.x, p.y - shape.y) - shape.r
      : distanceToSegment(p, shape.a, shape.b) - shape.half;
  return Math.max(0, centre) + (shape.bias ?? 0);
}

/**
 * The part of the segment a-b that belongs to the pipe alone: `trim` px are left at each end
 * for the nodes there, but never more than `share` of the length, so that a short pipe keeps
 * its middle.
 */
export function trimSegment(a: Point, b: Point, trim: number, share = 0.3): { a: Point; b: Point } {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length === 0) return { a, b };
  const t = Math.min(trim, length * share) / length;
  return {
    a: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
    b: { x: b.x - (b.x - a.x) * t, y: b.y - (b.y - a.y) * t },
  };
}

/**
 * The target whose drawing is nearest to `point`, when it is within `reach` px. A tap inside
 * the drawing of several targets goes to the one with the highest priority.
 */
export function resolveHit<T>(
  point: Point,
  targets: readonly HitTarget<T>[],
  reach: number,
): T | null {
  let best: { data: T; distance: number; priority: number } | null = null;
  for (const target of targets) {
    let distance = Infinity;
    for (const shape of target.shapes) distance = Math.min(distance, distanceToShape(point, shape));
    if (distance > reach) continue;
    if (
      !best ||
      distance < best.distance - 1e-6 ||
      (Math.abs(distance - best.distance) <= 1e-6 && target.priority > best.priority)
    ) {
      best = { data: target.data, distance, priority: target.priority };
    }
  }
  return best ? best.data : null;
}
