import { useState, type ThHTMLAttributes } from 'react';
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
import { ScrollTable } from '../charts/ScrollTable';
import { GLOSSARY, type TermId } from '../glossary/glossary';
import { TermScope } from '../glossary/TermScope';
import { HelpButton } from '../shell/Help';
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

interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /** What the header shows: a symbol or a short word. */
  short: string;
  /** Full name of the column: its accessible name, with the unit. */
  full: string;
  unit?: string;
}

/** Column header: short text over its unit; the full name is read by screen readers. */
function Th({ short, full, unit, ...rest }: ThProps) {
  return (
    <th {...rest} aria-label={unit ? `${full} (${unit})` : full}>
      {short}
      {unit && (
        <>
          {' '}
          <span className="results__unit">({unit})</span>
        </>
      )}
    </th>
  );
}

interface ColumnHelp {
  short: string;
  full: string;
  unit?: string;
  term?: TermId;
}

/** The columns of a table in words, for the help: symbol, name and what it is. */
function ColumnList({ columns }: { columns: ColumnHelp[] }) {
  const tr = useTr();
  return (
    <dl className="results__help">
      {columns.map((column) => (
        <div key={column.full}>
          <dt>
            {column.short}
            {column.unit && ` (${column.unit})`}
          </dt>
          <dd>
            <strong>{column.full}</strong>
            {column.term && `: ${tr(GLOSSARY[column.term].definition)}`}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * NBR-style calculation sheet: one row per pipe and a second table per node. Clicking a row
 * selects the element in the store. The pipe table can be exported as CSV. Headers are symbols
 * with units; the "?" lists every column by name and explains the marks.
 */
export function ResultsTable() {
  const tr = useTr();
  const fmt = useFormat();
  const lang = useAppStore((state) => state.lang);
  const scenario = useAppStore((state) => state.scenario);
  const evaluation = useAppStore((state) => state.evaluation);
  const selection = useAppStore((state) => state.selection);
  const select = useAppStore((state) => state.select);
  // On phones one table is shown at a time, so each one can fill the view.
  const [shown, setShown] = useState<'pipes' | 'nodes'>('pipes');

  if (!scenario) return null;
  const pipes = evaluation ? pipeTableRows(scenario, evaluation) : [];
  const nodes = evaluation ? nodeTableRows(scenario, evaluation) : [];
  if (!evaluation || pipes.length === 0) return <ResultHint />;

  const mca = tr(HEAD_UNIT);
  const up = { short: tr(s.short.upstream), full: tr(s.upstream) };
  const down = { short: tr(s.short.downstream), full: tr(s.downstream) };
  const column = {
    length: { short: tr(s.short.length), full: tr(s.length), unit: 'm' },
    flow: { short: tr(s.short.flow), full: tr(s.flow), unit: 'L/s', term: 'flow' },
    dn: { short: 'DN', full: tr(s.dn), unit: 'mm', term: 'dn' },
    velocity: { short: tr(s.short.velocity), full: tr(s.velocity), unit: 'm/s' },
    unitHeadLoss: {
      short: tr(s.short.unitHeadLoss),
      full: tr(s.unitHeadLoss),
      unit: 'm/km',
      term: 'unitHeadLoss',
    },
    headLoss: { short: tr(s.short.headLoss), full: tr(s.headLoss), unit: 'm', term: 'headLoss' },
    hgl: { short: tr(s.short.hgl), full: tr(s.hgl), unit: 'm', term: 'hgl' },
    elevation: { short: tr(s.short.elevation), full: tr(s.elevation), unit: 'm' },
    pressure: {
      short: tr(s.short.pressure),
      full: tr(s.pressure),
      unit: mca,
      term: 'dynamicPressure',
    },
    demand: { short: tr(s.short.demand), full: tr(s.demand), unit: 'L/s' },
    dynamicPressure: {
      short: tr(s.short.pressure),
      full: tr(s.dynamicPressure),
      unit: mca,
      term: 'dynamicPressure',
    },
    staticPressure: {
      short: tr(s.short.staticPressure),
      full: tr(s.staticPressure),
      unit: mca,
      term: 'staticPressure',
    },
  } satisfies Record<string, ColumnHelp>;
  const help = (
    <HelpButton topic={tr(s.helpTopic)} className="results__helpbtn">
      <p>{tr(s.selectHint)}</p>
      <strong className="results__help-title">{tr(s.pipesTitle)}</strong>
      <ColumnList
        columns={[
          column.length,
          column.flow,
          column.dn,
          column.velocity,
          column.unitHeadLoss,
          column.headLoss,
          column.hgl,
          column.elevation,
          column.pressure,
        ]}
      />
      <p>{tr(s.helpDirection)}</p>
      <strong className="results__help-title">{tr(s.nodesTitle)}</strong>
      <ColumnList
        columns={[
          column.elevation,
          column.demand,
          column.hgl,
          column.dynamicPressure,
          column.staticPressure,
        ]}
      />
      <strong className="results__help-title">{tr(s.helpMarks)}</strong>
      <ul className="results__legend">
        <li className="results__legend-item results__legend-item--error">
          <IconError />
          {tr(s.legendError)}
        </li>
        <li className="results__legend-item results__legend-item--warning">
          <IconWarning />
          {tr(s.legendWarning)}
        </li>
        <li className="results__legend-item">
          <span aria-hidden="true">⇄</span>
          {tr(s.legendReversed)}
        </li>
      </ul>
    </HelpButton>
  );

  // What the marks of the selected row mean, in words: on a touch screen there is no hover.
  const flagNote = (name: string, value: string, unit: string, flag: LimitFlag | null) => {
    if (!flag) return [];
    const limit = `${fmt(flag.limit, 2)} ${unit}`;
    const reason = tr(flag.kind === 'low' ? s.belowLimit(limit) : s.aboveLimit(limit));
    return [`${name} ${value} ${unit}: ${reason}`];
  };
  const selectedPipe = selection?.type === 'pipe' && pipes.find((row) => row.id === selection.id);
  const selectedNode =
    (selection?.type === 'node' || selection?.type === 'reservoir') &&
    nodes.find((row) => row.id === selection.id);
  const notes = selectedPipe
    ? [
        ...flagNote(
          tr(s.velocity),
          fmt(selectedPipe.velocity, 2),
          'm/s',
          selectedPipe.velocityFlag,
        ),
        ...flagNote(
          `${tr(s.pressure)} (${tr(s.upstream)})`,
          fmt(selectedPipe.pressureUp, 2),
          mca,
          selectedPipe.pressureUpFlag,
        ),
        ...flagNote(
          `${tr(s.pressure)} (${tr(s.downstream)})`,
          fmt(selectedPipe.pressureDown, 2),
          mca,
          selectedPipe.pressureDownFlag,
        ),
        ...(selectedPipe.reversed
          ? [tr(s.reversed(selectedPipe.upstream, selectedPipe.downstream))]
          : []),
      ]
    : selectedNode
      ? [
          ...flagNote(
            tr(s.dynamicPressure),
            fmt(selectedNode.pressure, 2),
            mca,
            selectedNode.pressureFlag,
          ),
          ...(selectedNode.staticPressure === null
            ? []
            : flagNote(
                tr(s.staticPressure),
                fmt(selectedNode.staticPressure, 2),
                mca,
                selectedNode.staticFlag,
              )),
        ]
      : [];
  const notesId = selectedPipe ? selectedPipe.id : selectedNode ? selectedNode.id : '';

  return (
    <TermScope>
      <ResultBody className={`results results--${shown}`}>
        <section className="results__section results__section--pipes">
          <div className="results__bar">
            <h3>{tr(s.pipesTitle)}</h3>
            <div className="segmented results__switch" role="group" aria-label={tr(s.shownTable)}>
              <button
                type="button"
                aria-pressed={shown === 'pipes'}
                onClick={() => setShown('pipes')}
              >
                {tr(s.pipesTitle)}
              </button>
              <button
                type="button"
                aria-pressed={shown === 'nodes'}
                onClick={() => setShown('nodes')}
              >
                {tr(s.nodesTitle)}
              </button>
            </div>
            <button
              type="button"
              className="btn btn--sm results__export"
              onClick={() => downloadText(csvFileName(scenario.id), pipeTableCsv(pipes, lang))}
            >
              {tr(s.exportCsv)}
            </button>
            {help}
          </div>
          <ScrollTable className="results__wrap" label={tr(s.pipesTitle)}>
            <table className="table results__table">
              <caption className="visually-hidden">{tr(s.pipesCaption)}</caption>
              <thead>
                <tr>
                  <th scope="col" rowSpan={2} className="results__corner sticky-col">
                    {tr(s.pipe)}
                  </th>
                  <th scope="colgroup" colSpan={2}>
                    {tr(s.node)}
                  </th>
                  <Th scope="col" rowSpan={2} className="num" {...column.length} />
                  <Th scope="col" rowSpan={2} className="num" {...column.flow} />
                  <Th scope="col" rowSpan={2} className="num" {...column.dn} />
                  <Th scope="col" rowSpan={2} className="num" {...column.velocity} />
                  <Th scope="col" rowSpan={2} className="num" {...column.unitHeadLoss} />
                  <Th scope="col" rowSpan={2} className="num" {...column.headLoss} />
                  <Th scope="colgroup" colSpan={2} {...column.hgl} />
                  <Th scope="colgroup" colSpan={2} {...column.elevation} />
                  <Th scope="colgroup" colSpan={2} {...column.pressure} />
                </tr>
                <tr>
                  <Th scope="col" {...up} />
                  <Th scope="col" {...down} />
                  <Th scope="col" className="num" {...up} />
                  <Th scope="col" className="num" {...down} />
                  <Th scope="col" className="num" {...up} />
                  <Th scope="col" className="num" {...down} />
                  <Th scope="col" className="num" {...up} />
                  <Th scope="col" className="num" {...down} />
                </tr>
              </thead>
              <tbody>
                {pipes.map((row) => (
                  <tr
                    key={row.id}
                    aria-selected={selection?.type === 'pipe' && selection.id === row.id}
                    onClick={() => select({ type: 'pipe', id: row.id })}
                  >
                    <th scope="row" className="results__id sticky-col">
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
                    <ValueCell
                      value={fmt(row.pressureUp, 2)}
                      flag={row.pressureUpFlag}
                      unit={mca}
                    />
                    <ValueCell
                      value={fmt(row.pressureDown, 2)}
                      flag={row.pressureDownFlag}
                      unit={mca}
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        </section>

        <section className="results__section results__section--nodes">
          <div className="results__bar">
            <h3>{tr(s.nodesTitle)}</h3>
          </div>
          <ScrollTable className="results__wrap" label={tr(s.nodesTitle)}>
            <table className="table results__table">
              <caption className="visually-hidden">{tr(s.nodesCaption)}</caption>
              <thead>
                <tr>
                  <th scope="col" className="results__corner sticky-col">
                    {tr(s.node)}
                  </th>
                  <Th scope="col" className="num" {...column.elevation} />
                  <Th scope="col" className="num" {...column.demand} />
                  <Th scope="col" className="num" {...column.hgl} />
                  <Th scope="col" className="num" {...column.dynamicPressure} />
                  <Th scope="col" className="num" {...column.staticPressure} />
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
                    <th scope="row" className="results__id sticky-col">
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
          </ScrollTable>
        </section>

        {notes.length > 0 && (
          <p className="results__notes" role="status">
            <strong className="num">{notesId}</strong>
            {notes.map((note) => (
              <span key={note}>{note}</span>
            ))}
          </p>
        )}
      </ResultBody>
    </TermScope>
  );
}
