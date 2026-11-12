import type { Scenario, TownLandmarkType } from '../../scenarios/types';
import { houseCount } from '../houses';
import {
  boundsOf,
  boxCorners,
  convexHull,
  distance,
  foldAngle,
  pointPolygonDistance,
  pointSegmentDistance,
  polygonDistance,
  segmentPolygonDistance,
  type Bounds,
  type Box,
  type Point,
} from './geometry';
import { createRng, type Rng } from './random';
import { buildTerrain } from './terrain';
import type {
  Town,
  TownBuilding,
  TownCluster,
  TownHouse,
  TownPark,
  TownPlaza,
  TownPump,
  TownReservoir,
  TownStreet,
  TownTree,
} from './types';

/** Sizes in metres. The town is drawn larger than life so houses stay legible at phone width. */
export const STREET_WIDTH = 34;
export const LANE_WIDTH = 22;
export const PLAZA_RADIUS = 23;
export const RESERVOIR_RADIUS = 40;
export const PUMP_HOUSE = { w: 46, d: 34 } as const;
/** Free strip between a street edge and the front of a house. */
const SETBACK = 8;
/** Lot size along and across the street. */
const LOT = { w: 44, d: 36 } as const;
/** Margin of scenery around the network. */
const MARGIN = 170;
const MAX_BUILDINGS = 70;
const MAX_TREES = 150;
export const DEFAULT_PARK_RADIUS = 70;
/** Upper bound of the search for a free lot; reaching it means the plan has no free ground. */
const MAX_SEARCH_RADIUS = 20000;

const LANDMARK_SIZE: Record<TownLandmarkType, { w: number; d: number }> = {
  school: { w: 72, d: 46 },
  church: { w: 40, d: 62 },
  market: { w: 60, d: 44 },
  square: { w: 70, d: 70 },
};

type Tag = 'street' | 'plaza' | 'site' | 'park' | 'house' | 'building' | 'tree';
type Item = 'house' | 'building' | 'tree';

type Shape =
  | { type: 'segment'; a: Point; b: Point; half: number }
  | { type: 'circle'; x: number; y: number; r: number }
  | { type: 'polygon'; points: Point[]; x: number; y: number; r: number };

interface Obstacle {
  tag: Tag;
  shape: Shape;
}

/** Smallest free distance an item keeps from each kind of obstacle. Null: may overlap. */
const GAPS: Record<Item, Record<Tag, number | null>> = {
  house: { street: 5, plaza: 4, site: 8, park: 4, house: 5, building: 8, tree: 3 },
  building: { street: 6, plaza: 6, site: 12, park: 6, house: 14, building: 8, tree: 3 },
  tree: { street: 3, plaza: 3, site: 6, park: null, house: 4, building: 4, tree: 2 },
};

function polygonShape(points: Point[]): Shape {
  const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const r = Math.max(...points.map((p) => Math.hypot(p.x - x, p.y - y)));
  return { type: 'polygon', points, x, y, r };
}

function polygonToShape(polygon: Shape & { type: 'polygon' }, shape: Shape): number {
  switch (shape.type) {
    case 'segment':
      return segmentPolygonDistance(shape.a, shape.b, polygon.points) - shape.half;
    case 'circle':
      return pointPolygonDistance(shape, polygon.points) - shape.r;
    case 'polygon':
      // Cheap rejection by bounding circles before the exact test.
      if (Math.hypot(shape.x - polygon.x, shape.y - polygon.y) > shape.r + polygon.r + 20) {
        return Infinity;
      }
      return polygonDistance(polygon.points, shape.points);
  }
}

function circleToShape(circle: Shape & { type: 'circle' }, shape: Shape): number {
  switch (shape.type) {
    case 'segment':
      return pointSegmentDistance(circle, shape.a, shape.b) - shape.half - circle.r;
    case 'circle':
      return Math.hypot(shape.x - circle.x, shape.y - circle.y) - shape.r - circle.r;
    case 'polygon':
      return pointPolygonDistance(circle, shape.points) - circle.r;
  }
}

