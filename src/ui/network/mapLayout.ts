import type { Fit, Point, Size } from './geometry';
import { rectsOverlap, segmentRectDistance, type Rect } from './labels';

/**
 * Where the overlay controls of a drawing go and how the drawing is fitted so that nothing of
 * the network lies under them. The controls (legend help, zoom in, zoom out, fit) are one strip
 * of icon buttons in the top right corner, laid out as a row or as a column. Pure functions in
 * plan coordinates (m) and screen px; the numbers must match `.netview__strip` in network.css.
 */

/** Visible side of one control, the gap between two and the distance to the canvas edge, px. */
export const STRIP_BUTTON = 34;
export const STRIP_GAP = 4;
export const STRIP_OFFSET = 6;
/**
 * Free space kept around the strip, px. It covers the 44 px hit areas of the buttons on touch
 * screens (5 px beyond the visible button) and the halo of a label.
 */
export const STRIP_MARGIN = 6;

export type StripOrientation = 'row' | 'column';

/** A box in plan coordinates. */
export interface WorldBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Something of the network that must stay clear of the controls after a fit. A box is given in
 * plan coordinates and grows by `pad` px on screen (a node marker has a fixed size on screen); a
 * segment is a pipe with half its width in metres or in px, whichever is larger on screen.
 */
export type Obstacle =
  | { kind: 'box'; box: WorldBox; pad: number }
  | { kind: 'segment'; a: Point; b: Point; halfWorld: number; halfPx: number };

export interface MapLayout {
  orientation: StripOrientation;
  /** The strip of controls, px from the top left of the canvas. */
  strip: Rect;
  /** The strip plus its margin: blocked for markers and labels. */
  keepClear: Rect;
  fit: Fit;
  /** Whether the fit had to set a band of the canvas aside for the strip. */
  reserved: boolean;
}

/** Rectangle of a strip of `slots` controls in the top right corner of a canvas. */
export function stripRect(size: Size, orientation: StripOrientation, slots: number): Rect {
  const length = slots * STRIP_BUTTON + Math.max(0, slots - 1) * STRIP_GAP;
  const width = orientation === 'row' ? length : STRIP_BUTTON;
  const height = orientation === 'row' ? STRIP_BUTTON : length;
  return { x: size.width - STRIP_OFFSET - width, y: STRIP_OFFSET, width, height };
}

function grow(rect: Rect, by: number): Rect {
  return {
    x: rect.x - by,
    y: rect.y - by,
    width: rect.width + 2 * by,
    height: rect.height + 2 * by,
  };
}

interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Scale and centre that fit `box` inside the canvas minus `insets`, centred in what is left.
 * With equal insets on opposite sides it is `fitToSize`.
 */
export function fitWithInsets(box: WorldBox, size: Size, insets: Insets): Fit {
  const width = Math.max(size.width - insets.left - insets.right, 1);
  const height = Math.max(size.height - insets.top - insets.bottom, 1);
  const spanX = box.maxX - box.minX;
  const spanY = box.maxY - box.minY;
  const raw = Math.min(spanX > 0 ? width / spanX : Infinity, spanY > 0 ? height / spanY : Infinity);
  const scale = Number.isFinite(raw) ? raw : 1;
  // The middle of the box is drawn at the middle of the free area, not of the canvas.
  const shiftX = (insets.left - insets.right) / 2;
  const shiftY = (insets.top - insets.bottom) / 2;
  return {
    scale,
    center: {
      x: (box.minX + box.maxX) / 2 - shiftX / scale,
      y: (box.minY + box.maxY) / 2 - shiftY / scale,
    },
  };
}

/** Screen position of a plan point for a fit, at the fitted view (no zoom or pan). */
export function fitPoint(point: Point, fit: Fit, size: Size): Point {
  return {
    x: size.width / 2 + (point.x - fit.center.x) * fit.scale,
    y: size.height / 2 + (point.y - fit.center.y) * fit.scale,
  };
}

