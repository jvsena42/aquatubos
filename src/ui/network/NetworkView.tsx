import { useId, useMemo, type KeyboardEvent, type MouseEvent } from 'react';
import { m3sToLps } from '../../engine/units';
import { useTr } from '../../i18n';
import { useAppStore, type Selection } from '../../state/store';
import { IconStale } from '../shell/icons';
import { describePipe, describePump, describeReservoir, NO_FLOW } from './describe';
import { useNum } from './format';
import {
  fitToSize,
  labelSide,
  nearestDistances,
  pipeLabelAnchors,
  sideAnchor,
  strokeForDn,
  toScreen,
  worldPositions,
  type LabelAnchor,
  type Point,
  type Side,
} from './geometry';
import { HIT_PRIORITY, NODE_CLAIM, resolveHit, trimSegment, type HitTarget } from './hit';
import { placeLabels, textWidth, type LabelRequest, type Rect, type ThickSegment } from './labels';
import { Legend } from './Legend';
import { nodeStatuses, pipeStatuses } from './status';
import { HEAD_UNIT, networkStrings as text, pressureStatusLabels } from './strings';
import { useCoarsePointer, usePhone } from './useMediaQuery';
import { usePanZoom } from './usePanZoom';
import { SelectionBar, ZoomControls, zoomControlsArea } from './ViewControls';
import './network.css';

type ElementType = NonNullable<Selection>['type'];

const NODE_RADIUS = 8;
const LINE_HEIGHT = 14;
const SIDES: Side[] = ['s', 'n', 'e', 'w'];
/** Length of one dash plus one gap of the flow animation, px. Must match network.css. */
const DASH_PERIOD = 14;
/** Pipe length on screen (px) from which its label shows DN and flow; below it, less text. */
const FULL_LABEL = 150;
/** Length from which a pipe label shows the DN, and node spacing from which pressures show. */
const SHORT_LABEL = 96;

interface LabelLine {
  text: string;
  className?: string;
}

interface PlacedLabel {
  at: LabelAnchor;
  lines: LabelLine[];
}

/** Baseline of the first line of a label. */
function firstBaseline(at: LabelAnchor, count: number): number {
  return at.block === 'above'
    ? at.y - 3 - (count - 1) * LINE_HEIGHT
    : at.block === 'below'
      ? at.y + 11
      : at.y + 4 - ((count - 1) * LINE_HEIGHT) / 2;
}

/** Box that a label covers on screen, with its halo. */
function labelRect({ at, lines }: PlacedLabel): Rect {
  const width =
    Math.max(...lines.map((line) => textWidth(line.text, 12, line.className?.includes('id')))) + 4;
  const x =
    at.anchor === 'middle' ? at.x - width / 2 : at.anchor === 'start' ? at.x - 2 : at.x - width + 2;
  return {
    x,
    y: firstBaseline(at, lines.length) - 11,
    width,
    height: (lines.length - 1) * LINE_HEIGHT + 15,
  };
}

function Label({ at, lines }: PlacedLabel) {
  const first = firstBaseline(at, lines.length);
  return (
    <text className="netview__label" textAnchor={at.anchor} aria-hidden="true">
      {lines.map((line, index) => (
        <tspan key={index} x={at.x} y={first + index * LINE_HEIGHT} className={line.className}>
          {line.text}
        </tspan>
      ))}
    </text>
  );
}

/** Triangle that marks a node outside the pressure limits: down for low, up for high. */
function StatusGlyph({ at, status }: { at: Point; status: 'low' | 'high' }) {
  const s = status === 'low' ? 1 : -1;
  const points = [
    [at.x - 4.5, at.y - 3 * s],
    [at.x + 4.5, at.y - 3 * s],
    [at.x, at.y + 4.5 * s],
  ]
    .map((p) => p.join(','))
    .join(' ');
  return <polygon className="netview__glyph" points={points} />;
}

/**
 * 2D drawing of the open stage. Colours and labels come from the last evaluation; diameters
 * always come from the current design.
 */