function shapeDistance(a: Shape, b: Shape): number {
  if (a.type === 'polygon') return polygonToShape(a, b);
  if (a.type === 'circle') return circleToShape(a, b);
  return Infinity;
}

function fits(item: Item, shape: Shape, obstacles: readonly Obstacle[]): boolean {
  const gaps = GAPS[item];
  for (const obstacle of obstacles) {
    const gap = gaps[obstacle.tag];
    if (gap !== null && shapeDistance(shape, obstacle.shape) < gap) return false;
  }
  return true;
}

function round(value: number): number {
  // Adding 0 turns −0 into 0, so the data survives a JSON round trip unchanged.
  return Math.round(value * 100) / 100 + 0;
}

function roundBox<T extends Box>(box: T): T {
  return {
    ...box,
    x: round(box.x),
    y: round(box.y),
    w: round(box.w),
    d: round(box.d),
    rotation: Math.round(box.rotation * 10000) / 10000 + 0,
  };
}

/** Network bounds plus the scenery margin, widened to a shape that suits most screens. */
function sceneBounds(points: readonly Point[]): Bounds {
  const base = points.length > 0 ? boundsOf(points) : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let { minX, minY, maxX, maxY } = base;
  minX -= MARGIN;
  minY -= MARGIN;
  maxX += MARGIN;
  maxY += MARGIN;
  const width = maxX - minX;
  const height = maxY - minY;
  if (height < 0.7 * width) {
    const extra = (0.7 * width - height) / 2;
    minY -= extra;
    maxY += extra;
  } else if (width < height) {
    const extra = (height - width) / 2;
    minX -= extra;
    maxX += extra;
  }
  return { minX, minY, maxX, maxY };
}

function shapePoints(shape: Shape): Point[] {
  if (shape.type === 'polygon') return shape.points;
  if (shape.type === 'segment') {
    return [
      { x: shape.a.x - shape.half, y: shape.a.y - shape.half },
      { x: shape.a.x + shape.half, y: shape.a.y + shape.half },
      { x: shape.b.x - shape.half, y: shape.b.y - shape.half },
      { x: shape.b.x + shape.half, y: shape.b.y + shape.half },
    ];
  }
  return [
    { x: shape.x - shape.r, y: shape.y - shape.r },
    { x: shape.x + shape.r, y: shape.y + shape.r },
  ];
}

/**
 * Builds the town of a stage from its network: streets over the pipes, the houses of every
 * demand node, the reservoir and pump sites, filler scenery and hill shading. The result is
 * plain data and depends only on the scenario (seeded by `town.seed` or the stage id).
 */
