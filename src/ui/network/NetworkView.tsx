import { useId, useMemo, type KeyboardEvent, type MouseEvent } from 'react';
import { useTr } from '../../i18n';
import type { Scenario } from '../../scenarios/types';
import { useAppStore, type Selection } from '../../state/store';
import { TermScope } from '../glossary/TermScope';
import { useCoarsePointer, usePhone } from '../shell/breakpoints';
import { describePipe, describePump, describeReservoir, NO_FLOW } from './describe';
import { useNum } from './format';
import { strokeForDn, toScreen, worldPositions, type Point } from './geometry';
import { HIT_PRIORITY, NODE_CLAIM, resolveHit, trimSegment, type HitTarget } from './hit';
import { LegendHelp, LegendIcons } from './Legend';
import { layoutMap, type Obstacle, type WorldBox } from './mapLayout';
import {
  arrowHead,
  LINE_HEIGHT,
  NODE_RADIUS,
  schematicLabels,
  type SchematicLabel,
} from './schematicLabels';
import { PipeMark } from './PipeMark';
import { nodeStatuses, pipeStatuses } from './status';
import { HEAD_UNIT, networkStrings as text, pressureStatusLabels } from './strings';
import { usePanZoom } from './usePanZoom';
import { ControlStrip, MapFoot } from './ViewControls';
import './network.css';

type ElementType = NonNullable<Selection>['type'];

/** Length of one dash plus one gap of the flow animation, px. Must match network.css. */
const DASH_PERIOD = 14;
/** Radius (px) of the invisible hit area of a node, reservoir or pump. */
const HIT_RADIUS = 22;

/** Free space (px) around the network on each side of the canvas, where the labels go. */
export function schematicPadding(size: { width: number; height: number }): Point {
  const narrow = size.width < 480;
  // A short canvas (a phone lying down) cannot spare more.
  return { x: narrow ? 30 : 72, y: size.height < 260 ? 24 : narrow ? 30 : 56 };
}

/** Extent of the nodes and reservoirs of a scenario, plan coordinates. */
export function schematicBounds(scenario: Scenario): WorldBox {
  const points = [...scenario.nodes, ...scenario.reservoirs];
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return {
    minX: Math.min(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

/**
 * What the schematic draws, with its hit areas, for the fit: none of it may end up under the
 * controls. `coarse` widens the pipes to their 44 px touch target.
 */
export function schematicObstacles(scenario: Scenario, coarse: boolean): Obstacle[] {
  const world = worldPositions(scenario);
  const point = (p: Point): WorldBox => ({ minX: p.x, minY: p.y, maxX: p.x, maxY: p.y });
  const halfPx = coarse ? 22 : 11;
  const obstacles: Obstacle[] = [];
  for (const id of Object.keys(world)) {
    obstacles.push({ kind: 'box', box: point(world[id]!), pad: HIT_RADIUS });
  }
  for (const link of [...scenario.pipes, ...scenario.pumps]) {
    const a = world[link.from];
    const b = world[link.to];
    if (a && b) obstacles.push({ kind: 'segment', a, b, halfWorld: 0, halfPx });
  }
  for (const pump of scenario.pumps) {
    const a = world[pump.from];
    const b = world[pump.to];
    if (!a || !b) continue;
    obstacles.push({
      kind: 'box',
      box: point({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }),
      pad: HIT_RADIUS,
    });
  }
  return obstacles;
}

/** Text of a placed label, centred in its box, with a leader line when it is away. */
function Label({ label }: { label: SchematicLabel }) {
  const { rect, lines, leader } = label;
  const x = rect.x + rect.width / 2;
  const end = leader && {
    x: Math.min(rect.x + rect.width, Math.max(rect.x, leader.x)),
    y: Math.min(rect.y + rect.height, Math.max(rect.y, leader.y)),
  };
  return (
    <>
      {leader && end && (
        <line className="netview__leader" x1={leader.x} y1={leader.y} x2={end.x} y2={end.y} />
      )}
      <text
        className="netview__label"
        textAnchor="middle"
        aria-hidden="true"
        data-label=""
        data-label-kind={label.kind}
        data-label-for={label.id}
        data-leader={leader ? 'true' : undefined}
      >
        {lines.map((line, index) => (
          <tspan key={index} x={x} y={rect.y + 11 + index * LINE_HEIGHT} className={line.className}>
            {line.text}
          </tspan>
        ))}
      </text>
    </>
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
  const selection = useAppStore((s) => s.selection);
  const select = useAppStore((s) => s.select);

  const helpId = useId();
  const phone = usePhone();
  const coarse = useCoarsePointer();
  const { canvasRef, svgRef, size, view, zoomBy, reset, consumeTap, handlers } = usePanZoom();

  const world = useMemo(() => (scenario ? worldPositions(scenario) : {}), [scenario]);
  // On phones the legend help is the fourth control of the strip.
  const slots = phone ? 4 : 3;
  const layout = useMemo(
    () =>
      scenario
        ? layoutMap({
            bounds: schematicBounds(scenario),
            obstacles: schematicObstacles(scenario, coarse),
            size,
            padding: schematicPadding(size),
            slots,
          })
        : null,
    [scenario, coarse, size, slots],
  );
  const nodeStatus = useMemo(
    () => (scenario ? nodeStatuses(evaluation, scenario.checks) : {}),
    [evaluation, scenario],
  );
  const pipeStatus = useMemo(
    () => (scenario ? pipeStatuses(evaluation, scenario.checks) : {}),
    [evaluation, scenario],
  );

  if (!scenario || !layout) return null;

  const { fit } = layout;
  const inward = toScreen(fit.center, fit, view, size);
  const at = (id: string): Point => toScreen(world[id] ?? fit.center, fit, view, size);
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

  // The controls keep their corner in the fitted view; labels stay out of it at any zoom.
  const { labels, marks } = schematicLabels({
    scenario,
    diameters,
    evaluation,
    nodeStatus,
    pipeStatus,
    selection,
    at,
    inward,
    size,
    blocked: [layout.keepClear],
    num,
  });

  const legend = { checks: scenario.checks, evaluated: result !== undefined };
  const rootClass = ['netview', stale && 'netview--stale'].filter(Boolean).join(' ');

  return (
    <TermScope>
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
                  {placed && <Label label={placed} />}
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
              const head = arrowHead(width);
              const mark = marks.get(pipe.id);

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
                  {mark && (status === 'low' || status === 'high') && (
                    <PipeMark at={mark} status={status} />
                  )}
                  {placed && <Label label={placed} />}
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
                  {placed && <Label label={placed} />}
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
                  {placed && <Label label={placed} />}
                </g>
              );
            })}
          </svg>

          <p id={helpId} className="visually-hidden">
            {tr(text.drawingHelp)}
          </p>

          <ControlStrip orientation={layout.orientation} onZoom={zoomBy} onFit={reset}>
            {phone && (
              <span className="netview__ctl-slot" data-overlay-control="legend">
                <LegendHelp {...legend} />
              </span>
            )}
          </ControlStrip>
        </div>

        <MapFoot
          phone={phone}
          legend={<LegendIcons {...legend} />}
          help={<LegendHelp {...legend} className="netview__legend-help" />}
        />
      </div>
    </TermScope>
  );
}