export function NetworkView() {
  const tr = useTr();
  const num = useNum();
  const scenario = useAppStore((s) => s.scenario);
  const diameters = useAppStore((s) => s.diameters);
  const evaluation = useAppStore((s) => s.evaluation);
  const stale = useAppStore((s) => s.stale);
  const solving = useAppStore((s) => s.solving);
  const selection = useAppStore((s) => s.selection);
  const select = useAppStore((s) => s.select);

  const helpId = useId();
  const phone = usePhone();
  const coarse = useCoarsePointer();
  const { canvasRef, svgRef, size, view, zoomBy, reset, consumeTap, handlers } = usePanZoom();

  const world = useMemo(() => (scenario ? worldPositions(scenario) : {}), [scenario]);
  const nearest = useMemo(() => nearestDistances(world), [world]);
  const fit = useMemo(
    () =>
      fitToSize(Object.values(world), size, {
        x: size.width < 480 ? 36 : 72,
        // A short canvas (a phone lying down) cannot spare the margin that clears the controls.
        y: size.height < 260 ? 26 : size.width < 480 ? 56 : 64,
      }),
    [world, size],
  );
  const nodeStatus = useMemo(
    () => (scenario ? nodeStatuses(evaluation, scenario.checks) : {}),
    [evaluation, scenario],
  );
  const pipeStatus = useMemo(
    () => (scenario ? pipeStatuses(evaluation, scenario.checks) : {}),
    [evaluation, scenario],
  );

  if (!scenario) return null;

  const scale = fit.scale * view.k;
  const inward = toScreen(fit.center, fit, view, size);
  const at = (id: string): Point => toScreen(world[id] ?? fit.center, fit, view, size);
  const links = [...scenario.pipes, ...scenario.pumps];
  const neighbours = (id: string): Point[] =>
    links.flatMap((link) =>
      link.from === id ? [at(link.to)] : link.to === id ? [at(link.from)] : [],
    );
  const isSelected = (type: ElementType, id: string) =>
    selection?.type === type && selection.id === id;
  const result = evaluation?.result;
  const onKeyDown = (type: ElementType, id: string) => (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select({ type, id });
    } else if (event.key === 'Escape' && selection) {
      select(null);
    }
  };

  /** What every element draws, for the tap resolution (see hit.ts). */
  const hitTargets = (): HitTarget<NonNullable<Selection>>[] => [
    ...scenario.pipes.map((pipe) => ({
      data: { type: 'pipe' as const, id: pipe.id },
      priority: HIT_PRIORITY.pipe,
      shapes: [
        {
          kind: 'capsule' as const,
          ...trimSegment(at(pipe.from), at(pipe.to), NODE_CLAIM),
          half: strokeForDn(diameters[pipe.id] ?? pipe.initialDN) / 2,
        },
      ],
    })),
    ...scenario.pumps.map((pump) => {
      const a = at(pump.from);
      const b = at(pump.to);
      return {
        data: { type: 'pump' as const, id: pump.id },
        priority: HIT_PRIORITY.pump,
        shapes: [
          { kind: 'disc' as const, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, r: 13 },
          { kind: 'capsule' as const, ...trimSegment(a, b, NODE_CLAIM), half: 2 },
        ],
      };
    }),
    ...scenario.nodes.map((node) => ({
      data: { type: 'node' as const, id: node.id },
      priority: HIT_PRIORITY.node,
      shapes: [{ kind: 'disc' as const, ...at(node.id), r: NODE_RADIUS + 2 }],
    })),
    ...scenario.reservoirs.map((reservoir) => ({
      data: { type: 'reservoir' as const, id: reservoir.id },
      priority: HIT_PRIORITY.reservoir,
      shapes: [{ kind: 'disc' as const, ...at(reservoir.id), r: 18 }],
    })),
  ];

  const onClick = (event: MouseEvent<SVGSVGElement>) => {
    const tap = consumeTap(event);
    if (!tap) return;
    if (tap.point) {
      select(resolveHit(tap.point, hitTargets(), tap.reach));
      return;
    }
    // Without layout (tests) there is no geometry to measure: the element under the pointer.
    const element = (event.target as Element).closest('[data-element]');
    const type = element?.getAttribute('data-element') as ElementType | undefined;
    const id = element?.getAttribute('data-id');
    select(type && id ? { type, id } : null);
  };

  const hint = stale ? text.staleHint : !evaluation && !solving ? text.notSolvedHint : null;
  // Labels: every element offers a few places and amounts of text; the placer keeps what does
  // not collide and drops text from the least important labels first.
  const requests: LabelRequest<PlacedLabel>[] = [];
  const controls = zoomControlsArea(coarse || phone);
  const blocked: Rect[] = [{ x: size.width - controls.width, y: 0, ...controls }];
  if (hint) {
    blocked.push({ x: 0, y: 0, width: Math.max(0, size.width - controls.width - 20), height: 38 });
  }
  const segments: ThickSegment[] = [];
  const request = (
    type: ElementType,
    id: string,
    priority: number,
    anchors: LabelAnchor[],
    variants: LabelLine[][],
  ) => {
    requests.push({
      id: `${type}:${id}`,
      priority: priority + (isSelected(type, id) ? 100 : 0),
      options: variants.flatMap((lines, index) =>
        anchors.map((anchor) => {
          const data = { at: anchor, lines };
          return { rect: labelRect(data), detail: variants.length - 1 - index, data };
        }),
      ),
    });
  };
  const sidesOf = (id: string, p: Point, distance: number): LabelAnchor[] => {
    const preferred = labelSide(p, neighbours(id));
    return [preferred, ...SIDES.filter((side) => side !== preferred)].map((side) =>
      sideAnchor(p, side, distance),
    );
  };

  for (const reservoir of scenario.reservoirs) {
    const p = at(reservoir.id);
    blocked.push({ x: p.x - 18, y: p.y - 15, width: 36, height: 28 });
    const id: LabelLine = { text: reservoir.id, className: 'netview__label-id' };
    request('reservoir', reservoir.id, 50, sidesOf(reservoir.id, p, 22), [
      [id, { text: `${tr(text.waterLevelShort)} ${num(reservoir.waterLevel, 1)} m` }],
      [id],
    ]);
  }
  for (const pump of scenario.pumps) {
    const a = at(pump.from);
    const b = at(pump.to);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    segments.push({ a, b, half: 4 });
    blocked.push({ x: mid.x - 13, y: mid.y - 13, width: 26, height: 26 });
    const id: LabelLine = { text: pump.id, className: 'netview__label-id' };
    const pumpResult = result?.pumps[pump.id];
    request(
      'pump',
      pump.id,
      48,
      (['n', 's', 'e', 'w'] as const).map((side) => sideAnchor(mid, side, 18)),
      pumpResult
        ? [[id, { text: `H ${num(pumpResult.head, 1)} m`, className: 'netview__result' }], [id]]
        : [[id]],
    );
  }
  for (const node of scenario.nodes) {
    const p = at(node.id);
    const status = nodeStatus[node.id]?.status ?? 'none';
    const failing = status === 'low' || status === 'high';
    const radius = failing ? NODE_RADIUS + 2 : NODE_RADIUS;
    blocked.push({
      x: p.x - radius - 1,
      y: p.y - radius - 1,
      width: 2 * radius + 2,
      height: 2 * radius + 2,
    });
    const id: LabelLine = { text: node.id, className: 'netview__label-id' };
    const nodeResult = result?.nodes[node.id];
    const variants: LabelLine[][] = [[id]];
    if (nodeResult && (nearest[node.id] ?? Infinity) * scale >= SHORT_LABEL) {
      variants.unshift([
        id,
        {
          text: `${num(nodeResult.pressure, 1)} ${HEAD_UNIT}`,
          className: `netview__result netview__result--${status}`,
        },
      ]);
    }
    request('node', node.id, failing ? 60 : 40, sidesOf(node.id, p, radius + 8), variants);
  }
  for (const pipe of scenario.pipes) {
    const a = at(pipe.from);
    const b = at(pipe.to);
    const dn = diameters[pipe.id] ?? pipe.initialDN;
    const width = strokeForDn(dn);
    const head = width / 2 + 4;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const pipeResult = result?.pipes[pipe.id];
    const status = pipeStatus[pipe.id] ?? 'none';
    segments.push({ a, b, half: width / 2 + 1 });
    if (pipeResult && Math.abs(pipeResult.flow) > NO_FLOW) {
      blocked.push({
        x: mid.x - head - 1,
        y: mid.y - head - 1,
        width: 2 * head + 2,
        height: 2 * head + 2,
      });
    }
    // Less text on short pipes; zooming in brings it back.
    const id: LabelLine = { text: pipe.id, className: 'netview__label-id' };
    const variants: LabelLine[][] = [[id]];
    if (length >= SHORT_LABEL) variants.unshift([id, { text: `DN ${dn}` }]);
    if (length >= FULL_LABEL) {
      const full: LabelLine[] = [{ text: `${pipe.id} · DN ${dn}`, className: 'netview__label-id' }];
      if (pipeResult) {
        const mark =
          status === 'low'
            ? ` · ${tr(text.lowVelocityMark)}`
            : status === 'high'
              ? ` · ${tr(text.highVelocityMark)}`
              : '';
        full.push({
          text: `${num(m3sToLps(Math.abs(pipeResult.flow)))} L/s${mark}`,
          className: `netview__result netview__result--${status}`,
        });
      }
      variants.unshift(full);
    }
    request('pipe', pipe.id, 30, pipeLabelAnchors(a, b, head + 5, inward), variants);
  }
  const placedLabels = placeLabels(requests, {
    bounds: { x: 2, y: 2, width: size.width - 4, height: size.height - 4 },
    rects: blocked,
    segments,
  });
  const labels = new Map([...placedLabels].map(([id, option]) => [id, option.data]));

  const showResults = result !== undefined;
  const rootClass = ['netview', stale && 'netview--stale'].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      <div className="netview__canvas" ref={canvasRef}>
        <svg
          ref={svgRef}
          className="netview__svg"
          role="group"
          aria-label={tr(text.drawing)}
          aria-describedby={helpId}
          onClick={onClick}
          {...handlers}
        >
          {scenario.pumps.map((pump) => {
            const a = at(pump.from);
            const b = at(pump.to);
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
            const pumpResult = result?.pumps[pump.id];
            const selected = isSelected('pump', pump.id);
            const label = describePump({ tr, num }, pump, pumpResult, stale);
            const placed = labels.get(`pump:${pump.id}`);
            return (
              <g
                key={pump.id}
                className={selected ? 'netview__pump netview__el--selected' : 'netview__pump'}
                data-element="pump"
                data-id={pump.id}
                role="button"
                tabIndex={0}
                aria-label={label}
                aria-pressed={selected}
                onKeyDown={onKeyDown('pump', pump.id)}
              >
                <line className="netview__hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                <circle className="netview__hit" cx={mid.x} cy={mid.y} r={22} />
                <line className="netview__pump-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                <circle className="netview__ring" cx={mid.x} cy={mid.y} r={17} />
                <circle className="netview__pump-body" cx={mid.x} cy={mid.y} r={12} />
                <polygon
                  className="netview__pump-mark"
                  points="-5,-6 7,0 -5,6"
                  transform={`translate(${mid.x} ${mid.y}) rotate(${angle})`}
                />
                {placed && <Label {...placed} />}
              </g>
            );
          })}

          {scenario.pipes.map((pipe) => {
            const a = at(pipe.from);
            const b = at(pipe.to);
            const dn = diameters[pipe.id] ?? pipe.initialDN;
            const width = strokeForDn(dn);
            const pipeResult = result?.pipes[pipe.id];
            const status = pipeStatus[pipe.id] ?? 'none';
            const flow = pipeResult?.flow ?? 0;
            const flowing = Math.abs(flow) > NO_FLOW;
            const reverse = flow < 0;
            const up = reverse ? b : a;
            const down = reverse ? a : b;
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const angle = (Math.atan2(down.y - up.y, down.x - up.x) * 180) / Math.PI;
            const selected = isSelected('pipe', pipe.id);
            const speed = Math.abs(pipeResult?.velocity ?? 0);
            const head = width / 2 + 4;

            const label = describePipe({ tr, num }, pipe, dn, pipeResult, status, stale);
            const placed = labels.get(`pipe:${pipe.id}`);

            const className = [
              'netview__pipe',
              `netview__pipe--${status}`,
              selected && 'netview__el--selected',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <g
                key={pipe.id}
                className={className}
                data-element="pipe"
                data-id={pipe.id}
                data-status={status}
                data-direction={flowing ? (reverse ? 'reverse' : 'forward') : 'none'}
                role="button"
                tabIndex={0}
                aria-label={label}
                aria-pressed={selected}
                onKeyDown={onKeyDown('pipe', pipe.id)}
              >
                <line className="netview__hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                <line
                  className="netview__pipe-halo"
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  strokeWidth={width + 8}
                />
                <line
                  className="netview__pipe-line"
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  strokeWidth={width}
                />
                {flowing && (
                  <line
                    className="netview__flow"
                    x1={up.x}
                    y1={up.y}
                    x2={down.x}
                    y2={down.y}
                    strokeWidth={Math.max(1.5, width * 0.35)}
                    style={{
                      animationDuration: `${(DASH_PERIOD / Math.min(70, 14 + 18 * speed)).toFixed(3)}s`,
                    }}
                  />
                )}
                {flowing && (
                  <polygon
                    className="netview__arrow"
                    points={`${-head},${-head} ${head + 2},0 ${-head},${head}`}
                    transform={`translate(${mid.x} ${mid.y}) rotate(${angle})`}
                  />
                )}
                {placed && <Label {...placed} />}
              </g>
            );
          })}

          {scenario.reservoirs.map((reservoir) => {
            const p = at(reservoir.id);
            const selected = isSelected('reservoir', reservoir.id);
            const label = describeReservoir({ tr, num }, reservoir);
            const placed = labels.get(`reservoir:${reservoir.id}`);
            return (
              <g
                key={reservoir.id}
                className={
                  selected ? 'netview__reservoir netview__el--selected' : 'netview__reservoir'
                }
                data-element="reservoir"
                data-id={reservoir.id}
                role="button"
                tabIndex={0}
                aria-label={label}
                aria-pressed={selected}
                onKeyDown={onKeyDown('reservoir', reservoir.id)}
              >
                <rect className="netview__hit" x={p.x - 22} y={p.y - 22} width={44} height={44} />
                <rect
                  className="netview__ring"
                  x={p.x - 21}
                  y={p.y - 18}
                  width={42}
                  height={34}
                  rx={5}
                />
                <rect
                  className="netview__reservoir-water"
                  x={p.x - 15}
                  y={p.y - 5}
                  width={30}
                  height={15}
                />
                <path
                  className="netview__reservoir-tank"
                  d={`M${p.x - 15} ${p.y - 12}V${p.y + 10}H${p.x + 15}V${p.y - 12}`}
                />
                {placed && <Label {...placed} />}
              </g>
            );
          })}

          {scenario.nodes.map((node) => {
            const p = at(node.id);
            const nodeResult = result?.nodes[node.id];
            const state = nodeStatus[node.id];
            const status = state?.status ?? 'none';
            const selected = isSelected('node', node.id);
            const failing = status === 'low' || status === 'high';
            const label = [
              tr(text.node(node.id)),
              `${tr(text.demand)} ${num(node.demandLps)} L/s`,
              nodeResult && `${tr(text.pressure)} ${num(nodeResult.pressure)} ${HEAD_UNIT}`,
              nodeResult && state?.low && tr(pressureStatusLabels.low),
              nodeResult && state?.high && tr(pressureStatusLabels.high),
              nodeResult && !failing && tr(pressureStatusLabels[status]),
              nodeResult && stale && tr(text.outdated),
            ]
              .filter(Boolean)
              .join(', ');
            const placed = labels.get(`node:${node.id}`);
            const className = [
              'netview__node',
              `netview__node--${status}`,
              selected && 'netview__el--selected',
            ]
              .filter(Boolean)
              .join(' ');
            const radius = failing ? NODE_RADIUS + 2 : NODE_RADIUS;
            return (
              <g
                key={node.id}
                className={className}
                data-element="node"
                data-id={node.id}
                data-status={status}
                role="button"
                tabIndex={0}
                aria-label={label}
                aria-pressed={selected}
                onKeyDown={onKeyDown('node', node.id)}
              >
                <circle className="netview__hit" cx={p.x} cy={p.y} r={22} />
                <circle className="netview__ring" cx={p.x} cy={p.y} r={radius + 5} />
                <circle className="netview__node-dot" cx={p.x} cy={p.y} r={radius} />
                {failing && <StatusGlyph at={p} status={status} />}
                {placed && <Label {...placed} />}
              </g>
            );
          })}
        </svg>

        <p id={helpId} className="visually-hidden">
          {tr(text.drawingHelp)}
        </p>

        {hint && (
          <p className="netview__hint" role="status">
            <span className={stale ? 'badge badge--warn' : 'badge badge--info'}>
              {stale && <IconStale />}
              {tr(hint)}
            </span>
          </p>
        )}

        <ZoomControls onZoom={zoomBy} onFit={reset} />
        {phone && <Legend checks={scenario.checks} evaluated={showResults} collapsed />}
      </div>

      <SelectionBar />

      {!phone && <Legend checks={scenario.checks} evaluated={showResults} />}
    </div>
  );
}