/** Box on screen of an obstacle (for a segment, of its ends) at a fit. */
export function obstacleRect(obstacle: Obstacle, fit: Fit, size: Size): Rect {
  if (obstacle.kind === 'box') {
    const a = fitPoint({ x: obstacle.box.minX, y: obstacle.box.minY }, fit, size);
    const b = fitPoint({ x: obstacle.box.maxX, y: obstacle.box.maxY }, fit, size);
    return grow({ x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y }, obstacle.pad);
  }
  const a = fitPoint(obstacle.a, fit, size);
  const b = fitPoint(obstacle.b, fit, size);
  const half = Math.max(obstacle.halfWorld * fit.scale, obstacle.halfPx);
  return grow(
    {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
    },
    half,
  );
}

/** Whether an obstacle touches `rect` at a fit. */
export function obstacleTouches(obstacle: Obstacle, rect: Rect, fit: Fit, size: Size): boolean {
  if (obstacle.kind === 'box') return rectsOverlap(obstacleRect(obstacle, fit, size), rect);
  const half = Math.max(obstacle.halfWorld * fit.scale, obstacle.halfPx);
  return (
    segmentRectDistance(fitPoint(obstacle.a, fit, size), fitPoint(obstacle.b, fit, size), rect) <
    half
  );
}

interface LayoutInput {
  /** What the fit shows, plan coordinates. */
  bounds: WorldBox;
  /** Everything that must not end up under the controls. */
  obstacles: readonly Obstacle[];
  size: Size;
  /** Free space kept on every side of `bounds`, px. */
  padding: Point;
  /** Number of controls in the strip. */
  slots: number;
}

/**
 * Room (px) kept between the strip and the network beyond the margin, so that a label still
 * fits next to a node or pipe that is close to the controls.
 */
export const LABEL_ROOM = 16;

/** Extra px tried between the strip and the fitted area until every obstacle is clear. */
const EXTRA = [0, 8, 16, 24, 32, 44, 56];

/**
 * Chooses the orientation of the strip and the fit. Candidates: the plain fit (when the corner
 * under the strip happens to be empty) and a fit that sets aside the band of the strip (the top
 * of the canvas for a row, the right side for a column). The largest scale that leaves the strip
 * and its margin free of every obstacle wins; a row wins a tie.
 */
export function layoutMap({ bounds, obstacles, size, padding, slots }: LayoutInput): MapLayout {
  const base: Insets = { top: padding.y, right: padding.x, bottom: padding.y, left: padding.x };
  const orientations: StripOrientation[] = ['row'];
  const column = stripRect(size, 'column', slots);
  const row = stripRect(size, 'row', slots);
  // A column needs the height; a row that does not fit the width has no alternative either.
  if (column.y + column.height + STRIP_OFFSET <= size.height) orientations.push('column');

  let best: MapLayout | null = null;
  let fallback: MapLayout | null = null;
  for (const orientation of orientations) {
    const strip = orientation === 'row' ? row : column;
    const keepClear = grow(strip, STRIP_MARGIN);
    const roomy = grow(keepClear, LABEL_ROOM);
    const clear = (fit: Fit) =>
      obstacles.every((obstacle) => !obstacleTouches(obstacle, roomy, fit, size));
    const candidates: { fit: Fit; reserved: boolean }[] = [
      { fit: fitWithInsets(bounds, size, base), reserved: false },
    ];
    for (const extra of EXTRA) {
      const insets =
        orientation === 'row'
          ? { ...base, top: Math.max(base.top, keepClear.y + keepClear.height + extra) }
          : { ...base, right: Math.max(base.right, size.width - keepClear.x + extra) };
      candidates.push({ fit: fitWithInsets(bounds, size, insets), reserved: true });
    }
    for (const candidate of candidates) {
      const layout = { orientation, strip, keepClear, ...candidate };
      if (!clear(candidate.fit)) {
        // Nothing clears a canvas this small: keep the last, most reserved attempt of a row.
        if (orientation === 'row') fallback = layout;
        continue;
      }
      if (!best || candidate.fit.scale > best.fit.scale + 1e-9) best = layout;
      break;
    }
  }
  return best ?? fallback!;
}
