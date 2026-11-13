import { m3sToLps } from '../../engine/units';
import { houseCount, type ServiceStatus } from '../../game/houses';
import { boxCorners } from '../../game/town/geometry';
import type { Town } from '../../game/town';
import type { StageEvaluation } from '../../game/types';
import type { Diameters, Scenario } from '../../scenarios/types';
import type { Selection } from '../../state/store';
import { NO_FLOW } from '../network/describe';
import { strokeForDn, type Point, type Size } from '../network/geometry';
import {
  gridRects,
  placeLabels,
  ringRects,
  textWidth,
  type LabelOption,
  type LabelRequest,
  type Rect,
  type ThickSegment,
} from '../network/labels';
import type { Obstacle, WorldBox } from '../network/mapLayout';
import { PIPE_MARK_RADIUS, pipeMarkPoint, type LabelKind } from '../network/schematicLabels';
import type { LimitStatus } from '../network/status';
import { HEAD_UNIT } from '../network/strings';

/**
 * Labels of the town, as data (see also schematicLabels.ts): pills at a constant size on
 * screen. A pipe says "T2 · DN 75", then "T2 75", then "T2", and its flow only while it is
 * selected; a node chip has the status badge of its houses, the id and the pressure, then
 * badge and id. The id is never dropped: without a free place next to the element the pill
 * goes further away on a leader line.
 */

export const CHIP_HEIGHT = 20;
const TAG_HEIGHT = 18;
/** Directions tried for a label around a point, degrees on screen (90 = below). */
const DIRECTIONS = [90, 270, 0, 180, 45, 135, 315, 225];
/** Extra distance (px) of the fallback places of a pill, drawn with a leader line. */
const LEADER_STEPS = [14, 28, 42, 56, 70, 84];

export interface Pill {
  kind: LabelKind;
  id: string;
  /** Status mark at the left of a node chip. */
  icon: Exclude<ServiceStatus, 'unknown'> | null;
  /** Houses the pill may cover; more than that and a shorter variant is used. */
  maxSoft?: number;
  /** Bold part (the id) and the rest of the text. */
  strong: string;
  rest: string;
  status: string;
  selected: boolean;
}

export interface PlacedPill {
  pill: Pill;
  rect: Rect;
  /** Point of the element a leader line is drawn to, for a pill placed away from it. */
  leader?: Point;
}

export interface TownArrow {
  id: string;
  status: LimitStatus;
  at: Point;
  angle: number;
  head: number;
}

export interface TownMark {
  id: string;
  status: 'low' | 'high';
  at: Point;
}

/** Width on screen (px) of a pipe of nominal diameter `dn` at `scale` px per metre. */
export function pipeWidth(dn: number, scale: number): number {
  return strokeForDn(dn) * Math.min(1.4, Math.max(0.5, scale / 0.75));
}

export function pillSize(pill: Pill): { width: number; height: number } {
  const height = pill.kind === 'node' ? CHIP_HEIGHT : TAG_HEIGHT;
  const start = pill.icon ? 23 : 7;
  const rest = pill.rest ? textWidth(` ${pill.rest}`) : 0;
  return { width: Math.ceil(start + textWidth(pill.strong, 12, true) + rest + 7), height };
}

function centred(center: Point, size: { width: number; height: number }): Rect {
  return { x: center.x - size.width / 2, y: center.y - size.height / 2, ...size };
}

/** Options around `p`, `clear` px away from it, in the directions with most room first. */
function around(
  p: Point,
  clear: number,
  size: { width: number; height: number },
  links: readonly Point[],
): Rect[] {
  const gapOf = (degrees: number): number => {
    const angle = (degrees * Math.PI) / 180;
    let gap = Math.PI;
    for (const other of links) {
      if (other.x === p.x && other.y === p.y) continue;
      const link = Math.atan2(other.y - p.y, other.x - p.x);
      gap = Math.min(gap, Math.abs(Math.atan2(Math.sin(link - angle), Math.cos(link - angle))));
    }
    return gap;
  };
  return DIRECTIONS.map((degrees, index) => ({ degrees, index, gap: gapOf(degrees) }))
    .sort((a, b) => b.gap - a.gap || a.index - b.index)
    .map(({ degrees }) => {
      const angle = (degrees * Math.PI) / 180;
      const cos = Math.round(Math.cos(angle) * 1000) / 1000;
      const sin = Math.round(Math.sin(angle) * 1000) / 1000;
      const diagonal = cos !== 0 && sin !== 0;
      const reach = diagonal ? clear * 0.72 : clear;
      return centred(
        {
          x: p.x + Math.sign(cos) * (cos === 0 ? 0 : reach + size.width / 2),
          y: p.y + Math.sign(sin) * (sin === 0 ? 0 : reach + size.height / 2),
        },
        size,
      );
    });
}

