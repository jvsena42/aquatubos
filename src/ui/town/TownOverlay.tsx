import type { CSSProperties } from 'react';
import { m3sToLps } from '../../engine/units';
import { houseCount, type ServiceStatus } from '../../game/houses';
import { boxCorners } from '../../game/town/geometry';
import type { Town } from '../../game/town';
import type { StageEvaluation } from '../../game/types';
import { useTr } from '../../i18n';
import type { Diameters, Scenario } from '../../scenarios/types';
import type { Selection } from '../../state/store';
import { NO_FLOW } from '../network/describe';
import { useNum } from '../network/format';
import type { Point, Size } from '../network/geometry';
import {
  placeLabels,
  textWidth,
  type LabelOption,
  type LabelRequest,
  type Rect,
  type ThickSegment,
} from '../network/labels';
import type { LimitStatus } from '../network/status';
import { HEAD_UNIT, networkStrings } from '../network/strings';
import { StatusBadge } from './sprites';
import { pipeWidth } from './TownNetwork';

const CHIP_HEIGHT = 20;
const TAG_HEIGHT = 18;
/** Directions tried for a label around a point, degrees on screen (90 = below). */
const DIRECTIONS = [90, 270, 0, 180, 45, 135, 315, 225];

interface Pill {
  kind: 'node' | 'pipe' | 'site';
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

function pillSize(pill: Pill): { width: number; height: number } {
  const height = pill.kind === 'node' ? CHIP_HEIGHT : TAG_HEIGHT;
  if (pill.icon && !pill.strong) return { width: CHIP_HEIGHT, height };
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

interface TownOverlayProps {
  town: Town;
  scenario: Scenario;
  diameters: Diameters;
  evaluation: StageEvaluation | null;
  pipeStatus: Record<string, LimitStatus>;
  service: Record<string, ServiceStatus>;
  selection: Selection;
  size: Size;
  scale: number;
  /** Plan (m) to screen (px). */
  project: (point: Point) => Point;
  /** Areas of the canvas taken by controls. */
  blocked: readonly Rect[];
  /** Delay (s) of each node chip in the success sequence. */
  delays: Record<string, number>;
}

/**
 * Screen-space layer over the town: flow arrows, status chips of the nodes and the labels of
 * pipes, reservoirs and pumps, all at a constant size. It ignores the pointer; the elements
 * below stay the targets.
 */
export function TownOverlay({
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
  delays,
}: TownOverlayProps) {
  const tr = useTr();
  const num = useNum();
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
  const requests: LabelRequest<Pill>[] = [];
  const arrows: { id: string; status: LimitStatus; at: Point; angle: number; head: number }[] = [];
  const request = (
    priority: number,
    variants: Pill[],
    place: (size: { width: number; height: number }) => Rect[],
    required = false,
  ) => {
    const first = variants[0]!;
    requests.push({
      id: `${first.kind}:${first.id}`,
      priority: priority + (first.selected ? 100 : 0),
      required,
      options: variants.flatMap((pill, index) =>
        place(pillSize(pill)).map((rect): LabelOption<Pill> => ({
          rect,
          detail: variants.length - 1 - index,
          maxSoft: pill.maxSoft,
          data: pill,
        })),
      ),
    });
  };

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
    if (length === 0) continue;
    const base = { kind: 'pipe' as const, id: pipe.id, icon: null, status, strong: pipe.id };
    const selected = isSelected('pipe', pipe.id);
    const variants: Pill[] = [
      { ...base, selected, maxSoft: narrow && !selected ? 0 : undefined, rest: `· DN ${dn}` },
      { ...base, selected, rest: '' },
    ];
    if (pipeResult) {
      const mark =
        status === 'low'
          ? ` · ${tr(networkStrings.lowVelocityMark)}`
          : status === 'high'
            ? ` · ${tr(networkStrings.highVelocityMark)}`
            : '';
      const full: Pill = {
        ...base,
        selected,
        maxSoft: selected ? undefined : 0,
        rest: `· DN ${dn} · ${num(m3sToLps(Math.abs(flow)))} L/s${mark}`,
      };
      if (pillSize(full).width <= length * 0.8) variants.unshift(full);
    }
    const nx = -(b.y - a.y) / length;
    const ny = (b.x - a.x) / length;
    request(30, variants, (box) => {
      const reach = (Math.abs(nx) * box.width + Math.abs(ny) * box.height) / 2 + head + 3;
      // Above the street first; for a steep street, the right-hand side.
      const up = ny < -0.3 || (Math.abs(ny) <= 0.3 && nx > 0) ? 1 : -1;
      return [0.5, 0.34, 0.66].flatMap((t) =>
        [up, -up].map((side) =>
          centred(
            {
              x: a.x + (b.x - a.x) * t + nx * side * reach,
              y: a.y + (b.y - a.y) * t + ny * side * reach,
            },
            box,
          ),
        ),
      );
    });
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
      kind: 'site' as const,
      id: pump.id,
      icon: null,
      status: 'none',
      strong: pump.id,
      selected: isSelected('pump', pump.id),
    };
    request(
      44,
      pumpResult
        ? [
            { ...base, rest: `· H ${num(pumpResult.head, 1)} m` },
            { ...base, rest: '' },
          ]
        : [{ ...base, rest: '' }],
      (pill) => around(mid, Math.max(box.width, box.height) / 2 + 3, pill, [a, b]),
    );
  }

