import type { SolveResult } from '../../engine/types';
import type { Scenario } from '../../scenarios/types';

/**
 * Pure geometry of the 3D view: no three.js here, only numbers, so it can be unit tested.
 *
 * World axes (three.js convention, Y up), in metres:
 *   X = plan x − centre      Z = plan y − centre      Y = (elevation − base) · exaggeration
 * Plan y grows towards the viewer, like the y axis of the 2D drawing grows down the screen.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A known value (ground elevation or head, m) at a plan position. */
export interface PlanPoint {
  x: number;
  y: number;
  value: number;
}

export const EXAGGERATIONS = [1, 5, 10] as const;
export type Exaggeration = (typeof EXAGGERATIONS)[number];
/** Stages have tens of metres of relief over about a kilometre: 5× makes it readable. */
export const DEFAULT_EXAGGERATION: Exaggeration = 5;

/**
 * Render budget. 'low' is for phones and tablets: coarser grids and fewer segments around
 * tubes, spheres and cylinders, which at their screen size look the same.
 */
export type Quality = 'high' | 'low';

export interface Detail {
  /** Cells along the longer side of the terrain and HGL grids. */
  gridCells: number;
  /** Grid lines are drawn every this many cells. */
  lineStep: number;
  /** Straight pieces of the centre line of a pipe draped over the terrain (even). */
  pathSegments: number;
  /** Rings along a tube per piece of its centre line. */
  tubeRings: number;
  /** Sides around a tube. */
  tubeSides: number;
  /** Width and height segments of the node spheres. */
  sphere: readonly [number, number];
  /** Sides of the tank, the water column and the pump body. */
  cylinderSides: number;
}

export const DETAIL: Record<Quality, Detail> = {
  high: {
    gridCells: 40,
    lineStep: 2,
    pathSegments: 16,
    tubeRings: 2,
    tubeSides: 10,
    sphere: [24, 16],
    cylinderSides: 32,
  },
  low: {
    gridCells: 24,
    lineStep: 2,
    pathSegments: 10,
    tubeRings: 1,
    tubeSides: 6,
    sphere: [14, 10],
    cylinderSides: 16,
  },
};

/** Cells along the longer side of the terrain and HGL grids at full quality. */
export const GRID_CELLS = DETAIL.high.gridCells;

export interface Layout {
  /** Plan bounding box of nodes and reservoirs plus a margin, m. */
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  centerX: number;
  centerY: number;
  /** Longer side of the plan box, m. Sizes of markers are fractions of it. */
  extent: number;
  /** Lowest ground elevation, m: world Y = 0. */
  baseElevation: number;
  /** Highest level the scene can reach (water levels plus pump shutoff heads), m. */
  topElevation: number;
}

/** Ground elevation at every node and reservoir. */
export function groundPoints(scenario: Scenario): PlanPoint[] {
  return [...scenario.nodes, ...scenario.reservoirs].map((p) => ({
    x: p.x,
    y: p.y,
    value: p.elevation,
  }));
}

/**
 * Hydraulic grade line height at every node and reservoir, or null when the result does not
 * cover all of them (no result yet, or a result of another network).
 */
export function headPoints(scenario: Scenario, result: SolveResult): PlanPoint[] | null {
  const points: PlanPoint[] = [];
  for (const p of [...scenario.nodes, ...scenario.reservoirs]) {
    const head = result.nodes[p.id]?.head;
    if (head === undefined || !Number.isFinite(head)) return null;
    points.push({ x: p.x, y: p.y, value: head });
  }
  return points;
}

export function sceneLayout(scenario: Scenario): Layout {
  const points = groundPoints(scenario);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const rawMinX = Math.min(...xs);
  const rawMaxX = Math.max(...xs);
  const rawMinY = Math.min(...ys);
  const rawMaxY = Math.max(...ys);
  const rawExtent = Math.max(rawMaxX - rawMinX, rawMaxY - rawMinY, 1);
  const margin = rawExtent * 0.12;
  const minX = rawMinX - margin;
  const maxX = rawMaxX + margin;
  const minY = rawMinY - margin;
  const maxY = rawMaxY + margin;
  const baseElevation = Math.min(...points.map((p) => p.value));
  const pumpHead = scenario.pumps.reduce((sum, pump) => sum + pump.points[0].head, 0);
  const topElevation = Math.max(
    ...points.map((p) => p.value),
    ...scenario.reservoirs.map((r) => r.waterLevel + pumpHead),
  );
  return {
    minX,
    maxX,
    minY,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    extent: Math.max(maxX - minX, maxY - minY),
    baseElevation,
    topElevation,
  };
}

