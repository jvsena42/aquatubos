import { useId, useState } from 'react';
import { DEFAULT_HARDY_CROSS_OPTIONS } from '../../engine/hardyCross';
import { HAZEN_WILLIAMS_EXPONENT } from '../../engine/headloss';
import type { HardyCrossIteration, HardyCrossLoopStep, Loop } from '../../engine/types';
import { m3sToLps } from '../../engine/units';
import { useFormat, useTr } from '../../i18n';
import { useAppStore } from '../../state/store';
import { ResultBody, ResultHint } from '../charts/ResultState';
import { ScrollTable } from '../charts/ScrollTable';
import { Term } from '../glossary/Term';
import { TermScope } from '../glossary/TermScope';
import { HelpButton } from '../shell/Help';
import { IconCheck, IconWarning } from '../shell/icons';
import { formulaLabels } from '../stage/strings';
import { hardyCrossStrings as s } from './HardyCrossTable.strings';
import './HardyCrossTable.css';

/** Exponent n of h = K·Q^n for Darcy-Weisbach (the engine uses the same value). */
const DARCY_WEISBACH_EXPONENT = 2;

/** n·|h|/|Q| is shown in m/(L/s), so that ΔQ in L/s is −Σh divided by the sum of the column. */
const perLps = (value: number): number => value / 1000;

interface LoopTableProps {
  step: HardyCrossLoopStep;
  iteration: number;
  /** Ids of the other loops each pipe of this loop belongs to. */
  shared: Record<string, string[]>;
}

/** Number formatting that never writes a negative zero such as "-0,0000". */
function useCleanFormat(): (value: number, digits: number) => string {
  const format = useFormat();
  return (value, digits) =>
    format(Math.abs(value) < 0.5 * Math.pow(10, -digits) ? 0 : value, digits);
}

