import { useEffect, useState } from 'react';
import { useFormat, useTr } from '../../i18n';
import { designCost } from '../../game/evaluate';
import { housesSummary } from '../../game/houses';
import { STAR_THRESHOLDS } from '../../game/stars';
import { useAppStore } from '../../state/store';
import { HelpButton } from '../shell/Help';
import { IconError } from '../shell/icons';
import { Stars } from '../shell/Stars';
import { money } from '../shell/strings';
import { hudStrings } from './strings';
import './hud.css';

/** Duration of the houses count-up after a successful verification, ms. */
const COUNT_UP_MS = 700;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Counts from 0 to `target` each time `runKey` changes to a new non-null value. Returns
 * `target` when no count is running, so the final state never depends on the animation.
 */
function useCountUp(target: number, runKey: number | null): number {
  const [frame, setFrame] = useState<{ key: number; value: number } | null>(null);

  useEffect(() => {
    if (runKey === null) return;
    let handle = 0;
    let start: number | null = null;
    const step = (now: number) => {
      start ??= now;
      const progress = Math.min(1, (now - start) / COUNT_UP_MS);
      // Ease out so the last houses arrive slowly.
      const eased = 1 - (1 - progress) ** 3;
      setFrame({ key: runKey, value: Math.round(target * eased) });
      if (progress < 1) handle = requestAnimationFrame(step);
    };
    handle = requestAnimationFrame(step);
    return () => cancelAnimationFrame(handle);
  }, [runKey, target]);

  if (runKey === null) return target;
  return frame?.key === runKey ? frame.value : 0;
}

function IconHouse() {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9.5h12V10" />
      <path d="M10 19.5v-5h4v5" />
    </svg>
  );
}

function IconCost() {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.6.8-2.6 2s1 1.7 2.6 2 2.7.8 2.7 2-1.2 2-2.7 2c-1.2 0-2.2-.5-2.7-1.3" />
      <path d="M12 6.3V8M12 16v1.7" />
    </svg>
  );
}

interface StageHudProps {
  /**
   * Phone form: houses, cost and stars as one line of icons and numbers with a single help
   * button, for the app bar.
   */
  compact?: boolean;
}

/**
 * Game status of the open stage as icons and numbers: houses served, cost (with a bar against
 * the budget when the stage has one) and the stars the current design earns. What each number
 * means, the budget, the reference cost, the next star and the objectives are behind "?".
 */
