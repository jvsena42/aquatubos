import type { ReactNode } from 'react';
import { useFormat, useTr } from '../../i18n';
import {
  csvFileName,
  HEAD_UNIT,
  nodeTableRows,
  pipeTableCsv,
  pipeTableRows,
  type LimitFlag,
} from '../../game/resultsTable';
import { useAppStore } from '../../state/store';
import { ResultBody, ResultHint } from '../charts/ResultState';
import { Term } from '../glossary/Term';
import { IconError, IconWarning } from '../shell/icons';
import { flagSeverityLabels, resultsStrings as s } from './ResultsTable.strings';
import './ResultsTable.css';

function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

interface ValueCellProps {
  value: string;
  flag?: LimitFlag | null;
  /** Unit and decimals used to write the limit in the explanation of the flag. */
  unit?: string;
}

/** Numeric cell. A value outside a limit gets an icon and a text, not only a colour. */
function ValueCell({ value, flag, unit = '' }: ValueCellProps) {
  const tr = useTr();
  const fmt = useFormat();
  if (!flag) return <td className="num">{value}</td>;
  const limit = `${fmt(flag.limit, 2)} ${unit}`.trim();
  const reason = tr(flag.kind === 'low' ? s.belowLimit(limit) : s.aboveLimit(limit));
  const label = `${tr(flagSeverityLabels[flag.severity])}: ${reason}`;
  return (
    <td className={`num results__cell results__cell--${flag.severity}`} title={label}>
      <span className="results__flag">
        {flag.severity === 'error' ? <IconError /> : <IconWarning />}
        <span className="visually-hidden">{label}</span>
      </span>
      {value}
    </td>
  );
}

function Head({ children, unit }: { children: ReactNode; unit?: string }) {
  return (
    <>
      {children}
      {unit && (
        <>
          {' '}
          <span className="results__unit">({unit})</span>
        </>
      )}
    </>
  );
}

/**
 * NBR-style calculation sheet: one row per pipe and a second table per node. Clicking a row
 * selects the element in the store. The pipe table can be exported as CSV.
 */