/** Plan position and elevation (m) to world coordinates with vertical exaggeration. */
export function toWorld(
  layout: Layout,
  x: number,
  y: number,
  elevation: number,
  exaggeration: number,
): Vec3 {
  return {
    x: x - layout.centerX,
    y: (elevation - layout.baseElevation) * exaggeration,
    z: y - layout.centerY,
  };
}

/**
 * Inverse-distance weighting. Returns the exact value at a known point and a weighted mean of
 * all values elsewhere, so the result always lies between the lowest and the highest value.
 */
export function idw(points: readonly PlanPoint[], x: number, y: number, power = 2): number {
  let weightSum = 0;
  let valueSum = 0;
  for (const p of points) {
    const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d2 < 1e-12) return p.value;
    const weight = 1 / d2 ** (power / 2);
    weightSum += weight;
    valueSum += weight * p.value;
  }
  return weightSum > 0 ? valueSum / weightSum : 0;
}

/**
 * Evenly spaced coordinates from min to max that also contain every `required` coordinate, so
 * that grid vertices fall exactly on the nodes. Even samples too close to a required one are
 * dropped to avoid sliver cells.
 */
export function gridAxis(
  min: number,
  max: number,
  cells: number,
  required: readonly number[],
): number[] {
  const step = (max - min) / Math.max(1, cells);
  const inside = [...new Set(required.filter((v) => v > min && v < max))];
  const axis = [min, max, ...inside];
  for (let i = 1; i < cells; i++) {
    const v = min + i * step;
    if (inside.every((r) => Math.abs(r - v) > step * 0.25)) axis.push(v);
  }
  return axis.sort((a, b) => a - b);
}

/** Values on a rectilinear grid, row-major: `values[iy * xs.length + ix]`. */
export interface SurfaceGrid {
  xs: number[];
  ys: number[];
  values: number[];
}

/** Interpolates the points over the plan box of the layout. */
export function interpolateGrid(
  layout: Layout,
  points: readonly PlanPoint[],
  cells = GRID_CELLS,
): SurfaceGrid {
  const width = layout.maxX - layout.minX;
  const depth = layout.maxY - layout.minY;
  const cellSize = Math.max(width, depth) / cells;
  const xs = gridAxis(
    layout.minX,
    layout.maxX,
    Math.max(2, Math.round(width / cellSize)),
    points.map((p) => p.x),
  );
  const ys = gridAxis(
    layout.minY,
    layout.maxY,
    Math.max(2, Math.round(depth / cellSize)),
    points.map((p) => p.y),
  );
  const values: number[] = [];
  for (const y of ys) for (const x of xs) values.push(idw(points, x, y));
  return { xs, ys, values };
}

/** Vertex positions (x, y, z triplets) of a grid in world coordinates. */
export function gridPositions(
  layout: Layout,
  grid: SurfaceGrid,
  exaggeration: number,
  /** Values below this elevation are drawn at it (keeps a collapsed HGL inside the scene). */
  floorElevation = -Infinity,
): Float32Array {
  const positions = new Float32Array(grid.values.length * 3);
  let i = 0;
  for (const y of grid.ys) {
    for (const x of grid.xs) {
      const value = Math.max(grid.values[i / 3] ?? 0, floorElevation);
      const world = toWorld(layout, x, y, value, exaggeration);
      positions[i++] = world.x;
      positions[i++] = world.y;
      positions[i++] = world.z;
    }
  }
  return positions;
}

/** Triangle indices of an nx × ny vertex grid, facing up (+Y). */
export function gridIndices(nx: number, ny: number): Uint32Array {
  const indices = new Uint32Array(Math.max(0, nx - 1) * Math.max(0, ny - 1) * 6);
  let i = 0;
  for (let iy = 0; iy < ny - 1; iy++) {
    for (let ix = 0; ix < nx - 1; ix++) {
      const a = iy * nx + ix;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      indices[i++] = a;
      indices[i++] = c;
      indices[i++] = b;
      indices[i++] = b;
      indices[i++] = c;
      indices[i++] = d;
    }
  }
  return indices;
}

/** Index pairs of the grid lines (every `step`-th row and column, plus the border). */
export function gridLineIndices(nx: number, ny: number, step = 1): Uint32Array {
  const pairs: number[] = [];
  for (let iy = 0; iy < ny; iy++) {
    if (iy % step !== 0 && iy !== ny - 1) continue;
    for (let ix = 0; ix < nx - 1; ix++) pairs.push(iy * nx + ix, iy * nx + ix + 1);
  }
  for (let ix = 0; ix < nx; ix++) {
    if (ix % step !== 0 && ix !== nx - 1) continue;
    for (let iy = 0; iy < ny - 1; iy++) pairs.push(iy * nx + ix, (iy + 1) * nx + ix);
  }
  return Uint32Array.from(pairs);
}