export function generateTown(scenario: Scenario): Town {
  const seed = scenario.town?.seed ?? scenario.id;
  const rng = createRng(seed);
  const overrides = scenario.town ?? {};
  const scenery = overrides.scenery !== false;

  const positions = new Map<string, Point>();
  for (const node of [...scenario.nodes, ...scenario.reservoirs]) {
    positions.set(node.id, { x: node.x, y: node.y });
  }
  const at = (id: string): Point => positions.get(id) ?? { x: 0, y: 0 };

  const streets: TownStreet[] = [
    ...scenario.pipes.map((pipe) => ({ link: pipe, kind: 'pipe' as const, width: STREET_WIDTH })),
    ...scenario.pumps.map((pump) => ({ link: pump, kind: 'pump' as const, width: LANE_WIDTH })),
  ].map(({ link, kind, width }) => ({
    id: link.id,
    kind,
    from: link.from,
    to: link.to,
    a: at(link.from),
    b: at(link.to),
    width,
  }));

  const plazas: TownPlaza[] = scenario.nodes.map((node) => ({
    nodeId: node.id,
    x: node.x,
    y: node.y,
    radius: PLAZA_RADIUS,
  }));

  const reservoirs: TownReservoir[] = scenario.reservoirs.map((reservoir) => ({
    id: reservoir.id,
    x: reservoir.x,
    y: reservoir.y,
    kind:
      reservoir.kind ?? (reservoir.waterLevel - reservoir.elevation > 8 ? 'elevated' : 'ground'),
    radius: RESERVOIR_RADIUS,
  }));

  const pumps: TownPump[] = scenario.pumps.map((pump) => {
    const a = at(pump.from);
    const b = at(pump.to);
    return roundBox({
      id: pump.id,
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      ...PUMP_HOUSE,
      rotation: Math.atan2(b.y - a.y, b.x - a.x),
    });
  });

  const obstacles: Obstacle[] = [
    ...streets.map((street): Obstacle => ({
      tag: 'street',
      shape: { type: 'segment', a: street.a, b: street.b, half: street.width / 2 },
    })),
    ...plazas.map((plaza): Obstacle => ({
      tag: 'plaza',
      shape: { type: 'circle', x: plaza.x, y: plaza.y, r: plaza.radius },
    })),
    ...reservoirs.map((site): Obstacle => ({
      tag: 'site',
      shape: { type: 'circle', x: site.x, y: site.y, r: site.radius },
    })),
    ...pumps.map((pump): Obstacle => ({ tag: 'site', shape: polygonShape(boxCorners(pump)) })),
  ];

  /** Direction of the street nearest to a point, folded so that buildings line up with it. */
  const streetAngle = (p: Point): number => {
    let best = Infinity;
    let angle = 0;
    for (const street of streets) {
      const d = pointSegmentDistance(p, street.a, street.b);
      if (d < best) {
        best = d;
        angle = Math.atan2(street.b.y - street.a.y, street.b.x - street.a.x);
      }
    }
    return foldAngle(angle);
  };
  const streetDistance = (p: Point): number =>
    Math.min(Infinity, ...streets.map((s) => pointSegmentDistance(p, s.a, s.b) - s.width / 2));

  // Fixed items from the scenario file go first so that everything else keeps clear of them.
  const buildings: TownBuilding[] = [];
  let park: TownPark | null = overrides.park
    ? {
        x: overrides.park.x,
        y: overrides.park.y,
        radius: overrides.park.radius ?? DEFAULT_PARK_RADIUS,
      }
    : null;
  if (park) {
    obstacles.push({
      tag: 'park',
      shape: { type: 'circle', x: park.x, y: park.y, r: park.radius },
    });
  }
  for (const landmark of overrides.landmarks ?? []) {
    const box = roundBox<TownBuilding>({
      kind: landmark.type,
      variant: 0,
      x: landmark.x,
      y: landmark.y,
      ...LANDMARK_SIZE[landmark.type],
      rotation: streetAngle(landmark),
    });
    buildings.push(box);
    obstacles.push({ tag: 'building', shape: polygonShape(boxCorners(box)) });
  }
  for (const extra of overrides.extraHouses ?? []) {
    const box = roundBox<TownBuilding>({
      kind: 'house',
      variant: rng.next() < 0.5 ? 0 : 1,
      x: extra.x,
      y: extra.y,
      w: rng.range(28, 36),
      d: rng.range(23, 28),
      rotation: streetAngle(extra),
    });
    buildings.push(box);
    obstacles.push({ tag: 'building', shape: polygonShape(boxCorners(box)) });
  }

  const clusters = placeClusters(scenario, streets, positions, obstacles, rng, streetAngle);

  const sitePoints = [
    ...[...positions.values()],
    ...reservoirs.flatMap((r) => shapePoints({ type: 'circle', x: r.x, y: r.y, r: r.radius })),
    ...plazas.flatMap((p) => shapePoints({ type: 'circle', x: p.x, y: p.y, r: p.radius })),
    ...pumps.flatMap((pump) => boxCorners(pump)),
    ...clusters.flatMap((cluster) => cluster.hull),
  ];
  const focus = boundsOf(sitePoints);
  let bounds = sceneBounds(sitePoints);

  const trees: TownTree[] = [];
  if (scenery) {
    if (!park) {
      park = findPark(bounds, focus, obstacles);
      if (park) {
        obstacles.push({
          tag: 'park',
          shape: { type: 'circle', x: park.x, y: park.y, r: park.radius },
        });
      }
    }
    placeBuildings(bounds, obstacles, rng, buildings, streetAngle, streetDistance);
    placeTrees(bounds, park, obstacles, rng, trees, streetDistance);
  }

  const everything = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    ...sitePoints,
    ...buildings.flatMap((b) => boxCorners(b)),
    ...trees.flatMap((t) => shapePoints({ type: 'circle', x: t.x, y: t.y, r: t.radius })),
    ...(park ? shapePoints({ type: 'circle', x: park.x, y: park.y, r: park.radius }) : []),
  ];
  const all = boundsOf(everything);
  bounds = {
    minX: Math.floor(all.minX),
    minY: Math.floor(all.minY),
    maxX: Math.ceil(all.maxX),
    maxY: Math.ceil(all.maxY),
  };

  const terrain = buildTerrain(
    [...scenario.nodes, ...scenario.reservoirs].map((n) => ({
      x: n.x,
      y: n.y,
      elevation: n.elevation,
    })),
    bounds,
  );

  return {
    seed,
    bounds,
    focus: {
      minX: Math.floor(focus.minX),
      minY: Math.floor(focus.minY),
      maxX: Math.ceil(focus.maxX),
      maxY: Math.ceil(focus.maxY),
    },
    streets,
    plazas,
    clusters,
    buildings,
    trees,
    park,
    reservoirs,
    pumps,
    terrain,
  };
}

