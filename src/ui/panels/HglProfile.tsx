import { Fragment, useId, useState, type MouseEvent } from 'react';
import { NBR_CHECK_LIMITS } from '../../engine/config/nbr12218';
import { useFormat, useTr } from '../../i18n';
import { buildProfile, profilePathTo, type ProfilePoint } from '../../game/profile';
import { HEAD_UNIT } from '../../game/resultsTable';
import { useAppStore } from '../../state/store';
import { ResultBody, ResultHint } from '../charts/ResultState';
import {
  linearScale,
  nearestIndex,
  niceAxis,
  polyline,
  thinTicks,
  tickLabelWidth,
  tickTarget,
} from '../charts/scale';
import { useChartSize } from '../charts/useChartWidth';
import { Term } from '../glossary/Term';
import { profileStrings as s } from './HglProfile.strings';
import './HglProfile.css';

const MIN_PRESSURE = NBR_CHECK_LIMITS.minDynamicPressure;

/** Approximate width of one character of a node label, px. */
const LABEL_CHAR = 6.8;
/** Height of a label (two lines of text), px. */
const LABEL_HEIGHT = 28;
/** Radius of the touch target of a node, px: 44 px across. */
const HIT_RADIUS = 22;

type Pair = readonly [number, number];

/**
 * Longitudinal profile from the reservoir to a node: ground, pipe, hydraulic grade line,
 * static level and the minimum-pressure guide, with the values of each node.
 */
