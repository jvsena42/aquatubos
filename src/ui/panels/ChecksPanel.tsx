import type { ReactNode } from 'react';
import { NBR_12218 } from '../../engine/config/nbr12218';
import type { CheckId, CheckIssue } from '../../engine/types';
import { mToMm } from '../../engine/units';
import { useTr } from '../../i18n';
import { SCENARIOS } from '../../scenarios';
import { isUnlocked, useAppStore } from '../../state/store';
import { useNum } from '../network/format';
import { HEAD_UNIT } from '../network/strings';
import { HelpButton } from '../shell/Help';
import {
  IconCheck,
  IconError,
  IconNext,
  IconPending,
  IconStale,
  IconWarning,
} from '../shell/icons';
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

/** How the value and the limit of each check are written: unit, decimals and direction. */
const CHECK_FORMAT: Record<
  CheckId,
  { unit: string; digits: number; scale: (si: number) => number; bound: 'min' | 'max' } | null
> = {
  minDynamicPressure: { unit: ` ${HEAD_UNIT}`, digits: 1, scale: (v) => v, bound: 'min' },
  maxStaticPressure: { unit: ` ${HEAD_UNIT}`, digits: 1, scale: (v) => v, bound: 'max' },
  minVelocity: { unit: ' m/s', digits: 2, scale: (v) => v, bound: 'min' },
  maxVelocity: { unit: ' m/s', digits: 2, scale: (v) => v, bound: 'max' },
  minDiameter: { unit: ' mm', digits: 0, scale: mToMm, bound: 'min' },
  convergence: null,
};

/**
 * Result of the last "Calcular / Verificar": one status line and one line per issue. Cost,
 * budget and stars are in the HUD; what each issue means is behind its "?".
 */
export function ChecksPanel() {
  const tr = useTr();
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

  const next = SCENARIOS.find((s) => s.order === scenario.order + 1);
  const nextUnlocked = next ? isUnlocked(next, progress) : false;
  const issues = evaluation?.report.issues ?? [];

  return (
    <div className="checks">
      <div className="checks__status" role="status">
        <span className={view.badge}>
          {view.icon}
          {tr(checksStrings[status])}
        </span>
        {evaluation && (
          <span className="checks__count">
            {tr(
              issues.length > 0 && issues.every((issue) => issue.severity === 'warning')
                ? checksStrings.warningCount(issues.length)
                : checksStrings.issueCount(issues.length),
            )}
          </span>
        )}
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

      {issues.length > 0 && (
        <ul className="checks__issues" aria-label={tr(checksStrings.issues)}>
          {issues.map((issue, index) => (
            <IssueItem
              key={`${issue.check}-${issue.elementType}-${issue.elementId}-${index}`}
              issue={issue}
              onSelect={select}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface IssueItemProps {
  issue: CheckIssue;
  onSelect: (selection: { type: 'pipe' | 'node'; id: string }) => void;
}

/** "Pressão mín. · N4 · 9,4 mca": tapping it selects the element, the "?" explains it. */
function IssueItem({ issue, onSelect }: IssueItemProps) {
  const tr = useTr();
  const fmt = useNum();
  const isError = issue.severity === 'error';
  const label = tr(checkLabels[issue.check]);
  const format = CHECK_FORMAT[issue.check];
  const write = (si: number) =>
    format ? `${fmt(format.scale(si), format.digits)}${format.unit}` : '';
  const element =
    issue.elementType === 'pipe'
      ? tr(checksStrings.pipe(issue.elementId))
      : issue.elementType === 'node'
        ? tr(checksStrings.node(issue.elementId))
        : tr(checksStrings.network);

  const content = (
    <>
      <span className="issue__icon">
        {isError ? <IconError /> : <IconWarning />}
        <span className="visually-hidden">{tr(severityLabels[issue.severity])}: </span>
      </span>
      <span className="issue__check">{label}</span>
      {issue.elementType !== 'network' && (
        <span className="issue__element num" title={element}>
          <span aria-hidden="true">{issue.elementId}</span>
          <span className="visually-hidden">{element}</span>
        </span>
      )}
      {format && <span className="issue__value num">{write(issue.value)}</span>}
    </>
  );

  const { elementType, elementId } = issue;
  return (
    <li className={`issue issue--${issue.severity}`}>
      {elementType === 'network' ? (
        <div className="issue__main">{content}</div>
      ) : (
        <button
          type="button"
          className="issue__main issue__main--action"
          title={tr(checksStrings.selectHint)}
          onClick={() => onSelect({ type: elementType, id: elementId })}
        >
          {content}
        </button>
      )}
      <HelpButton topic={label} className="issue__help">
        <span className="issue__explanation">{tr(issue.explanation)}</span>
        {format && (
          <span className="issue__limit">
            {tr(
              checksStrings.limit(
                tr(
                  (format.bound === 'min' ? checksStrings.atLeast : checksStrings.atMost)(
                    write(issue.limit),
                  ),
                ),
                NBR_12218.reference,
              ),
            )}
          </span>
        )}
      </HelpButton>
    </li>
  );
}