interface Lot {
  x: number;
  y: number;
  rotation: number;
  /** Unit vector from the lot towards its street, used to push the house to the lot front. */
  front: Point;
  score: number;
}

/** Lots along the streets of a node, both sides and a few rows deep, nearest first. */
function lotsAround(node: Point, nodeId: string, streets: readonly TownStreet[]): Lot[] {
  const lots: Lot[] = [];
  const first = PLAZA_RADIUS + 6 + LOT.w / 2 - 4;
  for (const street of streets) {
    if (street.from !== nodeId && street.to !== nodeId) continue;
    const other = street.from === nodeId ? street.b : street.a;
    const length = distance(node, other);
    const u =
      length > 0
        ? { x: (other.x - node.x) / length, y: (other.y - node.y) / length }
        : { x: 1, y: 0 };
    const n = { x: -u.y, y: u.x };
    const rotation = foldAngle(Math.atan2(u.y, u.x));
    const along = [0];
    for (let k = 0; k < 8; k++) along.push(first + k * LOT.w, -(first + k * LOT.w));
    for (const s of along) {
      for (let row = 0; row < 4; row++) {
        const lateral = street.width / 2 + SETBACK + LOT.d / 2 + row * LOT.d;
        for (const side of [1, -1]) {
          lots.push({
            x: node.x + u.x * s + n.x * lateral * side,
            y: node.y + u.y * s + n.y * lateral * side,
            rotation,
            front: { x: -n.x * side, y: -n.y * side },
            score: Math.hypot(s, lateral) + row * 10,
          });
        }
      }
      // Beyond a dead end there is no street: lots also sit on the axis.
      if (s < 0) {
        lots.push({
          x: node.x + u.x * s,
          y: node.y + u.y * s,
          rotation: foldAngle(rotation + Math.PI / 2),
          front: { x: u.x, y: u.y },
          score: Math.abs(s) + 5,
        });
      }
    }
  }
  // Stable order: by score, then by the order of generation.
  return lots
    .map((lot, index) => ({ lot, index }))
    .sort((p, q) => p.lot.score - q.lot.score || p.index - q.index)
    .map((entry) => entry.lot);
}