export interface TownLabelsInput {
  town: Town;
  scenario: Scenario;
  diameters: Diameters;
  evaluation: StageEvaluation | null;
  pipeStatus: Record<string, LimitStatus>;
  service: Record<string, ServiceStatus>;
  selection: Selection;
  size: Size;
  /** Screen px per metre. */
  scale: number;
  /** Plan (m) to screen (px). */
  project: (point: Point) => Point;
  /** Areas of the canvas taken by controls. */
  blocked: readonly Rect[];
  num: (value: number, digits?: number) => string;
}

export interface TownLabels {
  pills: PlacedPill[];
  arrows: TownArrow[];
  marks: TownMark[];
}

export function townLabels({
  town,
  scenario,
  diameters,
  evaluation,
  pipeStatus,
  service,
  selection,
  size,
  scale,
  project,
  blocked,
  num,
}: TownLabelsInput): TownLabels {
  const result = evaluation?.result;
  const isSelected = (type: NonNullable<Selection>['type'], id: string) =>
    selection?.type === type && selection.id === id;
  const screen = new Map(
    [...scenario.nodes, ...scenario.reservoirs].map((n) => [n.id, project({ x: n.x, y: n.y })]),
  );
  const at = (id: string): Point => screen.get(id) ?? { x: 0, y: 0 };
  const links = [...scenario.pipes, ...scenario.pumps];
  const neighbours = (id: string): Point[] =>
    links.flatMap((link) =>
      link.from === id ? [at(link.to)] : link.to === id ? [at(link.from)] : [],
    );

  // On a small canvas the longer texts show only where they cover (almost) no house.
  const narrow = size.width < 480;

  const rects: Rect[] = [...blocked];
  const segments: ThickSegment[] = [];
  const canvas = { x: 3, y: 3, width: size.width - 6, height: size.height - 6 };
  const requests: LabelRequest<PlacedPill>[] = [];
  const arrows: TownArrow[] = [];
  const marks: TownMark[] = [];
  type Box = { width: number; height: number };
  const request = (
    priority: number,
    variants: Pill[],
    place: (box: Box) => Rect[],
    fallback: (box: Box) => { rect: Rect; leader: Point }[],
  ) => {
    const first = variants[0]!;
    const shortest = variants[variants.length - 1]!;
    requests.push({
      id: `${first.kind}:${first.id}`,
      priority: priority + (first.selected ? 100 : 0),
      options: variants.flatMap((pill, index) =>
        place(pillSize(pill)).map((rect): LabelOption<PlacedPill> => ({
          rect,
          detail: variants.length - 1 - index,
          maxSoft: pill.maxSoft,
          data: { pill, rect },
        })),
      ),
      fallback: () => {
        const box = pillSize(shortest);
        const near = fallback(box);
        const anchor = near[0]?.leader ?? { x: size.width / 2, y: size.height / 2 };
        return [
          ...near,
          ...gridRects(anchor, box, canvas).map((rect) => ({ rect, leader: anchor })),
        ].map(({ rect, leader }) => ({
          rect,
          detail: 0,
          data: { pill: shortest, rect, leader },
        }));
      },
    });
  };
  const rings = (p: Point, clear: number) => (box: Box) =>
    ringRects(
      p,
      box,
      LEADER_STEPS.map((step) => clear + step),
    ).map((rect) => ({ rect, leader: p }));

  for (const pipe of scenario.pipes) {
    const a = at(pipe.from);
    const b = at(pipe.to);
    const dn = diameters[pipe.id] ?? pipe.initialDN;
    const width = pipeWidth(dn, scale);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const pipeResult = result?.pipes[pipe.id];
    const status = pipeStatus[pipe.id] ?? 'none';
    const flow = pipeResult?.flow ?? 0;
    const head = width / 2 + 3.5;
    segments.push({ a, b, half: width / 2 + 2 });
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (Math.abs(flow) > NO_FLOW) {
      const [up, down] = flow < 0 ? [b, a] : [a, b];
      arrows.push({
        id: pipe.id,
        status,
        at: mid,
        angle: (Math.atan2(down.y - up.y, down.x - up.x) * 180) / Math.PI,
        head,
      });
      rects.push(centred(mid, { width: 2 * head + 2, height: 2 * head + 2 }));
    }
    if (pipeResult && (status === 'low' || status === 'high')) {
      const mark = pipeMarkPoint(a, b, head);
      marks.push({ id: pipe.id, status, at: mark });
      const side = 2 * PIPE_MARK_RADIUS + 2;
      rects.push(centred(mark, { width: side, height: side }));
    }
    if (length === 0) continue;
    const selected = isSelected('pipe', pipe.id);
    const base = { kind: 'pipe' as const, id: pipe.id, icon: null, status, strong: pipe.id };
    const variants: Pill[] = [
      { ...base, selected, maxSoft: narrow && !selected ? 0 : undefined, rest: `· DN ${dn}` },
      { ...base, selected, maxSoft: narrow && !selected ? 1 : undefined, rest: `${dn}` },
      { ...base, selected, rest: '' },
    ];
    if (pipeResult && selected) {
      variants.unshift({
        ...base,
        selected,
        rest: `· DN ${dn} · ${num(m3sToLps(Math.abs(flow)))} L/s`,
      });
    }
    const nx = -(b.y - a.y) / length;
    const ny = (b.x - a.x) / length;
    // Above the street first; for a steep street, the right-hand side.
    const up = ny < -0.3 || (Math.abs(ny) <= 0.3 && nx > 0) ? 1 : -1;
    const beside = (box: Box, t: number, side: number, extra: number) => {
      const reach = (Math.abs(nx) * box.width + Math.abs(ny) * box.height) / 2 + head + 3 + extra;
      const on = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      return {
        rect: centred({ x: on.x + nx * side * reach, y: on.y + ny * side * reach }, box),
        leader: on,
      };
    };
    request(
      30,
      variants,
      (box) =>
        [0.5, 0.25, 0.75].flatMap((t) => [up, -up].map((side) => beside(box, t, side, 0).rect)),
      (box) =>
        LEADER_STEPS.flatMap((step) =>
          [0.5, 0.25, 0.75].flatMap((t) => [up, -up].map((side) => beside(box, t, side, step))),
        ),
    );
  }

  for (const pump of scenario.pumps) {
    const house = town.pumps.find((p) => p.id === pump.id);
    if (!house) continue;
    const a = at(pump.from);
    const b = at(pump.to);
    segments.push({ a, b, half: 3 });
    const corners = boxCorners(house).map(project);
    const xs = corners.map((p) => p.x);
    const ys = corners.map((p) => p.y);
    const box = {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
    rects.push(box);
    const mid = project(house);
    const pumpResult = result?.pumps[pump.id];
    const base = {
      kind: 'pump' as const,
      id: pump.id,
      icon: null,
      status: 'none',
      strong: pump.id,
      selected: isSelected('pump', pump.id),
    };
    const clear = Math.max(box.width, box.height) / 2 + 3;
    request(
      44,
      pumpResult
        ? [
            { ...base, rest: `${num(pumpResult.head, 1)} m` },
            { ...base, rest: '' },
          ]
        : [{ ...base, rest: '' }],
      (pill) => around(mid, clear, pill, [a, b]),
      rings(mid, clear),
    );
  }

  for (const reservoir of scenario.reservoirs) {
    const site = town.reservoirs.find((r) => r.id === reservoir.id);
    if (!site) continue;
    const p = at(reservoir.id);
    const radius = Math.max(8, site.radius * scale * 0.78);
    rects.push(centred(p, { width: 2 * radius, height: 2 * radius }));
    const base = {
      kind: 'reservoir' as const,
      id: reservoir.id,
      icon: null,
      status: 'none',
      strong: reservoir.id,
      selected: isSelected('reservoir', reservoir.id),
    };
    request(
      45,
      [
        { ...base, rest: `${num(reservoir.waterLevel, 1)} m` },
        { ...base, rest: '' },
      ],
      (pill) => around(p, radius + 3, pill, neighbours(reservoir.id)),
      rings(p, radius + 3),
    );
  }

  for (const node of scenario.nodes) {
    const p = at(node.id);
    rects.push(centred(p, { width: 15, height: 15 }));
    const status = service[node.id] ?? 'unknown';
    const nodeResult = result?.nodes[node.id];
    const icon = houseCount(node) > 0 && status !== 'unknown' ? status : null;
    const base = {
      kind: 'node' as const,
      id: node.id,
      icon,
      status,
      selected: isSelected('node', node.id),
    };
    const variants: Pill[] = [{ ...base, strong: node.id, rest: '' }];
    if (nodeResult) {
      variants.unshift({
        ...base,
        strong: node.id,
        maxSoft: narrow && !base.selected ? 1 : undefined,
        rest: `${num(nodeResult.pressure, 1)} ${HEAD_UNIT}`,
      });
    }
    request(
      status === 'low' || status === 'high' ? 60 : 40,
      variants,
      (pill) => around(p, 12, pill, neighbours(node.id)),
      rings(p, 12),
    );
  }

  const soft: Rect[] = town.clusters.flatMap((cluster) =>
    cluster.houses.map((house) => {
      const c = project(house);
      const half = (Math.max(house.w, house.d) * scale) / 2;
      return centred(c, { width: 2 * half, height: 2 * half });
    }),
  );
  const placed = placeLabels(requests, {
    bounds: canvas,
    rects,
    segments,
    soft,
    gap: 3,
  });
  return { pills: [...placed.values()].map((option) => option.data), arrows, marks };
}

/** Extent the town view fits: the network with its houses and sites. */
export function townBounds(town: Town): WorldBox {
  return town.focus;
}

/** Free space (px) around the fitted town on each side of the canvas. */
export function townPadding(size: Size): Point {
  const narrow = size.width < 480;
  // A short canvas (a phone lying down) cannot spare more.
  return { x: narrow ? 12 : 28, y: size.height < 260 || narrow ? 14 : 28 };
}

/** Metres added around houses and sites for their shadows and selection rings. */
const SPRITE_MARGIN = 8;
/** Half (px) of the invisible hit area of a node, reservoir or pump. */
const HIT_HALF = 22;

/**
 * What the town draws of the network, with its hit areas, for the fit: none of it may end up
 * under the controls. Scenery (trees, other buildings) may. `coarse` widens the streets to
 * their 44 px touch target.
 */
export function townObstacles(town: Town, scenario: Scenario, coarse: boolean): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const around = (p: Point, half: number): WorldBox => ({
    minX: p.x - half,
    minY: p.y - half,
    maxX: p.x + half,
    maxY: p.y + half,
  });
  const position = new Map(
    [...scenario.nodes, ...scenario.reservoirs].map((n) => [n.id, { x: n.x, y: n.y }]),
  );
  const halfPx = coarse ? HIT_HALF : 13;
  for (const street of town.streets) {
    if (street.kind !== 'pipe') continue;
    obstacles.push({
      kind: 'segment',
      a: street.a,
      b: street.b,
      halfWorld: (street.width + 4) / 2,
      halfPx,
    });
  }
  for (const cluster of town.clusters) {
    const points = [...cluster.hull, ...cluster.houses];
    obstacles.push({
      kind: 'box',
      box: {
        minX: Math.min(...points.map((p) => p.x)) - SPRITE_MARGIN,
        minY: Math.min(...points.map((p) => p.y)) - SPRITE_MARGIN,
        maxX: Math.max(...points.map((p) => p.x)) + SPRITE_MARGIN,
        maxY: Math.max(...points.map((p) => p.y)) + SPRITE_MARGIN,
      },
      pad: 0,
    });
  }
  for (const node of scenario.nodes) {
    obstacles.push({ kind: 'box', box: around(node, 30), pad: 0 });
    obstacles.push({ kind: 'box', box: around(node, 0), pad: HIT_HALF });
  }
  for (const site of town.reservoirs) {
    obstacles.push({ kind: 'box', box: around(site, site.radius + SPRITE_MARGIN), pad: 0 });
    obstacles.push({ kind: 'box', box: around(site, 0), pad: HIT_HALF });
  }
  for (const pump of scenario.pumps) {
    const house = town.pumps.find((item) => item.id === pump.id);
    const a = position.get(pump.from);
    const b = position.get(pump.to);
    if (!house || !a || !b) continue;
    obstacles.push({
      kind: 'box',
      box: around(house, Math.max(house.w, house.d) / 2 + 10 + SPRITE_MARGIN),
      pad: 0,
    });
    obstacles.push({ kind: 'box', box: around(house, 0), pad: HIT_HALF });
    obstacles.push({ kind: 'segment', a, b, halfWorld: 13, halfPx });
  }
  return obstacles;
}
