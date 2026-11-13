import type { Scenario } from '../../scenarios/types';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** World (m) to screen (px) fit: scale in px/m and the world point drawn at the centre. */
export interface Fit {
  scale: number;
  center: Point;
}

/** User zoom (1 = fitted) and pan in px on top of the fit. */
export interface View {
  k: number;
  x: number;
  y: number;
}

export const INITIAL_VIEW: View = { k: 1, x: 0, y: 0 };
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 8;

/** Plan position (m) of every node and reservoir by id. */
export function worldPositions(scenario: Scenario): Record<string, Point> {
  const positions: Record<string, Point> = {};
  for (const node of [...scenario.nodes, ...scenario.reservoirs]) {
    positions[node.id] = { x: node.x, y: node.y };
  }
  return positions;
}

/** Scale and centre that fit all points inside `size` leaving `padding` px on every side. */
export function fitToSize(points: readonly Point[], size: Size, padding: Point): Fit {
  if (points.length === 0) return { scale: 1, center: { x: 0, y: 0 } };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const availableWidth = Math.max(size.width - 2 * padding.x, 1);
  const availableHeight = Math.max(size.height - 2 * padding.y, 1);
  const scales = [
    maxX > minX ? availableWidth / (maxX - minX) : Infinity,
    maxY > minY ? availableHeight / (maxY - minY) : Infinity,
  ];
  const scale = Math.min(...scales);
  return {
    scale: Number.isFinite(scale) ? scale : 1,
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
  };
}

export function toScreen(point: Point, fit: Fit, view: View, size: Size): Point {
  const scale = fit.scale * view.k;
  return {
    x: size.width / 2 + view.x + (point.x - fit.center.x) * scale,
    y: size.height / 2 + view.y + (point.y - fit.center.y) * scale,
  };
}

/** Zooms by `factor` keeping the screen point `anchor` over the same world point. */
export function zoomAt(view: View, factor: number, anchor: Point, size: Size): View {
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.k * factor));
  const ratio = k / view.k;
  const dx = anchor.x - size.width / 2 - view.x;
  const dy = anchor.y - size.height / 2 - view.y;
  return {
    k,
    x: anchor.x - size.width / 2 - dx * ratio,
    y: anchor.y - size.height / 2 - dy * ratio,
  };
}

export type Side = 'n' | 's' | 'e' | 'w';

/** A label above or below a node is kept while it is at least this far (rad) from every link. */
const VERTICAL_CLEARANCE = Math.PI / 3;

/**
 * Side of a node for its label, away from the links that leave it. `neighbours` are the other
 * ends of those links, in screen coordinates (y grows downward). Below or above is preferred,
 * because a centred label needs less room at the edges of the drawing; left or right is used
 * only when both are close to a link.
 */
export function labelSide(node: Point, neighbours: readonly Point[]): Side {
  const gapOf = (angle: number): number => {
    let gap = Math.PI;
    for (const other of neighbours) {
      if (other.x === node.x && other.y === node.y) continue;
      const link = Math.atan2(other.y - node.y, other.x - node.x);
      gap = Math.min(gap, Math.abs(Math.atan2(Math.sin(link - angle), Math.cos(link - angle))));
    }
    return gap;
  };
  const below = gapOf(Math.PI / 2);
  const above = gapOf(-Math.PI / 2);
  if (Math.max(below, above) >= VERTICAL_CLEARANCE) return above > below + 1e-6 ? 'n' : 's';
  return gapOf(0) >= gapOf(Math.PI) ? 'e' : 'w';
}

export interface LabelAnchor {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  /** Where the block of lines sits relative to (x, y). */
  block: 'above' | 'below' | 'centered';
}

/** Anchor of a label placed `distance` px from `point` on the given side. */
export function sideAnchor(point: Point, side: Side, distance: number): LabelAnchor {
  switch (side) {
    case 'n':
      return { x: point.x, y: point.y - distance, anchor: 'middle', block: 'above' };
    case 's':
      return { x: point.x, y: point.y + distance, anchor: 'middle', block: 'below' };
    case 'e':
      return { x: point.x + distance, y: point.y, anchor: 'start', block: 'centered' };
    case 'w':
      return { x: point.x - distance, y: point.y, anchor: 'end', block: 'centered' };
  }
}

/**
 * Anchors of a pipe label, in order of preference: beside the pipe `distance` px away along the
 * normal, so the text does not sit on the line. First above the middle of the pipe (for a
 * vertical pipe, on the side that faces `inward`, the middle of the drawing), then the other
 * side, then both sides nearer to each end.
 */
export function pipeLabelAnchors(
  a: Point,
  b: Point,
  distance: number,
  inward: Point,
): LabelAnchor[] {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length === 0) return [sideAnchor(mid, 'n', distance), sideAnchor(mid, 's', distance)];
  let nx = -(b.y - a.y) / length;
  let ny = (b.x - a.x) / length;
  const vertical = Math.abs(ny) < 0.3;
  const flip = vertical ? nx * (inward.x - mid.x) < 0 || (inward.x === mid.x && nx < 0) : ny > 0;
  if (flip) {
    nx = -nx;
    ny = -ny;
  }
  const anchorAt = (t: number, side: 1 | -1): LabelAnchor => {
    const sx = nx * side;
    const sy = ny * side;
    const x = a.x + (b.x - a.x) * t + sx * distance;
    const y = a.y + (b.y - a.y) * t + sy * distance;
    const block = vertical ? 'centered' : sy <= 0 ? 'above' : 'below';
    if (Math.abs(sx) < 0.3) return { x, y, anchor: 'middle', block };
    return { x, y, anchor: sx > 0 ? 'start' : 'end', block };
  };
  return [
    anchorAt(0.5, 1),
    anchorAt(0.5, -1),
    anchorAt(0.32, 1),
    anchorAt(0.68, 1),
    anchorAt(0.32, -1),
    anchorAt(0.68, -1),
  ];
}

/** Preferred anchor of a pipe label; see `pipeLabelAnchors`. */
export function pipeLabelAnchor(a: Point, b: Point, distance: number, inward: Point): LabelAnchor {
  return pipeLabelAnchors(a, b, distance, inward)[0]!;
}

/** Stroke width in px for a DN in mm: DN 50 → 4 px, DN 300 → 11 px. */
export function strokeForDn(dn: number): number {
  const clamped = Math.min(300, Math.max(50, dn));
  return 4 + ((clamped - 50) / 250) * 7;
}

/** Distance (world units) from each point to its nearest other point. */
export function nearestDistances(positions: Record<string, Point>): Record<string, number> {
  const ids = Object.keys(positions);
  const distances: Record<string, number> = {};
  for (const id of ids) {
    const p = positions[id]!;
    let nearest = Infinity;
    for (const other of ids) {
      if (other === id) continue;
      const q = positions[other]!;
      nearest = Math.min(nearest, Math.hypot(q.x - p.x, q.y - p.y));
    }
    distances[id] = nearest;
  }
  return distances;
}