function placeClusters(
  scenario: Scenario,
  streets: readonly TownStreet[],
  positions: ReadonlyMap<string, Point>,
  obstacles: Obstacle[],
  rng: Rng,
  streetAngle: (p: Point) => number,
): TownCluster[] {
  const clusters: TownCluster[] = [];
  for (const node of scenario.nodes) {
    const count = houseCount(node);
    if (count === 0) continue;
    const houses: TownHouse[] = [];
    const others = [...positions.entries()].filter(([id]) => id !== node.id).map(([, p]) => p);

    const tryPlace = (lot: Omit<Lot, 'score'>, ownSide: boolean): boolean => {
      const w = rng.range(28, 36);
      const d = rng.range(23, 28);
      // Front of the house on the building line, with a little variation.
      const push = (LOT.d - d) / 2 - 1 - rng.range(0, 2);
      const slide = rng.range(-2, 2);
      const along = { x: Math.cos(lot.rotation), y: Math.sin(lot.rotation) };
      const house = roundBox<TownHouse>({
        nodeId: node.id,
        roof: rng.next() < 0.3 ? 1 : 0,
        x: lot.x + lot.front.x * push + along.x * slide,
        y: lot.y + lot.front.y * push + along.y * slide,
        w,
        d,
        rotation: lot.rotation + rng.range(-0.04, 0.04),
      });
      if (ownSide) {
        const own = distance(house, node);
        if (others.some((p) => distance(house, p) < own + 24)) return false;
      }
      const shape = polygonShape(boxCorners(house));
      if (!fits('house', shape, obstacles)) return false;
      houses.push(house);
      obstacles.push({ tag: 'house', shape });
      return true;
    };

    for (const lot of lotsAround(node, node.id, streets)) {
      if (houses.length >= count) break;
      tryPlace(lot, true);
    }
    // Crowded node: widen the search ring by ring until every house has a lot.
    for (let radius = 60; houses.length < count; radius += 22) {
      if (radius > MAX_SEARCH_RADIUS) {
        throw new Error(`No free ground for the houses of node ${node.id}`);
      }
      const steps = Math.max(8, Math.floor((2 * Math.PI * radius) / LOT.w));
      const start = rng.range(0, 2 * Math.PI);
      for (let step = 0; step < steps && houses.length < count; step++) {
        const angle = start + (2 * Math.PI * step) / steps;
        const p = { x: node.x + radius * Math.cos(angle), y: node.y + radius * Math.sin(angle) };
        tryPlace({ ...p, rotation: streetAngle(p), front: { x: 0, y: 0 } }, false);
      }
    }

    const ring = Array.from({ length: 8 }, (_, i) => ({
      x: node.x + PLAZA_RADIUS * Math.cos((Math.PI * i) / 4),
      y: node.y + PLAZA_RADIUS * Math.sin((Math.PI * i) / 4),
    }));
    const hull = convexHull([...ring, ...houses.flatMap((house) => boxCorners(house))]).map(
      (p) => ({ x: round(p.x), y: round(p.y) }),
    );
    clusters.push({ nodeId: node.id, x: node.x, y: node.y, houses, hull });
  }
  return clusters;
}

/** Radius the park needs to look like one, and the largest it gets. */
const PARK_RADIUS = { min: 44, max: 90 } as const;

/**
 * Free circle for the park, on a coarse grid: the roomy spot nearest to the middle of the
 * network, or the largest free spot when none is roomy. Null when nothing reasonable is free.
 */
function findPark(bounds: Bounds, focus: Bounds, obstacles: readonly Obstacle[]): TownPark | null {
  const step = 30;
  const inset = 30;
  const middle = { x: (focus.minX + focus.maxX) / 2, y: (focus.minY + focus.maxY) / 2 };
  const roomy = PARK_RADIUS.max + 14;
  let best: (TownPark & { rank: number }) | null = null;
  for (let y = bounds.minY + inset; y <= bounds.maxY - inset; y += step) {
    for (let x = bounds.minX + inset; x <= bounds.maxX - inset; x += step) {
      let clearance = Math.min(x - bounds.minX, bounds.maxX - x, y - bounds.minY, bounds.maxY - y);
      const probe: Shape = { type: 'circle', x, y, r: 0 };
      for (const obstacle of obstacles) {
        if (clearance < PARK_RADIUS.min) break;
        clearance = Math.min(clearance, shapeDistance(probe, obstacle.shape));
      }
      if (clearance < PARK_RADIUS.min + 14) continue;
      const radius = Math.min(clearance, roomy);
      // Roomy spots rank by closeness to the middle; tighter ones always rank below them.
      const rank = radius >= roomy ? 1e9 - distance({ x, y }, middle) : radius;
      if (!best || rank > best.rank) best = { x, y, radius, rank };
    }
  }
  if (!best) return null;
  return { x: Math.round(best.x), y: Math.round(best.y), radius: Math.round(best.radius - 14) };
}

