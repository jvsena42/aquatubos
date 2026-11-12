import { useId } from 'react';
import { NBR_CHECK_LIMITS } from '../../engine/config/nbr12218';
import { m3sToLps } from '../../engine/units';
import { HEAD_UNIT } from '../../game/resultsTable';
import { useFormat, useTr } from '../../i18n';
import { useAppStore } from '../../state/store';
import { ResultBody, ResultHint } from '../charts/ResultState';
import { linearScale, niceAxis, polyline } from '../charts/scale';
import { useChartWidth } from '../charts/useChartWidth';
import { Term } from '../glossary/Term';
import { IconCheck, IconError } from '../shell/icons';
import { pumpStrings as s } from './PumpChart.strings';
import './PumpChart.css';

/** A margin smaller than this (m) counts as zero, like the checks do. */
const MARGIN_TOLERANCE = 1e-6;

/**
 * Pump curve against the system curve, with the operating point of the solved network, the
 * head required at that flow and the margin between the two.
 */
export function PumpChart() {
  const tr = useTr();
  const fmt = useFormat();
  const scenario = useAppStore((state) => state.scenario);
  const evaluation = useAppStore((state) => state.evaluation);
  const summaryId = useId();
  const clipId = useId();
  const [frameRef, width] = useChartWidth();

  if (!scenario) return null;
  if (!evaluation) return <ResultHint />;
  const chart = evaluation.pumpChart;
  if (!chart || chart.points.length < 2) return <ResultHint>{tr(s.noPump)}</ResultHint>;

  const { curve, points, operating, requiredHead } = chart;
  const catalogue = scenario.pumps.find((pump) => pump.id === chart.pumpId)?.points ?? [];
  const margin = operating.head - requiredHead;
  const ok = margin >= -MARGIN_TOLERANCE;
  const limitText = `${fmt(NBR_CHECK_LIMITS.minDynamicPressure, 0)} ${tr(HEAD_UNIT)}`;

  const flowText = fmt(m3sToLps(operating.flow), 2);
  const headText = fmt(operating.head, 2);
  const requiredText = fmt(requiredHead, 2);
  const marginText = fmt(Math.abs(margin), 2);
  const verdict = ok
    ? tr(s.verdictOk(flowText, headText, requiredText, marginText))
    : tr(s.verdictFail(flowText, headText, requiredText, marginText, limitText));

  // Geometry
  const narrow = width < 520;
  const height = narrow ? 320 : 400;
  const pad = { top: 28, right: narrow ? 14 : 24, bottom: 46, left: 46 };
  const plot = { x0: pad.left, x1: width - pad.right, y0: pad.top, y1: height - pad.bottom };

  const maxFlow = m3sToLps(points[points.length - 1]!.flow);
  // The system curve can rise far above the pump curve; the scale stops at three times the
  // shutoff head so the pump curve stays readable.
  const shutoff = curve.a;
  const top = Math.max(shutoff, Math.min(Math.max(requiredHead, operating.head), 3 * shutoff));
  const xAxis = niceAxis(0, maxFlow, narrow ? 5 : 8);
  const yAxis = niceAxis(0, top * 1.08, narrow ? 5 : 7);
  const x = linearScale([0, maxFlow], [plot.x0, plot.x1]);
  const y = linearScale([0, yAxis.max], [plot.y1, plot.y0]);

  const pumpLine = points.map((p) => [x(m3sToLps(p.flow)), y(p.pumpHead)] as const);
  const systemLine = points.map((p) => [x(m3sToLps(p.flow)), y(p.systemHead)] as const);

  const opX = x(m3sToLps(operating.flow));
  const opY = y(operating.head);
  const requiredOffScale = requiredHead > yAxis.max;
  const reqY = requiredOffScale ? plot.y0 : y(requiredHead);
  const labelOnLeft = opX > (plot.x0 + plot.x1) * 0.6;
  const marginLabel = ok ? tr(s.marginLabel(`+${marginText}`)) : tr(s.shortfallLabel(marginText));

  return (
    <ResultBody className="pump">
      <div className={`pump__verdict pump__verdict--${ok ? 'ok' : 'fail'}`}>
        <span className={ok ? 'badge badge--ok' : 'badge badge--danger'}>
          {ok ? <IconCheck /> : <IconError />}
          {tr(ok ? s.statusOk : s.statusFail)}
        </span>
        <p id={summaryId}>{verdict}</p>
      </div>

      <div ref={frameRef} className="chart pump__chart">
        <svg
          className="chart__svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={tr(s.chartTitle(chart.pumpId))}
          aria-describedby={summaryId}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={plot.x0} y={plot.y0} width={plot.x1 - plot.x0} height={plot.y1 - plot.y0} />
            </clipPath>
          </defs>

          {yAxis.ticks.map((tick) => (
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
          {xAxis.ticks
            .filter((tick) => tick <= maxFlow)
            .map((tick) => (
              <g key={tick}>
                <line
                  className="chart__axis"
                  x1={x(tick)}
                  x2={x(tick)}
                  y1={plot.y1}
                  y2={plot.y1 + 4}
                />
                <text className="chart__tick" x={x(tick)} y={plot.y1 + 16} textAnchor="middle">
                  {fmt(tick, xAxis.digits)}
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
          <line className="chart__axis" x1={plot.x0} x2={plot.x0} y1={plot.y0} y2={plot.y1} />
          <line className="chart__axis" x1={plot.x0} x2={plot.x1} y1={plot.y1} y2={plot.y1} />

          <line className="pump__guide" x1={opX} x2={opX} y1={plot.y1} y2={Math.min(opY, reqY)} />

          <g clipPath={`url(#${clipId})`}>
            <polyline className="pump__system" points={polyline(systemLine)} />
            <polyline className="pump__curve" points={polyline(pumpLine)} />
          </g>

          {catalogue.map((point, index) => (
            <rect
              key={index}
              className="pump__catalogue"
              x={x(point.flowLps) - 4.5}
              y={y(point.head) - 4.5}
              width={9}
              height={9}
            />
          ))}

          <line
            className={`pump__margin pump__margin--${ok ? 'ok' : 'fail'}`}
            x1={opX}
            x2={opX}
            y1={opY}
            y2={reqY}
          />
          {requiredOffScale ? (
            <path
              className="pump__required"
              d={`M${opX - 6},${plot.y0 + 8} L${opX},${plot.y0} L${opX + 6},${plot.y0 + 8}`}
            />
          ) : (
            <path
              className="pump__required"
              d={`M${opX},${reqY - 6.5} L${opX + 6.5},${reqY} L${opX},${reqY + 6.5} L${opX - 6.5},${reqY} Z`}
            />
          )}
          <circle className="pump__operating" cx={opX} cy={opY} r={5} />
          <text
            className={`chart__label pump__margin-label pump__margin-label--${ok ? 'ok' : 'fail'}`}
            x={labelOnLeft ? opX - 12 : opX + 12}
            y={Math.max((opY + reqY) / 2, plot.y0 + 10) - (ok ? 16 : 0)}
            dy="0.32em"
            textAnchor={labelOnLeft ? 'end' : 'start'}
          >
            {marginLabel}
          </text>
        </svg>
      </div>

      <ul className="chart__legend" aria-hidden="true">
        <li>
          <svg viewBox="0 0 28 12">
            <line className="pump__curve" x1="0" x2="28" y1="6" y2="6" />
          </svg>
          {tr(s.legendPump)}
        </li>
        <li>
          <svg viewBox="0 0 28 12">
            <line className="pump__system" x1="0" x2="28" y1="6" y2="6" />
          </svg>
          {tr(s.legendSystem)}
        </li>
        <li>
          <svg viewBox="0 0 28 12">
            <rect className="pump__catalogue" x="9.5" y="1.5" width="9" height="9" />
          </svg>
          {tr(s.legendCatalogue)}
        </li>
        <li>
          <svg viewBox="0 0 28 12">
            <circle className="pump__operating" cx="14" cy="6" r="5" />
          </svg>
          {tr(s.legendOperating)}
        </li>
        <li>
          <svg viewBox="0 0 28 12">
            <path className="pump__required" d="M14,0 L20,6 L14,12 L8,6 Z" />
          </svg>
          {tr(s.legendRequired)}
        </li>
        <li>
          <svg viewBox="0 0 28 12">
            <line
              className={`pump__margin pump__margin--${ok ? 'ok' : 'fail'}`}
              x1="14"
              x2="14"
              y1="0"
              y2="12"
            />
          </svg>
          {tr(ok ? s.legendMargin : s.legendShortfall)}
        </li>
      </ul>

      <dl className="pump__facts">
        <div>
          <dt>{tr(s.flow)}</dt>
          <dd className="num">{flowText} L/s</dd>
        </div>
        <div>
          <dt>{tr(s.pumpHead)}</dt>
          <dd className="num">{headText} m</dd>
        </div>
        <div>
          <dt>{tr(s.requiredHead)}</dt>
          <dd className="num">{requiredText} m</dd>
        </div>
        <div>
          <dt>{tr(s.margin)}</dt>
          <dd className={`num pump__fact--${ok ? 'ok' : 'fail'}`}>
            {ok ? '+' : '−'}
            {marginText} m
          </dd>
        </div>
      </dl>

      <section className="pump__equation">
        <h3>{tr(s.equationTitle)}</h3>
        <p>
          <span className="num pump__formula">
            H = {fmt(curve.a, 2)} − {fmt(curve.b, 0)}·Q<sup>{fmt(curve.c, 3)}</sup>
          </span>{' '}
          <span className="muted">{tr(s.equationUnits)}</span>
        </p>
        <p className="muted">
          {tr(s.cataloguePoints)}:{' '}
          <span className="num">
            {catalogue
              .map((point) => `(${fmt(point.flowLps, 1)} L/s; ${fmt(point.head, 1)} m)`)
              .join(' ')}
          </span>
        </p>
      </section>

      <p className="pump__notes">
        {requiredOffScale && <strong>{tr(s.offScale)} </strong>}
        {tr(s.explanation(limitText))}
      </p>
      <p className="pump__terms">
        <Term id="pumpCurve" /> · <Term id="systemCurve" /> · <Term id="operatingPoint" />
      </p>

      <div className="visually-hidden">
        <table>
          <caption>{tr(s.tableCaption)}</caption>
          <thead>
            <tr>
              <th scope="col">{tr(s.tableFlow)}</th>
              <th scope="col">{tr(s.tablePump)}</th>
              <th scope="col">{tr(s.tableSystem)}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point, index) => (
              <tr key={index}>
                <td>{fmt(m3sToLps(point.flow), 2)}</td>
                <td>{fmt(point.pumpHead, 2)}</td>
                <td>{fmt(point.systemHead, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ResultBody>
  );
}
