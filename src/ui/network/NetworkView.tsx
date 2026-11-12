import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { m3sToLps } from '../../engine/units';
import { useTr } from '../../i18n';
import { useAppStore, type Selection } from '../../state/store';
import { IconStale } from '../shell/icons';
import { DnPicker } from './DnPicker';
import { useNum } from './format';
import {
  fitToSize,
  INITIAL_VIEW,
  labelSide,
  nearestDistances,
  pipeLabelAnchor,
  sideAnchor,
  strokeForDn,
  toScreen,
  worldPositions,
  zoomAt,
  type LabelAnchor,
  type Point,
  type Size,
  type View,
} from './geometry';
import { Legend } from './Legend';
import { nodeStatuses, pipeStatuses } from './status';
import {
  HEAD_UNIT,
  networkStrings as text,
  pressureStatusLabels,
  velocityStatusLabels,
} from './strings';
import './network.css';

type ElementType = NonNullable<Selection>['type'];

/** Used until the container is measured (and in tests, where there is no layout). */
const DEFAULT_SIZE: Size = { width: 800, height: 480 };
const NODE_RADIUS = 8;
const LINE_HEIGHT = 14;
/** Pointer travel in px after which a press is a drag and not a click. */
const DRAG_THRESHOLD = 4;
/** Flows below this (m³/s) are drawn as no flow. */
const NO_FLOW = 1e-7;
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