  for (const reservoir of scenario.reservoirs) {
    const site = town.reservoirs.find((r) => r.id === reservoir.id);
    if (!site) continue;
    const p = at(reservoir.id);
    const radius = Math.max(8, site.radius * scale * 0.78);
    rects.push(centred(p, { width: 2 * radius, height: 2 * radius }));
    const base = {
      kind: 'site' as const,
      id: reservoir.id,
      icon: null,
      status: 'none',
      strong: reservoir.id,
      selected: isSelected('reservoir', reservoir.id),
    };
    request(
      45,
      [
        {
          ...base,
          rest: `· ${tr(networkStrings.waterLevelShort)} ${num(reservoir.waterLevel, 1)} m`,
        },
        { ...base, rest: '' },
      ],
      (pill) => around(p, radius + 3, pill, neighbours(reservoir.id)),
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
    if (icon) variants.push({ ...base, strong: '', rest: '' });
    request(
      status === 'low' || status === 'high' ? 60 : 40,
      variants,
      (pill) => around(p, 12, pill, neighbours(node.id)),
      icon !== null,
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
    bounds: { x: 3, y: 3, width: size.width - 6, height: size.height - 6 },
    rects,
    segments,
    soft,
    gap: 3,
  });

  return (
    <g className="town__overlay" aria-hidden="true">
      {arrows.map((arrow) => (
        <polygon
          key={arrow.id}
          className={`town__arrow netview__pipe--${arrow.status}`}
          points={`${-arrow.head},${-arrow.head} ${arrow.head + 2},0 ${-arrow.head},${arrow.head}`}
          transform={`translate(${arrow.at.x.toFixed(1)} ${arrow.at.y.toFixed(1)}) rotate(${arrow.angle.toFixed(1)})`}
        />
      ))}
      {[...placed.values()].map(({ rect, data: pill }) => {
        const iconOnly = pill.icon !== null && !pill.strong;
        const className = [
          'town__pill',
          `town__pill--${pill.kind}`,
          `town__pill--${pill.status}`,
          pill.selected && 'town__pill--selected',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <g
            key={`${pill.kind}:${pill.id}`}
            className={className}
            data-label-for={pill.id}
            transform={`translate(${rect.x.toFixed(1)} ${rect.y.toFixed(1)})`}
            style={
              pill.kind === 'node'
                ? ({ '--town-delay': `${(delays[pill.id] ?? 0).toFixed(3)}s` } as CSSProperties)
                : undefined
            }
          >
            {!iconOnly && (
              <rect
                className="town__pill-box"
                width={rect.width}
                height={rect.height}
                rx={pill.kind === 'node' ? rect.height / 2 : 5}
              />
            )}
            {pill.icon && (
              <g transform={`translate(${CHIP_HEIGHT / 2} ${CHIP_HEIGHT / 2})`}>
                <StatusBadge status={pill.icon} />
              </g>
            )}
            {pill.strong && (
              <text className="town__pill-text" x={pill.icon ? 23 : 7} y={rect.height / 2 + 4.2}>
                <tspan className="town__pill-id">{pill.strong}</tspan>
                {pill.rest && <tspan className="town__pill-rest"> {pill.rest}</tspan>}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
