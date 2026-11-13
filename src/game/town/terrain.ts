import type { Bounds, Point } from './geometry';

export interface ElevationPoint extends Point {
  /** Ground elevation, m. */
  elevation: number;
}

/** Region of the plan at or above `level`, as polygons that tile it without overlapping. */
export interface TerrainBand {
  level: number;
  polygons: Point[][];
}

export interface Terrain {
  /** Lowest and highest ground elevation of the field inside the bounds, m. */
  min: number;
  max: number;
  /** Bands from the lowest level up; draw them in order, each over the previous one. */
  bands: TerrainBand[];
  /** Number of bands at or below the ground far from the town (the colour of the surroundings). */
  base: number;
}

/** Elevation span (m) of the nodes below which the town is drawn flat. */
export const FLAT_SPAN = 4;
/** Softens the peaks that inverse-distance weighting leaves at the data points, m. */
const SMOOTHING = 90;
const CELL = 24;
/** The shading reaches this far (m) beyond the town so its edge is rarely seen. */
const REACH = 720;

/**
 * Ground elevation at (x, y) from the known points: inverse-distance weighting with a smoothing
 * length, so the surface passes near (not exactly through) each point and has no sharp peaks.
 */
export function elevationAt(points: readonly ElevationPoint[], x: number, y: number): number {
  let weightSum = 0;
  let valueSum = 0;
  for (const p of points) {
    const weight = 1 / ((p.x - x) ** 2 + (p.y - y) ** 2 + SMOOTHING ** 2);
    weightSum += weight;
    valueSum += weight * p.elevation;
  }
  return weightSum > 0 ? valueSum / weightSum : 0;
}

/** Part of one grid cell at or above `level`, corners given clockwise with their values. */
function cellPolygon(corners: readonly (Point & { value: number })[], level: number): Point[] {
  const polygon: Point[] = [];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % corners.length]!;
    const aIn = a.value >= level;
    if (aIn) polygon.push({ x: a.x, y: a.y });
    if (aIn !== b.value >= level) {
      const t = (level - a.value) / (b.value - a.value);
      polygon.push({
        x: Math.round((a.x + t * (b.x - a.x)) * 10) / 10 + 0,
        y: Math.round((a.y + t * (b.y - a.y)) * 10) / 10 + 0,
      });
    }
  }
  return polygon;
}

/**
 * Hill shading data: stacked bands of the interpolated ground, or null when the elevations
 * differ by `FLAT_SPAN` or less. It covers the town and a wide margin around it. Full grid
 * cells in a row are merged into one rectangle.
 */
export function buildTerrain(points: readonly ElevationPoint[], town: Bounds): Terrain | null {
  if (points.length < 2) return null;
  const elevations = points.map((p) => p.elevation);
  if (Math.max(...elevations) - Math.min(...elevations) <= FLAT_SPAN) return null;
  const bounds = {
    minX: town.minX - REACH,
    minY: town.minY - REACH,
    maxX: town.maxX + REACH,
    maxY: town.maxY + REACH,
  };

  const nx = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / CELL));
  const ny = Math.max(1, Math.ceil((bounds.maxY - bounds.minY) / CELL));
  const xs = Array.from(
    { length: nx + 1 },
    (_, i) => Math.round(bounds.minX + ((bounds.maxX - bounds.minX) * i) / nx) + 0,
  );
  const ys = Array.from(
    { length: ny + 1 },
    (_, j) => Math.round(bounds.minY + ((bounds.maxY - bounds.minY) * j) / ny) + 0,
  );
  const values = ys.map((y) => xs.map((x) => elevationAt(points, x, y)));
  const flat = values.flat();
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  const count = Math.min(6, Math.max(3, Math.round((max - min) / 3)));

  const bands: TerrainBand[] = [];
  for (let index = 1; index <= count; index++) {
    const level = min + ((max - min) * index) / (count + 1);
    const polygons: Point[][] = [];
    for (let j = 0; j < ny; j++) {
      let runStart = -1;
      const closeRun = (end: number) => {
        if (runStart < 0) return;
        polygons.push([
          { x: xs[runStart]!, y: ys[j]! },
          { x: xs[end]!, y: ys[j]! },
          { x: xs[end]!, y: ys[j + 1]! },
          { x: xs[runStart]!, y: ys[j + 1]! },
        ]);
        runStart = -1;
      };
      for (let i = 0; i < nx; i++) {
        const corners = [
          { x: xs[i]!, y: ys[j]!, value: values[j]![i]! },
          { x: xs[i + 1]!, y: ys[j]!, value: values[j]![i + 1]! },
          { x: xs[i + 1]!, y: ys[j + 1]!, value: values[j + 1]![i + 1]! },
          { x: xs[i]!, y: ys[j + 1]!, value: values[j + 1]![i]! },
        ];
        const inside = corners.filter((c) => c.value >= level).length;
        if (inside === 4) {
          if (runStart < 0) runStart = i;
          continue;
        }
        closeRun(i);
        if (inside > 0) polygons.push(cellPolygon(corners, level));
      }
      closeRun(nx);
    }
    if (polygons.length > 0) bands.push({ level, polygons });
  }
  // Far away every point weighs the same, so the ground tends to the mean elevation.
  const far = elevations.reduce((sum, value) => sum + value, 0) / elevations.length;
  const base = bands.filter((band) => band.level <= far).length;
  return bands.length > 0 ? { min, max, bands, base } : null;
}