function LoopTable({ step, iteration, shared }: LoopTableProps) {
  const tr = useTr();
  const fmt = useCleanFormat();
  const selection = useAppStore((state) => state.selection);
  const select = useAppStore((state) => state.select);

  return (
    <ScrollTable className="hc__wrap" label={tr(s.loopCaption(step.loopId, iteration))}>
      <table className="table hc__table">
        <caption>
          <span className="hc__loop">{tr(s.loop(step.loopId))}</span>
          <span className="visually-hidden">{`, ${tr(s.iteration(iteration))}`}</span>
        </caption>
        <thead>
          <tr>
            <th scope="col" className="sticky-col">
              {tr(s.pipe)}
            </th>
            <th scope="col" className="hc__sign">
              {tr(s.direction)}
            </th>
            <th scope="col" className="num">
              {tr(s.flow)} <span className="hc__unit">(L/s)</span>
            </th>
            <th scope="col" className="num">
              {tr(s.headLoss)} <span className="hc__unit">(m)</span>
            </th>
            <th scope="col" className="num">
              n·|h|/|Q| <span className="hc__unit">(m/(L/s))</span>
            </th>
            <th scope="col" className="num">
              {tr(s.corrected)} <span className="hc__unit">(L/s)</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {step.rows.map((row) => {
            const others = shared[row.pipeId] ?? [];
            return (
              <tr
                key={row.pipeId}
                aria-selected={selection?.type === 'pipe' && selection.id === row.pipeId}
                onClick={() => select({ type: 'pipe', id: row.pipeId })}
              >
                <th scope="row" className="sticky-col">
                  <span className="num">{row.pipeId}</span>
                  {others.length > 0 && (
                    <span className="hc__shared">{tr(s.alsoIn(others.join(', ')))}</span>
                  )}
                </th>
                <td className="num hc__sign">
                  <span aria-hidden="true">{row.direction === 1 ? '+' : '−'}</span>
                  <span className="visually-hidden">
                    {tr(row.direction === 1 ? s.directionWith : s.directionAgainst)}
                  </span>
                </td>
                <td className="num">{fmt(m3sToLps(row.flow), 3)}</td>
                <td className="num">{fmt(row.headLoss, 4)}</td>
                <td className="num">{fmt(perLps(row.nHeadLossOverFlow), 4)}</td>
                <td className="num">{fmt(m3sToLps(row.correctedFlow), 3)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          {/* The label stays in the sticky first column; the value sits under its column. */}
          <tr>
            <th scope="row" className="sticky-col">
              Σh <span className="hc__unit">(m)</span>
            </th>
            <td className="num" colSpan={3}>
              {fmt(step.sumHeadLoss, 4)}
            </td>
            <td colSpan={2} />
          </tr>
          <tr>
            <th scope="row" className="sticky-col">
              Σ n·|h|/|Q| <span className="hc__unit">(m/(L/s))</span>
            </th>
            <td className="num" colSpan={4}>
              {fmt(perLps(step.sumNHeadLossOverFlow), 4)}
            </td>
            <td />
          </tr>
          <tr className="hc__delta">
            <th scope="row" className="sticky-col">
              ΔQ <span className="hc__unit">(L/s)</span>
            </th>
            <td className="num" colSpan={5}>
              {fmt(m3sToLps(step.deltaQ), 4)}
            </td>
          </tr>
        </tfoot>
      </table>
    </ScrollTable>
  );
}

/** Pipes that belong to more than one loop: pipe id → ids of the loops, in order. */
function loopsByPipe(loops: readonly Loop[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const loop of loops) {
    for (const { pipeId } of loop.pipes) (result[pipeId] ??= []).push(loop.id);
  }
  return result;
}

/**
 * Hardy Cross teaching table: the corrections of each loop, iteration by iteration, and the
 * final flows next to the ones of the solver.
 */
export function HardyCrossTable() {
  const tr = useTr();
  const fmt = useCleanFormat();
  const scenario = useAppStore((state) => state.scenario);
  const evaluation = useAppStore((state) => state.evaluation);
  const selectId = useId();
  const [index, setIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);

  if (!scenario) return null;
  if (!evaluation) return <ResultHint />;
  const data = evaluation.hardyCross;
  if (!data || data.loops.length === 0 || data.result.iterations.length === 0) {
    return <ResultHint>{tr(s.noLoops)}</ResultHint>;
  }

  const { loops, result } = data;
  const { iterations } = result;
  const total = iterations.length;
  const current = Math.min(index, total - 1);
  const formula = evaluation.result.formula;
  const exponent = formula === 'hazen-williams' ? HAZEN_WILLIAMS_EXPONENT : DARCY_WEISBACH_EXPONENT;
  const membership = loopsByPipe(loops);

  /** Values below the display precision are written as "< 0,0001". */
  const small = (lps: number): string =>
    lps !== 0 && Math.abs(lps) < 0.00005 ? `< ${fmt(0.0001, 4)}` : fmt(lps, 4);

  const comparison = scenario.pipes.flatMap((pipe) => {
    const hardyCross = result.flows[pipe.id];
    const solver = evaluation.result.pipes[pipe.id]?.flow;
    if (hardyCross === undefined || solver === undefined) return [];
    return [
      {
        id: pipe.id,
        inLoop: membership[pipe.id] !== undefined,
        initial: m3sToLps(result.initialFlows[pipe.id] ?? Number.NaN),
        hardyCross: m3sToLps(hardyCross),
        solver: m3sToLps(solver),
        difference: m3sToLps(hardyCross - solver),
      },
    ];
  });
  const maxDifference = Math.max(0, ...comparison.map((row) => Math.abs(row.difference)));

  const renderIteration = (iteration: HardyCrossIteration) => (
    <section
      key={iteration.iteration}
      className="hc__iteration"
      aria-label={tr(s.iteration(iteration.iteration))}
    >
      <h4 className="hc__iteration-title">
        {tr(s.iteration(iteration.iteration))}
        <span className="hc__iteration-max num">
          {tr(s.maxDelta(small(m3sToLps(iteration.maxDeltaQ))))}
        </span>
      </h4>
      <div className="hc__loops">
        {iteration.loops.map((step) => (
          <LoopTable
            key={step.loopId}
            step={step}
            iteration={iteration.iteration}
            shared={Object.fromEntries(
              step.rows.map((row) => [
                row.pipeId,
                (membership[row.pipeId] ?? []).filter((id) => id !== step.loopId),
              ]),
            )}
          />
        ))}
      </div>
    </section>
  );

  return (
    <TermScope>
      <ResultBody className="hc">
        <section className="hc__status">
          <div className="hc__status-row">
            <p role="status">
              {result.converged ? (
                <span className="badge badge--ok">
                  <IconCheck />
                  {tr(s.converged(total))}
                </span>
              ) : (
                <span className="badge badge--warn">
                  <IconWarning />
                  {tr(s.notConverged(total))}
                </span>
              )}
            </p>
            <HelpButton topic="Hardy Cross" className="hc__help">
              <p>
                <Term id="hardyCross">{tr(s.method)} Hardy Cross</Term>
                {tr(s.introBefore)}
                <Term id="loop">{tr(s.introLoop)}</Term>
                {tr(s.introAfter)}
              </p>
              <p className="hc__formula num">ΔQ = −Σh / Σ(n·|h|/|Q|)</p>
              <p>
                {tr(
                  s.exponent(
                    fmt(exponent, Number.isInteger(exponent) ? 0 : 3),
                    formulaLabels[formula],
                  ),
                )}{' '}
                {tr(s.tolerance(fmt(m3sToLps(DEFAULT_HARDY_CROSS_OPTIONS.tolerance), 4)))}
              </p>
              <p>
                <strong>{tr(s.signsTitle)}.</strong> {tr(s.signs)}
              </p>
              <p>
                <strong>{tr(s.compareTitle)}.</strong> {tr(s.compareNote)}
              </p>
            </HelpButton>
          </div>
          <div className="hc__convergence">
            <h4 id={`${selectId}-conv`}>{tr(s.convergenceTitle)}</h4>
            <ol aria-labelledby={`${selectId}-conv`}>
              {iterations.map((iteration, i) => (
                <li key={iteration.iteration}>
                  <button
                    type="button"
                    className="hc__chip"
                    aria-current={!showAll && i === current ? 'step' : undefined}
                    title={tr(s.goTo(iteration.iteration))}
                    onClick={() => {
                      setShowAll(false);
                      setIndex(i);
                    }}
                  >
                    <span className="hc__chip-n">{iteration.iteration}</span>
                    <span className="num">{small(m3sToLps(iteration.maxDeltaQ))}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="hc__steps">
          <div className="hc__stepper" role="group" aria-label={tr(s.stepper)}>
            <button
              type="button"
              className="btn btn--sm btn--icon"
              aria-label={tr(s.first)}
              title={tr(s.first)}
              disabled={showAll || current === 0}
              onClick={() => setIndex(0)}
            >
              <span aria-hidden="true">«</span>
            </button>
            <button
              type="button"
              className="btn btn--sm btn--icon"
              aria-label={tr(s.previous)}
              title={tr(s.previous)}
              disabled={showAll || current === 0}
              onClick={() => setIndex(current - 1)}
            >
              <span aria-hidden="true">‹</span>
            </button>
            <label htmlFor={selectId} className="visually-hidden">
              {tr(s.stepper)}
            </label>
            <select
              id={selectId}
              className="select hc__select"
              value={current}
              disabled={showAll}
              onChange={(event) => setIndex(Number(event.target.value))}
            >
              {iterations.map((iteration, i) => (
                <option key={iteration.iteration} value={i}>
                  {tr(s.iterationOf(iteration.iteration, total))}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn--sm btn--icon"
              aria-label={tr(s.next)}
              title={tr(s.next)}
              disabled={showAll || current === total - 1}
              onClick={() => setIndex(current + 1)}
            >
              <span aria-hidden="true">›</span>
            </button>
            <button
              type="button"
              className="btn btn--sm btn--icon"
              aria-label={tr(s.last)}
              title={tr(s.last)}
              disabled={showAll || current === total - 1}
              onClick={() => setIndex(total - 1)}
            >
              <span aria-hidden="true">»</span>
            </button>
            <label className="hc__all">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(event) => setShowAll(event.target.checked)}
              />
              {tr(s.showAll)}
            </label>
          </div>

          {showAll ? iterations.map(renderIteration) : renderIteration(iterations[current]!)}
        </section>

        <section className="hc__compare">
          <h3>{tr(s.compareTitle)}</h3>
          <ScrollTable className="hc__wrap hc__wrap--compare" label={tr(s.compareTitle)}>
            <table className="table hc__table">
              <caption className="visually-hidden">{tr(s.compareTitle)}</caption>
              <thead>
                <tr>
                  <th scope="col" className="sticky-col">
                    {tr(s.pipe)}
                  </th>
                  <th scope="col" className="num">
                    {tr(s.initial)} <span className="hc__unit">(L/s)</span>
                  </th>
                  <th scope="col" className="num">
                    {tr(s.hardyCross)} <span className="hc__unit">(L/s)</span>
                  </th>
                  <th scope="col" className="num">
                    {tr(s.solver)} <span className="hc__unit">(L/s)</span>
                  </th>
                  <th scope="col" className="num">
                    {tr(s.difference)} <span className="hc__unit">(L/s)</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.id} className={row.inLoop ? undefined : 'hc__outside'}>
                    <th scope="row" className="sticky-col">
                      <span className="num">{row.id}</span>
                    </th>
                    <td className="num">{fmt(row.initial, 3)}</td>
                    <td className="num">{fmt(row.hardyCross, 3)}</td>
                    <td className="num">{fmt(row.solver, 3)}</td>
                    <td className="num">{fmt(row.difference, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <p className="hc__agree">{tr(s.maxDifference(small(maxDifference)))}</p>
        </section>
      </ResultBody>
    </TermScope>
  );
}