function Label({ at, lines }: { at: LabelAnchor; lines: LabelLine[] }) {
  const count = lines.length;
  const first =
    at.block === 'above'
      ? at.y - 3 - (count - 1) * LINE_HEIGHT
      : at.block === 'below'
        ? at.y + 11
        : at.y + 4 - ((count - 1) * LINE_HEIGHT) / 2;
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
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<Size>(DEFAULT_SIZE);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef({ start: { x: 0, y: 0 }, moved: false });

  useLayoutEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const measure = () => {
      const { clientWidth: width, clientHeight: height } = element;
      if (width > 0 && height > 0) {
        setSize((prev) =>
          prev.width === width && prev.height === height ? prev : { width, height },
        );
      }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // React registers wheel listeners as passive, so the zoom needs a native one to stop the page
  // from scrolling.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      // Pinch on a trackpad arrives as ctrl + wheel with small deltas.
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0015));
      setView((v) => zoomAt(v, factor, anchor, { width: rect.width, height: rect.height }));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const world = useMemo(() => (scenario ? worldPositions(scenario) : {}), [scenario]);
  const nearest = useMemo(() => nearestDistances(world), [world]);
  const fit = useMemo(
    () =>
      fitToSize(Object.values(world), size, {
        x: size.width < 480 ? 36 : 72,
        y: size.width < 480 ? 56 : 64,
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
  const selectedPipe =
    selection?.type === 'pipe' ? scenario.pipes.find((p) => p.id === selection.id) : undefined;

  const onKeyDown = (type: ElementType, id: string) => (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select({ type, id });
    } else if (event.key === 'Escape' && selection) {
      select(null);
    }
  };

  const onClick = (event: MouseEvent<SVGSVGElement>) => {
    if (gesture.current.moved) {
      gesture.current.moved = false;
      return;
    }
    const element = (event.target as Element).closest('[data-element]');
    const type = element?.getAttribute('data-element') as ElementType | undefined;
    const id = element?.getAttribute('data-id');
    select(type && id ? { type, id } : null);
  };

  const localPoint = (event: PointerEvent<SVGSVGElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const point = localPoint(event);
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size === 1) gesture.current = { start: point, moved: false };
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const point = localPoint(event);
    const others = [...pointers.current.entries()].filter(([id]) => id !== event.pointerId);
    pointers.current.set(event.pointerId, point);

    if (others.length === 0) {
      const { start } = gesture.current;
      if (!gesture.current.moved) {
        if (Math.hypot(point.x - start.x, point.y - start.y) < DRAG_THRESHOLD) return;
        gesture.current.moved = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }
      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      return;
    }

    // Pinch: zoom by the change in distance between two fingers and follow their midpoint.
    const other = others[0]![1];
    const before = Math.hypot(previous.x - other.x, previous.y - other.y);
    const after = Math.hypot(point.x - other.x, point.y - other.y);
    const midBefore = { x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2 };
    const midAfter = { x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 };
    gesture.current.moved = true;
    if (before > 0 && after > 0) {
      setView((v) => {
        const panned = {
          ...v,
          x: v.x + midAfter.x - midBefore.x,
          y: v.y + midAfter.y - midBefore.y,
        };
        return zoomAt(panned, after / before, midAfter, size);
      });
    }
  };

  const onPointerEnd = (event: PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId);
  };

  const zoomBy = (factor: number) =>
    setView((v) => zoomAt(v, factor, { x: size.width / 2, y: size.height / 2 }, size));

  const hint = stale ? text.staleHint : !evaluation && !solving ? text.notSolvedHint : null;
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
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          {scenario.pumps.map((pump) => {
            const a = at(pump.from);
            const b = at(pump.to);
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
            const pumpResult = result?.pumps[pump.id];
            const selected = isSelected('pump', pump.id);
            const label = [
              tr(text.pump(pump.id)),
              pumpResult &&
                `${tr(text.flow)} ${num(m3sToLps(pumpResult.flow))} L/s, ${tr(text.head)} ${num(pumpResult.head)} m`,
              pumpResult && stale && tr(text.outdated),
            ]
              .filter(Boolean)
              .join(', ');
            const lines: LabelLine[] = [{ text: pump.id, className: 'netview__label-id' }];
            if (pumpResult) {
              lines.push({ text: `H ${num(pumpResult.head, 1)} m`, className: 'netview__result' });
            }
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
                <line className="netview__pump-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                <circle className="netview__ring" cx={mid.x} cy={mid.y} r={17} />
                <circle className="netview__pump-body" cx={mid.x} cy={mid.y} r={12} />
                <polygon
                  className="netview__pump-mark"
                  points="-5,-6 7,0 -5,6"
                  transform={`translate(${mid.x} ${mid.y}) rotate(${angle})`}
                />
                <Label at={sideAnchor(mid, 'n', 18)} lines={lines} />
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
            const length = Math.hypot(b.x - a.x, b.y - a.y);
            const selected = isSelected('pipe', pipe.id);
            const speed = Math.abs(pipeResult?.velocity ?? 0);
            const head = width / 2 + 4;

            const label = [
              tr(text.pipe(pipe.id)),
              `DN ${dn} mm`,
              pipe.fixed && tr(text.fixedDiameter),
              pipeResult && `${tr(text.flow)} ${num(m3sToLps(Math.abs(flow)))} L/s`,
              pipeResult && `${tr(text.velocity)} ${num(speed)} m/s`,
              pipeResult &&
                (flowing
                  ? tr(
                      reverse
                        ? text.flowFromTo(pipe.to, pipe.from)
                        : text.flowFromTo(pipe.from, pipe.to),
                    )
                  : tr(text.noFlow)),
              pipeResult && status !== 'none' && tr(velocityStatusLabels[status]),
              pipeResult && stale && tr(text.outdated),
            ]
              .filter(Boolean)
              .join(', ');

            // Less text on short pipes; zooming in brings it back.
            const lines: LabelLine[] = [];
            if (length >= FULL_LABEL) {
              lines.push({ text: `${pipe.id} · DN ${dn}`, className: 'netview__label-id' });
              if (pipeResult) {
                const mark =
                  status === 'low'
                    ? ` · ${tr(text.lowVelocityMark)}`
                    : status === 'high'
                      ? ` · ${tr(text.highVelocityMark)}`
                      : '';
                lines.push({
                  text: `${num(m3sToLps(Math.abs(flow)))} L/s${mark}`,
                  className: `netview__result netview__result--${status}`,
                });
              }
            } else if (length >= SHORT_LABEL) {
              lines.push({ text: pipe.id, className: 'netview__label-id' });
              lines.push({ text: `DN ${dn}` });
            } else {
              lines.push({ text: pipe.id, className: 'netview__label-id' });
            }

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
                <Label at={pipeLabelAnchor(a, b, head + 5, inward)} lines={lines} />
              </g>
            );
          })}

          {scenario.reservoirs.map((reservoir) => {
            const p = at(reservoir.id);
            const selected = isSelected('reservoir', reservoir.id);
            const label = `${tr(text.reservoir(reservoir.id))}, ${tr(text.waterLevel)} ${num(reservoir.waterLevel)} m`;
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
                <Label
                  at={sideAnchor(p, labelSide(p, neighbours(reservoir.id)), 22)}
                  lines={[
                    { text: reservoir.id, className: 'netview__label-id' },
                    {
                      text: `${tr(text.waterLevelShort)} ${num(reservoir.waterLevel, 1)} m`,
                    },
                  ]}
                />
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
            const lines: LabelLine[] = [{ text: node.id, className: 'netview__label-id' }];
            if (nodeResult && (nearest[node.id] ?? Infinity) * scale >= SHORT_LABEL) {
              lines.push({
                text: `${num(nodeResult.pressure, 1)} ${HEAD_UNIT}`,
                className: `netview__result netview__result--${status}`,
              });
            }
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
                <circle className="netview__hit" cx={p.x} cy={p.y} r={20} />
                <circle className="netview__ring" cx={p.x} cy={p.y} r={radius + 5} />
                <circle className="netview__node-dot" cx={p.x} cy={p.y} r={radius} />
                {failing && <StatusGlyph at={p} status={status} />}
                <Label
                  at={sideAnchor(p, labelSide(p, neighbours(node.id)), radius + 8)}
                  lines={lines}
                />
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

        <div className="netview__zoom" role="group" aria-label={tr(text.zoomControls)}>
          <button
            type="button"
            className="btn btn--sm btn--icon"
            aria-label={tr(text.zoomIn)}
            title={tr(text.zoomIn)}
            onClick={() => zoomBy(1.4)}
          >
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button
            type="button"
            className="btn btn--sm btn--icon"
            aria-label={tr(text.zoomOut)}
            title={tr(text.zoomOut)}
            onClick={() => zoomBy(1 / 1.4)}
          >
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14" />
            </svg>
          </button>
          <button
            type="button"
            className="btn btn--sm btn--icon"
            aria-label={tr(text.fit)}
            title={tr(text.fit)}
            onClick={() => setView(INITIAL_VIEW)}
          >
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
            </svg>
          </button>
        </div>
      </div>

      <div className="netview__bar">
        {selectedPipe ? (
          <>
            <span className="netview__bar-title">
              {tr(text.pipe(selectedPipe.id))}
              <span className="muted num"> · {num(selectedPipe.length, 0)} m · DN</span>
            </span>
            <DnPicker pipeId={selectedPipe.id} compact />
          </>
        ) : (
          <span className="muted">{tr(text.selectHint)}</span>
        )}
      </div>

      <Legend checks={scenario.checks} evaluated={showResults} />
    </div>
  );
}