export function ResultsTable() {
  const tr = useTr();
  const fmt = useFormat();
  const lang = useAppStore((state) => state.lang);
  const scenario = useAppStore((state) => state.scenario);
  const evaluation = useAppStore((state) => state.evaluation);
  const selection = useAppStore((state) => state.selection);
  const select = useAppStore((state) => state.select);

  if (!scenario) return null;
  const pipes = evaluation ? pipeTableRows(scenario, evaluation) : [];
  const nodes = evaluation ? nodeTableRows(scenario, evaluation) : [];
  if (!evaluation || pipes.length === 0) return <ResultHint />;

  const mca = tr(HEAD_UNIT);
  const flags = [
    ...pipes.flatMap((row) => [row.velocityFlag, row.pressureUpFlag, row.pressureDownFlag]),
    ...nodes.flatMap((row) => [row.pressureFlag, row.staticFlag]),
  ];
  const hasError = flags.some((flag) => flag?.severity === 'error');
  const hasWarning = flags.some((flag) => flag?.severity === 'warning');
  const hasReversed = pipes.some((row) => row.reversed);

  return (
    <ResultBody className="results">
      <section className="results__section">
        <div className="results__bar">
          <h3>{tr(s.pipesTitle)}</h3>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => downloadText(csvFileName(scenario.id), pipeTableCsv(pipes, lang))}
          >
            {tr(s.exportCsv)}
          </button>
        </div>
        <div className="table-wrap results__wrap">
          <table className="table results__table">
            <caption className="visually-hidden">{tr(s.pipesCaption)}</caption>
            <thead>
              <tr>
                <th scope="col" rowSpan={2} className="results__corner">
                  {tr(s.pipe)}
                </th>
                <th scope="colgroup" colSpan={2}>
                  {tr(s.node)}
                </th>
                <th scope="col" rowSpan={2} className="num">
                  <Head unit="m">{tr(s.length)}</Head>
                </th>
                <th scope="col" rowSpan={2} className="num">
                  <Head unit="L/s">
                    <Term id="flow">{tr(s.flow)}</Term>
                  </Head>
                </th>
                <th scope="col" rowSpan={2} className="num">
                  <Head unit="mm">
                    <Term id="dn">DN</Term>
                  </Head>
                </th>
                <th scope="col" rowSpan={2} className="num">
                  <Head unit="m/s">{tr(s.velocity)}</Head>
                </th>
                <th scope="col" rowSpan={2} className="num">
                  <Head unit="m/km">
                    <Term id="unitHeadLoss">{tr(s.unitHeadLoss)}</Term>
                  </Head>
                </th>
                <th scope="col" rowSpan={2} className="num">
                  <Head unit="m">
                    <Term id="headLoss">{tr(s.headLoss)}</Term>
                  </Head>
                </th>
                <th scope="colgroup" colSpan={2}>
                  <Head unit="m">
                    <Term id="hgl">{tr(s.hgl)}</Term>
                  </Head>
                </th>
                <th scope="colgroup" colSpan={2}>
                  <Head unit="m">{tr(s.elevation)}</Head>
                </th>
                <th scope="colgroup" colSpan={2}>
                  <Head unit={mca}>
                    <Term id="dynamicPressure">{tr(s.pressure)}</Term>
                  </Head>
                </th>
              </tr>
              <tr>
                <th scope="col">{tr(s.upstream)}</th>
                <th scope="col">{tr(s.downstream)}</th>
                <th scope="col" className="num">
                  {tr(s.upstream)}
                </th>
                <th scope="col" className="num">
                  {tr(s.downstream)}
                </th>
                <th scope="col" className="num">
                  {tr(s.upstream)}
                </th>
                <th scope="col" className="num">
                  {tr(s.downstream)}
                </th>
                <th scope="col" className="num">
                  {tr(s.upstream)}
                </th>
                <th scope="col" className="num">
                  {tr(s.downstream)}
                </th>
              </tr>
            </thead>
            <tbody>
              {pipes.map((row) => (
                <tr
                  key={row.id}
                  aria-selected={selection?.type === 'pipe' && selection.id === row.id}
                  onClick={() => select({ type: 'pipe', id: row.id })}
                >
                  <th scope="row" className="results__id">
                    <button type="button" className="results__rowbtn num">
                      {row.id}
                    </button>
                    {row.reversed && (
                      <span
                        className="results__reversed"
                        title={tr(s.reversed(row.upstream, row.downstream))}
                      >
                        <span aria-hidden="true">⇄</span>
                        <span className="visually-hidden">
                          {tr(s.reversed(row.upstream, row.downstream))}
                        </span>
                      </span>
                    )}
                  </th>
                  <td className="num">{row.upstream}</td>
                  <td className="num">{row.downstream}</td>
                  <td className="num">{fmt(row.length, 1)}</td>
                  <td className="num">{fmt(row.flow, 3)}</td>
                  <td className="num">{fmt(row.dn, 0)}</td>
                  <ValueCell value={fmt(row.velocity, 2)} flag={row.velocityFlag} unit="m/s" />
                  <td className="num">{fmt(row.unitHeadLoss, 2)}</td>
                  <td className="num">{fmt(row.headLoss, 2)}</td>
                  <td className="num">{fmt(row.headUp, 2)}</td>
                  <td className="num">{fmt(row.headDown, 2)}</td>
                  <td className="num">{fmt(row.elevationUp, 2)}</td>
                  <td className="num">{fmt(row.elevationDown, 2)}</td>
                  <ValueCell value={fmt(row.pressureUp, 2)} flag={row.pressureUpFlag} unit={mca} />
                  <ValueCell
                    value={fmt(row.pressureDown, 2)}
                    flag={row.pressureDownFlag}
                    unit={mca}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="results__section">
        <div className="results__bar">
          <h3>{tr(s.nodesTitle)}</h3>
        </div>
        <div className="table-wrap results__wrap">
          <table className="table results__table">
            <caption className="visually-hidden">{tr(s.nodesCaption)}</caption>
            <thead>
              <tr>
                <th scope="col" className="results__corner">
                  {tr(s.node)}
                </th>
                <th scope="col" className="num">
                  <Head unit="m">{tr(s.elevation)}</Head>
                </th>
                <th scope="col" className="num">
                  <Head unit="L/s">{tr(s.demand)}</Head>
                </th>
                <th scope="col" className="num">
                  <Head unit="m">
                    <Term id="hgl">{tr(s.hgl)}</Term>
                  </Head>
                </th>
                <th scope="col" className="num">
                  <Head unit={mca}>
                    <Term id="dynamicPressure">{tr(s.dynamicPressure)}</Term>
                  </Head>
                </th>
                <th scope="col" className="num">
                  <Head unit={mca}>
                    <Term id="staticPressure">{tr(s.staticPressure)}</Term>
                  </Head>
                </th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((row) => (
                <tr
                  key={row.id}
                  aria-selected={
                    (selection?.type === 'node' || selection?.type === 'reservoir') &&
                    selection.id === row.id
                  }
                  onClick={() => select({ type: row.kind, id: row.id })}
                >
                  <th scope="row" className="results__id">
                    <button type="button" className="results__rowbtn num">
                      {row.id}
                    </button>
                    {row.kind === 'reservoir' && (
                      <span className="results__kind">{tr(s.reservoir)}</span>
                    )}
                  </th>
                  <td className="num">{fmt(row.elevation, 2)}</td>
                  <td className="num">{row.demand === null ? '–' : fmt(row.demand, 2)}</td>
                  <td className="num">{fmt(row.head, 2)}</td>
                  <ValueCell value={fmt(row.pressure, 2)} flag={row.pressureFlag} unit={mca} />
                  <ValueCell
                    value={row.staticPressure === null ? '–' : fmt(row.staticPressure, 2)}
                    flag={row.staticFlag}
                    unit={mca}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ul className="results__legend">
        {hasError && (
          <li className="results__legend-item results__legend-item--error">
            <IconError />
            {tr(s.legendError)}
          </li>
        )}
        {hasWarning && (
          <li className="results__legend-item results__legend-item--warning">
            <IconWarning />
            {tr(s.legendWarning)}
          </li>
        )}
        {hasReversed && (
          <li className="results__legend-item">
            <span aria-hidden="true">⇄</span>
            {tr(s.legendReversed)}
          </li>
        )}
        <li className="results__legend-item">{tr(s.selectHint)}</li>
      </ul>
    </ResultBody>
  );
}
