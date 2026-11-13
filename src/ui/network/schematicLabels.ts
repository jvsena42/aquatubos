import { m3sToLps } from '../../engine/units';
import type { StageEvaluation } from '../../game/types';
import type { Diameters, Scenario } from '../../scenarios/types';
import type { Selection } from '../../state/store';
import { NO_FLOW } from './describe';
import {
  labelSide,
  pipeLabelAnchors,
  sideAnchor,
  strokeForDn,
  type LabelAnchor,
  type Point,
  type Side,
  type Size,
} from './geometry';
import {
  gridRects,
  placeLabels,
  ringRects,
  textWidth,
  type LabelOption,
  type LabelRequest,
  type Rect,
  type ThickSegment,
} from './labels';
import type { LimitStatus, NodeStatus } from './status';
import { HEAD_UNIT } from './strings';

/**
 * Labels of the schematic, as data: what each one says and where it goes. Pure, so the label
 * policy is tested without a browser:
 *
 *   pipe       "T2 · DN 75", then "T2 75", then "T2"; the flow only for the selected pipe
 *   node       id and pressure, then the id
 *   reservoir  id and water level, then the id
 *   pump       id and head, then the id
 *
 * The id is never dropped: when none of the places next to an element is free, the id goes
 * further away on a leader line.
 */

export type LabelKind = 'pipe' | 'node' | 'reservoir' | 'pump';

export const NODE_RADIUS = 8;
export const LINE_HEIGHT = 14;
/** Radius (px) of the mark of a pipe outside the velocity limits. */
export const PIPE_MARK_RADIUS = 6.5;
const SIDES: Side[] = ['s', 'n', 'e', 'w'];
/** Extra distance (px) of the fallback places of a label, drawn with a leader line. */
const LEADER_STEPS = [16, 30, 44, 58, 72];

export interface LabelLine {
  text: string;
  className?: string;
}

export interface SchematicLabel {
  kind: LabelKind;
  id: string;
  /** Box of the text with its halo, px. The lines are centred in it. */
  rect: Rect;
  lines: LabelLine[];
  /** Point of the element a leader line is drawn to, for a label placed away from it. */
  leader?: Point;
}

export interface SchematicLabelsInput {
  scenario: Scenario;
  diameters: Diameters;
  evaluation: StageEvaluation | null;
  nodeStatus: Record<string, NodeStatus>;
  pipeStatus: Record<string, LimitStatus>;
  selection: Selection;
  /** Screen position of a node or reservoir. */
  at: (id: string) => Point;
  /** Screen position of the middle of the drawing. */
  inward: Point;
  size: Size;
  /** Areas taken by the controls. */
  blocked: readonly Rect[];
  num: (value: number, digits?: number) => string;
}

export interface SchematicLabels {
  labels: Map<string, SchematicLabel>;
  /** Where the mark of each pipe outside the velocity limits is drawn. */
  marks: Map<string, Point>;
}

function linesSize(lines: readonly LabelLine[]): { width: number; height: number } {
  return {
    width:
      Math.max(...lines.map((line) => textWidth(line.text, 12, line.className?.includes('id')))) +
      4,
    height: (lines.length - 1) * LINE_HEIGHT + 15,
  };
}

/** Box of a label of `size` at an anchor (see `sideAnchor` and `pipeLabelAnchors`). */
function anchoredRect(at: LabelAnchor, size: { width: number; height: number }): Rect {
  const x =
    at.anchor === 'middle'
      ? at.x - size.width / 2
      : at.anchor === 'start'
        ? at.x - 2
        : at.x - size.width + 2;
  const y =
    at.block === 'above'
      ? at.y - 3 - size.height + 4
      : at.block === 'below'
        ? at.y
        : at.y - size.height / 2;
  return { x, y, ...size };
}

/** Half of the arrow head drawn at the middle of a pipe of stroke `width`. */
export const arrowHead = (width: number): number => width / 2 + 4;

/**
 * Centre of the mark of a pipe outside the velocity limits: on the pipe, next to the flow
 * arrow; beside the arrow when the pipe is too short on screen.
 */
