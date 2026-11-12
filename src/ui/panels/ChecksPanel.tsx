import type { ReactNode } from 'react';
import { useFormat, useTr } from '../../i18n';
import type { CheckIssue } from '../../engine/types';
import { SCENARIOS } from '../../scenarios';
import { isUnlocked, useAppStore } from '../../state/store';
import {
  IconCheck,
  IconError,
  IconNext,
  IconPending,
  IconStale,
  IconWarning,
} from '../shell/icons';
import { Stars } from '../shell/Stars';
import { money } from '../shell/strings';
import { checkLabels, checksStrings, severityLabels } from './checksStrings';
import './checks.css';

type Status = 'solving' | 'notVerified' | 'stale' | 'passed' | 'failed';

const STATUS_VIEW: Record<Status, { badge: string; icon: ReactNode }> = {
  solving: { badge: 'badge badge--info', icon: <IconPending /> },
  notVerified: { badge: 'badge', icon: <IconPending /> },
  stale: { badge: 'badge badge--warn', icon: <IconStale /> },
  passed: { badge: 'badge badge--ok', icon: <IconCheck /> },
  failed: { badge: 'badge badge--danger', icon: <IconError /> },
};

/** Result of the last "Calcular / Verificar": status, cost, stars and the list of issues. */
export function ChecksPanel() {
  const tr = useTr();
  const fmt = useFormat();
  const scenario = useAppStore((s) => s.scenario);
  const evaluation = useAppStore((s) => s.evaluation);
  const stale = useAppStore((s) => s.stale);
  const solving = useAppStore((s) => s.solving);
  const error = useAppStore((s) => s.error);
  const progress = useAppStore((s) => s.progress);
  const select = useAppStore((s) => s.select);
  const openStage = useAppStore((s) => s.openStage);

  if (!scenario) return null;

  const status: Status = !evaluation
    ? solving
      ? 'solving'
      : 'notVerified'
    : stale
      ? 'stale'
      : evaluation.passed
        ? 'passed'
        : 'failed';
  const view = STATUS_VIEW[status];
  const passedNow = status === 'passed';

  const showCost = scenario.budget !== null || scenario.features.cost;
  const next = SCENARIOS.find((s) => s.order === scenario.order + 1);
  const nextUnlocked = next ? isUnlocked(next, progress) : false;

  const referenceText = () => {
    if (!evaluation) return null;
    const reference = scenario.reference.cost;
    const difference = reference > 0 ? ((evaluation.cost - reference) / reference) * 100 : 0;
    if (Math.abs(difference) < 0.05) return tr(checksStrings.equalToReference);
    const percent = fmt(Math.abs(difference), 1);
    return tr(
      difference > 0
        ? checksStrings.aboveReference(percent)
        : checksStrings.belowReference(percent),
    );
  };

  return (
    <div className="checks">
      <div className="checks__status" role="status">
        <span className={view.badge}>
          {view.icon}
          {tr(checksStrings[status])}
        </span>
        {status === 'notVerified' && <p className="muted">{tr(checksStrings.notVerifiedHint)}</p>}
        {status === 'stale' && <p className="muted">{tr(checksStrings.staleHint)}</p>}
        {passedNow && <p>{tr(checksStrings.success)}</p>}
      </div>

      {error && (
        <div className="checks__error" role="alert">
          <IconError />
          <div>
            <strong>{tr(checksStrings.errorTitle)}</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {passedNow && next && nextUnlocked && (
        <button type="button" className="btn btn--primary" onClick={() => void openStage(next.id)}>
          {tr(checksStrings.nextStage)}
          <IconNext />
        </button>
      )}

      {evaluation && (
        <dl className="checks__facts">
          {showCost && (
            <div>
              <dt>{tr(checksStrings.cost)}</dt>
              <dd className="num">{money(fmt(evaluation.cost, 2))}</dd>
            </div>
          )}
          {showCost && scenario.budget !== null && (
            <div>
              <dt>{tr(checksStrings.budget)}</dt>
              <dd>
                <span className="num">{money(fmt(scenario.budget, 2))}</span>
                {evaluation.withinBudget ? (
                  <span className="badge badge--ok">
                    <IconCheck />
                    {tr(checksStrings.withinBudget)}
                  </span>
                ) : (
                  <span className="badge badge--danger">
                    <IconError />
                    {tr(checksStrings.overBudget)}
                  </span>
                )}
              </dd>
            </div>
          )}
          {passedNow && (
            <div>
              <dt>{tr(checksStrings.rating)}</dt>
              <dd>
                <Stars value={evaluation.stars} />
              </dd>
            </div>
          )}
          {passedNow && showCost && (
            <div>
              <dt>{tr(checksStrings.referenceCost)}</dt>
              <dd>
                <span className="num">{money(fmt(scenario.reference.cost, 2))}</span>
                <span className="checks__reference">{referenceText()}</span>
              </dd>
            </div>
          )}
        </dl>
      )}

      {evaluation && (
        <section className="checks__issues">
          <h3>
            {tr(checksStrings.issues)} ({evaluation.report.issues.length})
          </h3>
          {evaluation.report.issues.length === 0 ? (
            <p className="muted">{tr(checksStrings.noIssues)}</p>
          ) : (
            <ul>
              {evaluation.report.issues.map((issue, index) => (
                <li key={`${issue.check}-${issue.elementType}-${issue.elementId}-${index}`}>
                  <IssueItem issue={issue} onSelect={select} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

interface IssueItemProps {
  issue: CheckIssue;
  onSelect: (selection: { type: 'pipe' | 'node'; id: string }) => void;
}

function IssueItem({ issue, onSelect }: IssueItemProps) {
  const tr = useTr();
  const isError = issue.severity === 'error';
  const element =
    issue.elementType === 'pipe'
      ? tr(checksStrings.pipe(issue.elementId))
      : issue.elementType === 'node'
        ? tr(checksStrings.node(issue.elementId))
        : tr(checksStrings.network);

  const content = (
    <>
      <span className="issue__head">
        <span className={isError ? 'badge badge--danger' : 'badge badge--warn'}>
          {isError ? <IconError /> : <IconWarning />}
          {tr(severityLabels[issue.severity])}
        </span>
        <span className="issue__check">{tr(checkLabels[issue.check])}</span>
        <span className="issue__element num">{element}</span>
      </span>
      <span className="issue__explanation">{tr(issue.explanation)}</span>
    </>
  );

  if (issue.elementType === 'network') {
    return <div className={`issue issue--${issue.severity}`}>{content}</div>;
  }
  const { elementType, elementId } = issue;
  return (
    <button
      type="button"
      className={`issue issue--${issue.severity} issue--action`}
      title={tr(checksStrings.selectHint)}
      onClick={() => onSelect({ type: elementType, id: elementId })}
    >
      {content}
    </button>
  );
}