export function HglProfile() {
  const tr = useTr();
  const fmt = useFormat();
  const scenario = useAppStore((state) => state.scenario);
  const evaluation = useAppStore((state) => state.evaluation);
  const selection = useAppStore((state) => state.selection);
  const select = useAppStore((state) => state.select);

  const selectId = useId();
  const summaryId = useId();
  const clipId = useId();
  const [frameRef, { width, height }] = useChartSize();
  const [chosenEnd, setChosenEnd] = useState<string | null>(null);
  // The readout shows the node under the mouse and otherwise the last one that was tapped,
  // clicked or focused, which stays until another one is chosen.
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const activeId = hoverId ?? pinnedId;

  if (!scenario) return null;
  if (!evaluation) return <ResultHint />;

  const defaultEnd = scenario.profilePath[scenario.profilePath.length - 1];
  const endId =
    chosenEnd !== null && scenario.nodes.some((n) => n.id === chosenEnd) ? chosenEnd : defaultEnd;
  const path = endId === undefined ? null : profilePathTo(scenario, endId);
  const profile = path ? buildProfile(scenario, evaluation, path, MIN_PRESSURE) : null;

  const mca = tr(HEAD_UNIT);
  const limitText = `${fmt(MIN_PRESSURE, 0)} ${mca}`;

  const picker = (
    <div className="field profile__picker">
      <label htmlFor={selectId}>{tr(s.endNode)}</label>
      <select
        id={selectId}
        className="select"
        value={endId ?? ''}
        onChange={(event) => {
          setChosenEnd(event.target.value);
          setHoverId(null);
          setPinnedId(null);
        }}
      >
        {scenario.nodes.map((node) => (
          <option key={node.id} value={node.id}>
            {node.id}
          </option>
        ))}
      </select>
    </div>
  );

  if (!profile || profile.points.length < 2) {
    return (
      <div className="profile">
        {picker}
        <ResultHint>{tr(s.noPath)}</ResultHint>
      </div>
    );
  }

  const { points, segments, totalLength } = profile;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const junctions = points.filter((p) => p.kind === 'node');
  const critical = junctions.reduce((a, b) => (b.pressure < a.pressure ? b : a), junctions[0]!);
  const below = points.filter((p) => p.belowMin);

  // Geometry
  const narrow = width < 520;
  const margin = { top: 64, right: narrow ? 14 : 24, bottom: 46, left: 46 };
  const plot = {
    x0: margin.left,
    x1: width - margin.right,
    y0: margin.top,
    y1: height - margin.bottom,
  };

  // Vertical range: everything that is drawn, but a grade line far below the ground (negative
  // pressures) is cut so the rest stays readable.
  const tops = points.flatMap((p) => [p.head, p.staticHead ?? p.head, p.minHead ?? p.elevation]);
  const top = Math.max(...tops);
  const ground = Math.min(...points.map((p) => p.elevation));
  const lowestHead = Math.min(...points.map((p) => p.head));
  const span = Math.max(top - ground, 1);
  const floor = Math.max(Math.min(lowestHead, ground), ground - 0.6 * span);
  const clipped = lowestHead < floor;
  // Fewer ticks on a narrow or short chart, so the labels never touch.
  const xLabel = tickLabelWidth(fmt(Math.max(totalLength, 1), 0).length) + 14;
  const yAxis = niceAxis(
    floor - 0.05 * span,
    top + 0.05 * span,
    tickTarget(plot.y1 - plot.y0, 30, 7),
  );
  const xAxis = niceAxis(0, Math.max(totalLength, 1), tickTarget(plot.x1 - plot.x0, xLabel, 7));

  const x = linearScale([0, Math.max(totalLength, 1)], [plot.x0, plot.x1]);
  const y = linearScale([yAxis.min, yAxis.max], [plot.y1, plot.y0]);
  const xTicks = thinTicks(
    xAxis.ticks.filter((tick) => tick <= totalLength),
    x,
    xLabel,
  );
  const yTicks = thinTicks(yAxis.ticks, y, 16);
  const yClamped = (value: number) => Math.min(Math.max(y(value), plot.y0), plot.y1);

  const terrain: Pair[] = points.map((p) => [x(p.distance), y(p.elevation)]);
  const hgl: Pair[] = points.map((p) => [x(p.distance), y(p.head)]);
  const staticLine: Pair[] = points
    .filter((p) => p.staticHead !== null)
    .map((p) => [x(p.distance), y(p.staticHead!)]);
  const minLine: Pair[] = points
    .filter((p) => p.minHead !== null)
    .map((p) => [x(p.distance), y(p.minHead!)]);
  const pipeLine: Pair[] = terrain.map(([px, py]) => [px, py + 5]);
  const terrainArea: Pair[] = [
    ...terrain,
    [x(last.distance), plot.y1],
    [x(first.distance), plot.y1],
  ];

  const pressureText = (point: ProfilePoint) => `${fmt(point.pressure, 1)} ${mca}`;
  const valueText = (point: ProfilePoint) =>
    point.kind === 'reservoir'
      ? `${fmt(point.head, 1)} m`
      : `${y(point.head) > plot.y1 + 0.5 ? '↓ ' : ''}${pressureText(point)}`;

  // Labels: the end node first, then from the left. A label that would run into another one
  // goes one row up; when that row is taken too, it is left out (the values stay available on
  // hover and in the data table).
  const labels = new Map<string, { row: number; x: number; anchor: 'start' | 'middle' | 'end' }>();
  const placed: { from: number; to: number; row: number }[] = [];
  for (const point of [last, ...points]) {
    if (labels.has(point.id)) continue;
    const px = x(point.distance);
    const textWidth = Math.max(point.id.length, valueText(point).length) * LABEL_CHAR + 6;
    // Centred on the node, except next to the edges of the plot.
    const anchor =
      px - textWidth / 2 < plot.x0 ? 'start' : px + textWidth / 2 > plot.x1 ? 'end' : 'middle';
    const from = anchor === 'start' ? px : anchor === 'end' ? px - textWidth : px - textWidth / 2;
    const to = from + textWidth;
    const row = [0, 1].find(
      (candidate) =>
        !placed.some((other) => other.row === candidate && from < other.to && other.from < to),
    );
    if (row === undefined) continue;
    labels.set(point.id, {
      row,
      x: anchor === 'start' ? px + 2 : anchor === 'end' ? px - 2 : px,
      anchor,
    });
    placed.push({ from, to, row });
  }

  const facts = (point: ProfilePoint): string[] => [
    `${tr(point.kind === 'reservoir' ? s.reservoir : s.node)} ${point.id}`,
    `${tr(s.distance)} ${fmt(point.distance, 0)} m`,
    `${tr(s.elevation)} ${fmt(point.elevation, 2)} m`,
    `${tr(s.hgl)} ${fmt(point.head, 2)} m`,
    `${tr(s.pressure)} ${fmt(point.pressure, 2)} ${mca}${point.belowMin ? ` (${tr(s.belowMin)})` : ''}`,
    ...(point.staticHead === null ? [] : [`${tr(s.staticHead)} ${fmt(point.staticHead, 2)} m`]),
  ];
  const describe = (point: ProfilePoint): string => facts(point).join(' · ');

  const choose = (point: ProfilePoint) => {
    setHoverId(null);
    setPinnedId(point.id);
    select({ type: point.kind, id: point.id });
  };
  // A tap anywhere on the plot chooses the node closest to it along the path.
  const chooseNearest = (event: MouseEvent<SVGRectElement>) => {
    const frame = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!frame || !(frame.width > 0)) return;
    const at = ((event.clientX - frame.left) / frame.width) * width;
    const point =
      points[
        nearestIndex(
          points.map((p) => x(p.distance)),
          at,
        )
      ];
    if (point) choose(point);
  };

  const active = points.find((p) => p.id === activeId) ?? null;
  const title = tr(s.chartTitle(first.id, last.id));

  return (
    <ResultBody className="profile">
      <div className="profile__bar">
        {picker}
        <p id={summaryId} className="profile__summary">
          {tr(
            s.summary(
              points.map((p) => p.id).join(' → '),
              fmt(totalLength, 0),
              critical.id,
              pressureText(critical),
            ),
          )}{' '}
          {below.length > 0 && (
            <strong className="profile__alert">{tr(s.belowCount(below.length, limitText))}</strong>
          )}
        </p>
      </div>

      <div ref={frameRef} className="chart profile__chart">
        <svg
          className="chart__svg"
          viewBox={`0 0 ${width} ${height}`}
          role="group"
          aria-label={title}
          aria-describedby={summaryId}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={plot.x0} y={plot.y0} width={plot.x1 - plot.x0} height={plot.y1 - plot.y0} />
            </clipPath>
          </defs>

          <g aria-hidden="true">
            {yTicks.map((tick) => (
              <g key={tick}>
                <line className="chart__grid" x1={plot.x0} x2={plot.x1} y1={y(tick)} y2={y(tick)} />
                <text
                  className="chart__tick"
                  x={plot.x0 - 6}
                  y={y(tick)}
                  dy="0.32em"
                  textAnchor="end"
                >
                  {fmt(tick, yAxis.digits)}
                </text>
              </g>
            ))}
            {xTicks.map((tick) => (
              <g key={tick}>
                <line
                  className="chart__axis"
                  x1={x(tick)}
                  x2={x(tick)}
                  y1={plot.y1}
                  y2={plot.y1 + 4}
                />
                <text className="chart__tick" x={x(tick)} y={plot.y1 + 16} textAnchor="middle">
                  {fmt(tick, 0)}
                </text>
              </g>
            ))}
            <text className="chart__axis-title" x={4} y={12}>
              {tr(s.axisY)}
            </text>
            <text
              className="chart__axis-title"
              x={(plot.x0 + plot.x1) / 2}
              y={height - 6}
              textAnchor="middle"
            >
              {tr(s.axisX)}
            </text>

            <rect
              className="profile__plot"
              x={plot.x0}
              y={0}
              width={plot.x1 - plot.x0}
              height={plot.y1}
              onClick={chooseNearest}
            />
            <g clipPath={`url(#${clipId})`}>
              <polygon className="profile__terrain-fill" points={polyline(terrainArea)} />
              <polyline className="profile__pipe" points={polyline(pipeLine)} />
              <polyline className="profile__terrain" points={polyline(terrain)} />
              {first.kind === 'reservoir' && (
                <rect
                  className="profile__tank"
                  x={x(first.distance)}
                  y={y(first.head)}
                  width={10}
                  height={Math.max(y(first.elevation) - y(first.head), 3)}
                />
              )}
              {points.map((p) => (
                <line
                  key={p.id}
                  className="profile__drop"
                  x1={x(p.distance)}
                  x2={x(p.distance)}
                  y1={y(p.elevation)}
                  y2={y(p.head)}
                />
              ))}
              {minLine.length > 1 && (
                <polyline className="profile__min" points={polyline(minLine)} />
              )}
              {staticLine.length > 1 && (
                <polyline className="profile__static" points={polyline(staticLine)} />
              )}
              <polyline className="profile__hgl" points={polyline(hgl)} />
            </g>
            <line className="chart__axis" x1={plot.x0} x2={plot.x0} y1={plot.y0} y2={plot.y1} />
            <line className="chart__axis" x1={plot.x0} x2={plot.x1} y1={plot.y1} y2={plot.y1} />

            {segments.map((segment, index) => {
              if (segment.kind !== 'pump') return null;
              const from = points[index]!;
              const to = points[index + 1]!;
              return (
                <text
                  key={segment.id}
                  className="chart__label"
                  x={x(to.distance) + 16}
                  y={(yClamped(from.head) + yClamped(to.head)) / 2}
                  dy="0.32em"
                >
                  {tr(s.pumpLabel(segment.id, fmt(segment.headChange, 1)))}
                </text>
              );
            })}
          </g>

          {points.map((p) => {
            const px = x(p.distance);
            const py = yClamped(p.head);
            const offScale = y(p.head) > plot.y1 + 0.5;
            // Off-scale points sit on the bottom edge; their label goes above the ground line.
            const label = labels.get(p.id);
            const labelY =
              (offScale ? Math.min(y(p.elevation), plot.y1) - 26 : py - 24) -
              (label?.row ?? 0) * LABEL_HEIGHT;
            const isActive = activeId === p.id;
            const isSelected =
              (selection?.type === 'node' || selection?.type === 'reservoir') &&
              selection.id === p.id;
            return (
              <g
                key={p.id}
                className={[
                  'profile__node',
                  p.belowMin ? 'profile__node--below' : '',
                  isActive ? 'profile__node--active' : '',
                  isSelected ? 'profile__node--selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                role="button"
                tabIndex={0}
                aria-label={describe(p)}
                aria-pressed={isSelected}
                onMouseEnter={() => setHoverId(p.id)}
                onMouseLeave={() => setHoverId((current) => (current === p.id ? null : current))}
                onFocus={() => setPinnedId(p.id)}
                onClick={() => choose(p)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    choose(p);
                  }
                }}
              >
                <circle className="profile__hit" cx={px} cy={py} r={HIT_RADIUS} />
                <circle className="profile__ring" cx={px} cy={py} r={13} />
                {p.belowMin ? (
                  <path
                    className="profile__marker"
                    d={`M${px},${py - 6.5} L${px + 6.5},${py} L${px},${py + 6.5} L${px - 6.5},${py} Z`}
                  />
                ) : (
                  <circle className="profile__marker" cx={px} cy={py} r={4.5} />
                )}
                {label && (
                  <g aria-hidden="true">
                    <text className="chart__label" x={label.x} y={labelY} textAnchor={label.anchor}>
                      {p.id}
                    </text>
                    <text
                      className="chart__label chart__label--num profile__value"
                      x={label.x}
                      y={labelY + 13}
                      textAnchor={label.anchor}
                    >
                      {valueText(p)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <p className="chart__readout profile__readout" role="status">
        {active ? (
          facts(active).map((fact, index) => (
            <Fragment key={fact}>
              {index > 0 && ' · '}
              <span className={index === 0 ? 'chart__readout-title' : 'chart__readout-item'}>
                {fact}
              </span>
            </Fragment>
          ))
        ) : (
          <span className="muted">{tr(s.hint)}</span>
        )}
      </p>

      <ul className="chart__legend" aria-hidden="true">
        <li>
          <svg viewBox="0 0 28 12">
            <line className="profile__hgl" x1="0" x2="28" y1="6" y2="6" />
          </svg>
          {tr(s.legendHgl)}
        </li>
        <li>
          <svg viewBox="0 0 28 12">
            <line className="profile__static" x1="0" x2="28" y1="6" y2="6" />
          </svg>
          {tr(s.legendStatic)}
        </li>
        <li>
          <svg viewBox="0 0 28 12">
            <line className="profile__min" x1="0" x2="28" y1="6" y2="6" />
          </svg>
          {tr(s.legendMin(limitText))}
        </li>
        <li>
          <svg viewBox="0 0 28 12">
            <rect className="profile__terrain-fill" x="0" y="3" width="28" height="9" />
            <line className="profile__terrain" x1="0" x2="28" y1="3" y2="3" />
          </svg>
          {tr(s.legendTerrain)}
        </li>
        <li>
          <svg viewBox="0 0 28 12">
            <line className="profile__pipe" x1="0" x2="28" y1="6" y2="6" />
          </svg>
          {tr(s.legendPipe)}
        </li>
        <li>
          <svg viewBox="0 0 28 12">
            <circle className="profile__marker" cx="14" cy="6" r="4.5" />
          </svg>
          {tr(s.legendNode)}
        </li>
        <li>
          <svg viewBox="0 0 28 12" className="profile__node--below">
            <path className="profile__marker" d="M14,0 L20,6 L14,12 L8,6 Z" />
          </svg>
          {tr(s.legendBelow)}
        </li>
      </ul>

      <p className="profile__notes">
        {clipped && <span>{tr(s.clipped)} </span>}
        <Term id="hglLine" /> · <Term id="staticPressure" /> · <Term id="dynamicPressure" />
      </p>

      <div className="visually-hidden">
        <table>
          <caption>{tr(s.tableCaption)}</caption>
          <thead>
            <tr>
              <th scope="col">{tr(s.node)}</th>
              <th scope="col">{tr(s.distance)} (m)</th>
              <th scope="col">{tr(s.elevation)} (m)</th>
              <th scope="col">{tr(s.hgl)} (m)</th>
              <th scope="col">
                {tr(s.pressure)} ({mca})
              </th>
              <th scope="col">{tr(s.staticHead)} (m)</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.id}>
                <th scope="row">{p.id}</th>
                <td>{fmt(p.distance, 0)}</td>
                <td>{fmt(p.elevation, 2)}</td>
                <td>{fmt(p.head, 2)}</td>
                <td>
                  {fmt(p.pressure, 2)}
                  {p.belowMin ? ` (${tr(s.belowMin)})` : ''}
                </td>
                <td>{p.staticHead === null ? '–' : fmt(p.staticHead, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ResultBody>
  );
}