export function pipeMarkPoint(a: Point, b: Point, head: number): Point {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length === 0) return mid;
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  const offset = head + PIPE_MARK_RADIUS + 4;
  if (length >= 2 * (offset + PIPE_MARK_RADIUS + NODE_RADIUS + 4)) {
    return { x: mid.x - ux * offset, y: mid.y - uy * offset };
  }
  return { x: mid.x - uy * offset, y: mid.y + ux * offset };
}

const square = (c: Point, half: number): Rect => ({
  x: c.x - half,
  y: c.y - half,
  width: 2 * half,
  height: 2 * half,
});

export function schematicLabels({
  scenario,
  diameters,
  evaluation,
  nodeStatus,
  pipeStatus,
  selection,
  at,
  inward,
  size,
  blocked: controls,
  num,
}: SchematicLabelsInput): SchematicLabels {
  const result = evaluation?.result;
  const links = [...scenario.pipes, ...scenario.pumps];
  const neighbours = (id: string): Point[] =>
    links.flatMap((link) =>
      link.from === id ? [at(link.to)] : link.to === id ? [at(link.from)] : [],
    );
  const isSelected = (kind: LabelKind, id: string) =>
    selection?.type === kind && selection.id === id;

  const canvas = { x: 2, y: 2, width: size.width - 4, height: size.height - 4 };
  const requests: LabelRequest<SchematicLabel>[] = [];
  const blocked: Rect[] = [...controls];
  const segments: ThickSegment[] = [];
  const marks = new Map<string, Point>();

  const request = (
    kind: LabelKind,
    id: string,
    priority: number,
    variants: LabelLine[][],
    places: (size: { width: number; height: number }) => Rect[],
    fallback: (size: { width: number; height: number }) => { rect: Rect; leader: Point }[],
  ) => {
    const shortest = variants[variants.length - 1]!;
    requests.push({
      id: `${kind}:${id}`,
      priority: priority + (isSelected(kind, id) ? 100 : 0),
      options: variants.flatMap((lines, index) =>
        places(linesSize(lines)).map((rect): LabelOption<SchematicLabel> => ({
          rect,
          detail: variants.length - 1 - index,
          data: { kind, id, rect, lines },
        })),
      ),
      fallback: () => {
        const box = linesSize(shortest);
        const near = fallback(box);
        const anchor = near[0]?.leader ?? inward;
        return [
          ...near,
          ...gridRects(anchor, box, canvas).map((rect) => ({ rect, leader: anchor })),
        ].map(({ rect, leader }) => ({
          rect,
          detail: 0,
          data: { kind, id, rect, lines: shortest, leader },
        }));
      },
    });
  };
  const around = (id: string, p: Point, distance: number) => {
    const preferred = labelSide(p, neighbours(id));
    const sides = [preferred, ...SIDES.filter((side) => side !== preferred)];
    return {
      places: (box: { width: number; height: number }) =>
        sides.map((side) => anchoredRect(sideAnchor(p, side, distance), box)),
      fallback: (box: { width: number; height: number }) =>
        ringRects(
          p,
          box,
          LEADER_STEPS.map((step) => distance + step),
        ).map((rect) => ({ rect, leader: p })),
    };
  };
  const idLine = (id: string): LabelLine => ({ text: id, className: 'netview__label-id' });

  for (const reservoir of scenario.reservoirs) {
    const p = at(reservoir.id);
    blocked.push({ x: p.x - 18, y: p.y - 15, width: 36, height: 28 });
    const { places, fallback } = around(reservoir.id, p, 22);
    request(
      'reservoir',
      reservoir.id,
      50,
      [
        [idLine(reservoir.id), { text: `${num(reservoir.waterLevel, 1)} m` }],
        [idLine(reservoir.id)],
      ],
      places,
      fallback,
    );
  }

  for (const pump of scenario.pumps) {
    const a = at(pump.from);
    const b = at(pump.to);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    segments.push({ a, b, half: 4 });
    blocked.push(square(mid, 13));
    const pumpResult = result?.pumps[pump.id];
    const variants: LabelLine[][] = [[idLine(pump.id)]];
    if (pumpResult) {
      variants.unshift([
        idLine(pump.id),
        { text: `${num(pumpResult.head, 1)} m`, className: 'netview__result' },
      ]);
    }
    request(
      'pump',
      pump.id,
      48,
      variants,
      (box) =>
        (['n', 's', 'e', 'w'] as const).map((side) => anchoredRect(sideAnchor(mid, side, 18), box)),
      (box) =>
        ringRects(
          mid,
          box,
          LEADER_STEPS.map((step) => 18 + step),
        ).map((rect) => ({ rect, leader: mid })),
    );
  }

  for (const node of scenario.nodes) {
    const p = at(node.id);
    const status = nodeStatus[node.id]?.status ?? 'none';
    const failing = status === 'low' || status === 'high';
    const radius = failing ? NODE_RADIUS + 2 : NODE_RADIUS;
    blocked.push(square(p, radius + 1));
    const nodeResult = result?.nodes[node.id];
    const variants: LabelLine[][] = [[idLine(node.id)]];
    if (nodeResult) {
      variants.unshift([
        idLine(node.id),
        {
          text: `${num(nodeResult.pressure, 1)} ${HEAD_UNIT}`,
          className: `netview__result netview__result--${status}`,
        },
      ]);
    }
    const { places, fallback } = around(node.id, p, radius + 8);
    request('node', node.id, failing ? 60 : 40, variants, places, fallback);
  }

  for (const pipe of scenario.pipes) {
    const a = at(pipe.from);
    const b = at(pipe.to);
    const dn = diameters[pipe.id] ?? pipe.initialDN;
    const width = strokeForDn(dn);
    const head = arrowHead(width);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const pipeResult = result?.pipes[pipe.id];
    const status = pipeStatus[pipe.id] ?? 'none';
    segments.push({ a, b, half: width / 2 + 1 });
    if (pipeResult && Math.abs(pipeResult.flow) > NO_FLOW) blocked.push(square(mid, head + 1));
    if (pipeResult && (status === 'low' || status === 'high')) {
      const mark = pipeMarkPoint(a, b, head);
      marks.set(pipe.id, mark);
      blocked.push(square(mark, PIPE_MARK_RADIUS + 1));
    }

    const variants: LabelLine[][] = [
      [{ text: `${pipe.id} · DN ${dn}`, className: 'netview__label-id' }],
      [{ text: `${pipe.id} ${dn}`, className: 'netview__label-id' }],
      [idLine(pipe.id)],
    ];
    if (pipeResult && isSelected('pipe', pipe.id)) {
      variants.unshift([
        variants[0]![0]!,
        {
          text: `${num(m3sToLps(Math.abs(pipeResult.flow)))} L/s`,
          className: `netview__result netview__result--${status}`,
        },
      ]);
    }
    const nx = length === 0 ? 0 : -(b.y - a.y) / length;
    const ny = length === 0 ? -1 : (b.x - a.x) / length;
    request(
      'pipe',
      pipe.id,
      30,
      variants,
      (box) => pipeLabelAnchors(a, b, head + 5, inward).map((anchor) => anchoredRect(anchor, box)),
      (box) =>
        LEADER_STEPS.flatMap((step) =>
          [0.5, 0.25, 0.75].flatMap((t) =>
            [1, -1].map((side) => {
              const on = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
              const reach =
                (Math.abs(nx) * box.width + Math.abs(ny) * box.height) / 2 + head + 5 + step;
              return {
                rect: {
                  x: on.x + nx * side * reach - box.width / 2,
                  y: on.y + ny * side * reach - box.height / 2,
                  ...box,
                },
                leader: on,
              };
            }),
          ),
        ),
    );
  }

  const placed = placeLabels(requests, {
    bounds: canvas,
    rects: blocked,
    segments,
  });
  return {
    labels: new Map([...placed].map(([id, option]) => [id, option.data])),
    marks,
  };
}