export function StageHud({ compact = false }: StageHudProps) {
  const tr = useTr();
  const fmt = useFormat();
  const scenario = useAppStore((s) => s.scenario);
  const diameters = useAppStore((s) => s.diameters);
  const evaluation = useAppStore((s) => s.evaluation);
  const stale = useAppStore((s) => s.stale);
  const solving = useAppStore((s) => s.solving);
  const verifiedAt = useAppStore((s) => s.verifiedAt);
  const completed = useAppStore((s) =>
    s.scenario ? s.progress[s.scenario.id]?.completed === true : false,
  );
  // A verification that happened before this HUD was mounted is not celebrated again.
  const [mountedAt] = useState(verifiedAt);
  const [reducedMotion] = useState(prefersReducedMotion);

  const houses = scenario ? housesSummary(scenario, evaluation) : { served: 0, total: 0 };
  const fresh = evaluation !== null && !stale;
  const verifiedNow = fresh && !solving && verifiedAt !== null;
  const celebrate = verifiedNow && verifiedAt !== mountedAt && evaluation.passed && !reducedMotion;
  const shownServed = useCountUp(houses.served, celebrate ? verifiedAt : null);

  if (!scenario) return null;

  const cost = designCost(scenario, diameters);
  const budget = scenario.budget;
  const reference = scenario.reference.cost;
  const overBudget = budget !== null && cost > budget;
  const brl = (value: number, digits = 2) => money(fmt(value, digits));

  const stars = evaluation?.stars ?? 0;
  const starsHint = !evaluation
    ? tr(hudStrings.starsPending)
    : !evaluation.passed
      ? tr(hudStrings.starsFailing)
      : stars === 3
        ? tr(hudStrings.starsMax)
        : tr(
            hudStrings.nextStar(
              // Rounded down so a design at the displayed value always earns the star.
              brl(
                Math.floor(
                  reference * (stars === 1 ? STAR_THRESHOLDS.two : STAR_THRESHOLDS.three) * 100,
                ) / 100,
              ),
            ),
          );

  const referenceDifference = reference > 0 ? ((cost - reference) / reference) * 100 : 0;
  const referenceComparison =
    Math.abs(referenceDifference) < 0.05
      ? tr(hudStrings.equalToReference)
      : tr(
          (referenceDifference > 0 ? hudStrings.aboveReference : hudStrings.belowReference)(
            fmt(Math.abs(referenceDifference), 1),
          ),
        );

  let announcement = '';
  if (verifiedNow) {
    if (evaluation.passed) {
      announcement = tr(hudStrings.announcePassed(houses.served, houses.total, evaluation.stars));
    } else {
      announcement = tr(hudStrings.announceFailed(houses.served, houses.total));
      if (houses.served === houses.total) {
        announcement += `, ${tr(
          evaluation.withinBudget
            ? hudStrings.announceChecksFailing
            : hudStrings.announceOverBudget,
        )}`;
      }
    }
  }

  const isStale = stale && evaluation !== null;
  const staleNote = isStale && (
    <span className="visually-hidden"> ({tr(hudStrings.staleNote)})</span>
  );
  const percent = (ratio: number) => fmt((ratio - 1) * 100, 0);

  // Help texts. Blocks, not paragraphs: the help popover is phrasing content.
  const housesHelp = (
    <>
      <span className="hud__help-line">{tr(hudStrings.housesHelp)}</span>
      {isStale && <span className="hud__help-line">{tr(hudStrings.staleNote)}.</span>}
    </>
  );
  const costHelp = (
    <>
      <span className="hud__help-line">{tr(hudStrings.costHelp)}</span>
      {compact && <span className="hud__help-line">{tr(hudStrings.costNow(brl(cost)))}</span>}
      {budget !== null && (
        <span className="hud__help-line" data-help="budget">
          {overBudget
            ? `${tr(hudStrings.budget(brl(budget)))}. ${tr(hudStrings.overBudget(brl(cost - budget)))}.`
            : `${tr(hudStrings.budget(brl(budget)))}: ${tr(hudStrings.withinBudget(brl(budget - cost)))}.`}
        </span>
      )}
      {completed && (
        <span className="hud__help-line" data-help="reference">
          {tr(hudStrings.reference(brl(reference)))} ({referenceComparison}).
        </span>
      )}
    </>
  );
  const starsHelp = (
    <>
      <span className="hud__help-line">
        {tr(hudStrings.starsHelp(percent(STAR_THRESHOLDS.three), percent(STAR_THRESHOLDS.two)))}
      </span>
      <span className="hud__help-line" data-help="next-star">
        {starsHint}
      </span>
    </>
  );
  const objectives = (
    <span className="hud__help-line" data-help="objectives">
      <strong>{tr(hudStrings.objectivesTitle)}</strong>
      <span className="hud__objectives" role="list">
        {scenario.objectives.map((objective, index) => (
          <span key={index} role="listitem">
            {tr(objective)}
          </span>
        ))}
      </span>
    </span>
  );

  const housesValue = (
    <span className="hud__value num hud__dimmable">
      {evaluation ? shownServed : '–'}
      {compact ? '/' : ' / '}
      {houses.total}
    </span>
  );
  const budgetBar = budget !== null && (
    <BudgetBar
      cost={cost}
      budget={budget}
      reference={completed ? reference : null}
      label={tr(hudStrings.barLabel)}
    />
  );
  const starsValue = (
    <span
      key={verifiedAt ?? 0}
      className={
        celebrate
          ? 'hud__value hud__dimmable hud__stars hud__stars--reveal'
          : 'hud__value hud__dimmable hud__stars'
      }
    >
      <Stars value={stars} />
    </span>
  );
  const costLabel = tr(overBudget ? hudStrings.costOverBudget : hudStrings.cost);

  const live = (
    <p className="visually-hidden" aria-live="polite" data-testid="hud-live">
      {announcement}
    </p>
  );

  return (
    <section className={compact ? 'hud hud--compact' : 'hud'} aria-label={tr(hudStrings.label)}>
      <div
        className="hud__item hud__item--houses"
        data-stale={isStale ? 'true' : undefined}
        title={tr(hudStrings.houses)}
      >
        <IconHouse />
        <span className="visually-hidden">{tr(hudStrings.houses)}:</span>
        {housesValue}
        {staleNote}
        {!compact && (
          <span className="hud__bar hud__dimmable" aria-hidden="true">
            <span
              className={
                evaluation && houses.served === houses.total
                  ? 'hud__bar-fill hud__bar-fill--ok'
                  : 'hud__bar-fill'
              }
              style={{
                width: `${houses.total > 0 && evaluation ? (shownServed / houses.total) * 100 : 0}%`,
              }}
            />
          </span>
        )}
        {!compact && (
          <HelpButton topic={tr(hudStrings.houses)}>
            {housesHelp}
            {objectives}
          </HelpButton>
        )}
      </div>

      <div
        className={
          overBudget ? 'hud__item hud__item--cost hud__item--over' : 'hud__item hud__item--cost'
        }
        title={costLabel}
      >
        {overBudget ? <IconError /> : <IconCost />}
        <span className="visually-hidden">{costLabel}:</span>
        <span className="hud__value num">{brl(cost, compact ? 0 : 2)}</span>
        {budgetBar}
        {!compact && <HelpButton topic={tr(hudStrings.cost)}>{costHelp}</HelpButton>}
      </div>

      <div
        className="hud__item hud__item--stars"
        data-stale={isStale ? 'true' : undefined}
        title={tr(hudStrings.stars)}
      >
        <span className="visually-hidden">{tr(hudStrings.stars)}:</span>
        {starsValue}
        {staleNote}
        {!compact && <HelpButton topic={tr(hudStrings.stars)}>{starsHelp}</HelpButton>}
      </div>

      {compact && (
        <HelpButton topic={tr(hudStrings.label)} className="hud__help">
          <strong className="hud__help-title">{tr(hudStrings.houses)}</strong>
          {housesHelp}
          <strong className="hud__help-title">{tr(hudStrings.cost)}</strong>
          {costHelp}
          <strong className="hud__help-title">{tr(hudStrings.stars)}</strong>
          {starsHelp}
          {objectives}
        </HelpButton>
      )}

      {live}
    </section>
  );
}

interface BudgetBarProps {
  cost: number;
  budget: number;
  /** Reference cost, or null while it must stay hidden. */
  reference: number | null;
  label: string;
}

/** Cost as a bar with a mark at the budget and, when known, a marker at the reference cost. */
function BudgetBar({ cost, budget, reference, label }: BudgetBarProps) {
  // The budget sits at 80 % of the track until the cost pushes the scale further.
  const scale = Math.max(budget * 1.25, cost * 1.04);
  const percent = (value: number) => `${Math.min(100, (value / scale) * 100)}%`;
  return (
    <span className="hud__bar hud__bar--budget" role="img" aria-label={label}>
      <span
        className={cost > budget ? 'hud__bar-fill hud__bar-fill--over' : 'hud__bar-fill'}
        style={{ width: percent(cost) }}
      />
      {reference !== null && (
        <span className="hud__bar-reference" style={{ left: percent(reference) }} />
      )}
      <span className="hud__bar-budget" style={{ left: percent(budget) }} />
    </span>
  );
}