function gridCells(bounds: Bounds, cell: number, inset: number): Point[] {
  const cells: Point[] = [];
  for (let y = bounds.minY + inset; y <= bounds.maxY - inset; y += cell) {
    for (let x = bounds.minX + inset; x <= bounds.maxX - inset; x += cell) cells.push({ x, y });
  }
  return cells;
}

function placeBuildings(
  bounds: Bounds,
  obstacles: Obstacle[],
  rng: Rng,
  buildings: TownBuilding[],
  streetAngle: (p: Point) => number,
  streetDistance: (p: Point) => number,
): void {
  let placed = 0;
  for (const cell of rng.shuffle(gridCells(bounds, 62, 40))) {
    if (placed >= MAX_BUILDINGS) break;
    const p = { x: cell.x + rng.range(-14, 14), y: cell.y + rng.range(-14, 14) };
    const away = streetDistance(p);
    const chance = away < 70 ? 0.6 : away < 150 ? 0.25 : 0.04;
    const block = rng.next() < 0.3;
    const box = roundBox<TownBuilding>({
      kind: block ? 'block' : 'shed',
      variant: rng.next() < 0.5 ? 0 : 1,
      x: p.x,
      y: p.y,
      w: block ? rng.range(42, 56) : rng.range(24, 34),
      d: block ? rng.range(30, 40) : rng.range(20, 27),
      rotation: away < 220 ? streetAngle(p) : 0,
    });
    if (rng.next() >= chance) continue;
    const shape = polygonShape(boxCorners(box));
    if (!fits('building', shape, obstacles)) continue;
    buildings.push(box);
    obstacles.push({ tag: 'building', shape });
    placed++;
  }
}

function placeTrees(
  bounds: Bounds,
  park: TownPark | null,
  obstacles: Obstacle[],
  rng: Rng,
  trees: TownTree[],
  streetDistance: (p: Point) => number,
): void {
  const add = (x: number, y: number, radius: number, inPark: boolean): boolean => {
    const tree: TownTree = {
      x: round(x),
      y: round(y),
      radius: round(radius),
      variant: rng.next() < 0.35 ? 1 : 0,
      inPark,
    };
    const shape: Shape = { type: 'circle', x: tree.x, y: tree.y, r: tree.radius };
    if (!fits('tree', shape, obstacles)) return false;
    trees.push(tree);
    obstacles.push({ tag: 'tree', shape });
    return true;
  };

  if (park) {
    const count = Math.max(5, Math.round(park.radius / 9));
    const start = rng.range(0, 2 * Math.PI);
    for (let i = 0; i < count; i++) {
      const angle = start + (2 * Math.PI * i) / count + rng.range(-0.12, 0.12);
      const r = park.radius * rng.range(0.6, 0.72);
      add(park.x + r * Math.cos(angle), park.y + r * Math.sin(angle), rng.range(9, 13), true);
    }
  }

  // Groves: a coarse random field makes trees gather in some places and leave others open.
  const grove = new Map<string, number>();
  const density = (p: Point): number => {
    const key = `${Math.floor(p.x / 180)}:${Math.floor(p.y / 180)}`;
    let value = grove.get(key);
    if (value === undefined) {
      value = rng.next();
      grove.set(key, value);
    }
    return value;
  };
  const parkTrees = trees.length;
  const cells = gridCells(bounds, 40, 24).sort((p, q) => p.y - q.y || p.x - q.x);
  for (const cell of cells) density(cell);
  for (const cell of rng.shuffle(cells)) {
    if (trees.length - parkTrees >= MAX_TREES) break;
    const p = { x: cell.x + rng.range(-13, 13), y: cell.y + rng.range(-13, 13) };
    const radius = rng.range(8, 15);
    const away = streetDistance(p);
    const chance = (away < 60 ? 0.14 : 0.1) + 0.5 * density(cell) ** 2;
    if (rng.next() >= chance) continue;
    add(p.x, p.y, radius, false);
  }
}