/**
 * Drawn radius of a pipe, m. Real pipes (DN 50 to 300 mm) would be invisible at the scale of
 * the network, so the radius is a fraction of the scene size that grows with DN: DN 100 is
 * drawn almost twice as thick as DN 50, and DN 300 five times.
 */
export function pipeRadius(dn: number, extent: number): number {
  return extent * 0.003 * (dn / 50) ** 0.9;
}

/** Plan position and ground elevation of a node or reservoir. */
export function findPoint(scenario: Scenario, id: string): PlanPoint | undefined {
  const p = scenario.nodes.find((n) => n.id === id) ?? scenario.reservoirs.find((r) => r.id === id);
  return p ? { x: p.x, y: p.y, value: p.elevation } : undefined;
}

/**
 * Centre line of a link drawn over the terrain: `segments + 1` points from `from` to `to`,
 * straight in plan, at the interpolated ground elevation plus `lift` (world units, so the tube
 * rests on the surface instead of being half buried). Null when an end is unknown.
 */
export function pipePath(
  scenario: Scenario,
  layout: Layout,
  link: { from: string; to: string },
  exaggeration: number,
  lift = 0,
  segments = 16,
): Vec3[] | null {
  const from = findPoint(scenario, link.from);
  const to = findPoint(scenario, link.to);
  if (!from || !to) return null;
  const ground = groundPoints(scenario);
  const path: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const world = toWorld(layout, x, y, idw(ground, x, y), exaggeration);
    path.push({ x: world.x, y: world.y + lift, z: world.z });
  }
  return path;
}

export interface SegmentTransform {
  /** Midpoint. */
  position: Vec3;
  length: number;
  /** Unit quaternion (x, y, z, w) that rotates the +Y axis onto the direction a → b. */
  quaternion: [number, number, number, number];
}

/** Transform of a cylinder (axis +Y, as three.js builds it) that spans from a to b. */
export function segmentTransform(a: Vec3, b: Vec3): SegmentTransform {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dy, dz);
  const position = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
  if (length < 1e-9) return { position, length: 0, quaternion: [0, 0, 0, 1] };
  const ux = dx / length;
  const uy = dy / length;
  const uz = dz / length;
  // Pointing straight down: rotate half a turn about X (the general formula is singular).
  if (uy < -1 + 1e-9) return { position, length, quaternion: [1, 0, 0, 0] };
  // Shortest rotation from (0, 1, 0) to u: q = (cross, 1 + dot), normalised.
  const qx = uz;
  const qz = -ux;
  const qw = 1 + uy;
  const norm = Math.hypot(qx, qz, qw);
  return { position, length, quaternion: [qx / norm, 0, qz / norm, qw / norm] };
}

/**
 * Distance from the centre of a box to a perspective camera that looks at the centre from
 * `direction` (unit vector from the centre to the camera), such that the whole
 * box is inside the view. `halfSize` are the half sides of the box, `verticalFov` is in
 * radians and `aspect` is width / height of the viewport.
 */
export function fitDistance(
  halfSize: Vec3,
  direction: Vec3,
  verticalFov: number,
  aspect: number,
): number {
  const tanV = Math.tan(verticalFov / 2);
  const tanH = tanV * aspect;
  // Camera axes: right = forward × up(0, 1, 0), up = right × forward, with forward = −direction.
  // Looking straight down there is no horizontal direction: +X is taken as the right side.
  const rightLength = Math.hypot(direction.x, direction.z);
  const right =
    rightLength < 1e-9
      ? { x: 1, y: 0, z: 0 }
      : { x: direction.z / rightLength, y: 0, z: -direction.x / rightLength };
  const up = {
    x: right.z * direction.y,
    y: right.x * direction.z - right.z * direction.x,
    z: -right.x * direction.y,
  };
  let distance = 0;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const c = { x: sx * halfSize.x, y: sy * halfSize.y, z: sz * halfSize.z };
        const across = Math.abs(c.x * right.x + c.z * right.z);
        const upward = Math.abs(c.x * up.x + c.y * up.y + c.z * up.z);
        const towards = c.x * direction.x + c.y * direction.y + c.z * direction.z;
        distance = Math.max(distance, towards + across / tanH, towards + upward / tanV);
      }
    }
  }
  return distance;
}

/**
 * Unit vector from the scene centre to the camera at the start: from the south-east, looking
 * down. In a wide viewport (aspect = width / height of 1.8 or more) the camera is low, which
 * shows the relief. The narrower the viewport, the higher the camera, so that the plan fills
 * the height of a square or portrait screen instead of a thin band across it.
 */
export function startDirection(aspect: number): Vec3 {
  const up = Math.min(1.4, Math.max(0.5, 1.1 / Math.max(aspect, 1e-6) - 0.1));
  const length = Math.hypot(0.35, up, 1);
  return { x: 0.35 / length, y: up / length, z: 1 / length };
}
