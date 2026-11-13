import { useId, useMemo, useState } from 'react';
import { useFormat, useTr } from '../../i18n';
import type { StageProgress } from '../../game/types';
import { SCENARIOS } from '../../scenarios';
import type { Scenario } from '../../scenarios/types';
import { isUnlocked, useAppStore } from '../../state/store';
import { summarizeProgress } from '../home/homeModel';
import { useCoarsePointer, usePhone, usePhoneLandscape } from '../shell/breakpoints';
import { HelpButton } from '../shell/Help';
import { IconBack, IconCheck, IconLock, IconNext, IconPending, IconStar } from '../shell/icons';
import { Stars } from '../shell/Stars';
import { money } from '../shell/strings';
import { ROAD_DY, rowLayout, stripLayout, wideLayout } from './mapLayout';
import { Scenery, StripScenery } from './StageMap';
import { shortTitle, stagesStrings } from './strings';
import './stages.css';

/**
 * Stage select drawn as a map: one neighbourhood per stage along a road with a water main.
 * Three drawings of the same list: a vertical path on a phone, a low horizontal one on a phone
 * held sideways (it fits the screen without scrolling) and the wide map elsewhere.
 */
export function StageSelect() {
  const tr = useTr();
  const progress = useAppStore((s) => s.progress);
  const openStage = useAppStore((s) => s.openStage);
  const goHome = useAppStore((s) => s.goHome);
  const phone = usePhone();
  const sideways = usePhoneLandscape();
  // Touch screens: nothing shows on hover there, so the "?" of each card has the details.
  const touch = useCoarsePointer();
  const mode = sideways ? 'row' : phone ? 'tall' : 'wide';
  const [hovered, setHovered] = useState<string | null>(null);

  const stages = useMemo(() => [...SCENARIOS].sort((a, b) => a.order - b.order), []);
  const orders = useMemo(() => stages.map((s) => s.order), [stages]);
  const layout = useMemo(
    () => (mode === 'row' ? rowLayout(stages.length) : wideLayout(stages.length)),
    [mode, stages.length],
  );
  const strips = useMemo(() => stripLayout(stages.length), [stages.length]);

  const unlocked = stages.map((scenario) => isUnlocked(scenario, progress));
  // Stages unlock in order, so the unlocked ones are a prefix of the list.
  const unlockedCount = unlocked.filter(Boolean).length;
  const current = stages[Math.max(0, unlockedCount - 1)];
  const active = stages.find((s) => s.id === hovered) ?? current;
  const activeIndex = active ? stages.indexOf(active) : -1;
  const activeSite = layout.sites[activeIndex];
  // The stage to play next: the first one that is not completed (it is always unlocked).
  const nextIndex = stages.findIndex((s) => progress[s.id]?.completed !== true);
  const nextSite = layout.sites[nextIndex];
  const totals = summarizeProgress(stages, progress);
  const showDetails = mode === 'wide' && !touch;

  const card = (scenario: Scenario, index: number) => (
    <StageCard
      scenario={scenario}
      progress={progress[scenario.id]}
      unlocked={unlocked[index] === true}
      // Only where the details area follows it.
      active={showDetails && scenario === active}
      next={index === nextIndex}
      onOpen={() => void openStage(scenario.id)}
      onFocus={() => setHovered(scenario.id)}
    />
  );

  return (
    <section className={`stages stages--${mode}`} aria-labelledby="stages-heading">
      <div className="stages__bar">
        <button type="button" className="btn btn--sm" onClick={goHome}>
          <IconBack />
          {tr(stagesStrings.home)}
        </button>
        <h1 id="stages-heading" tabIndex={-1}>
          {tr(stagesStrings.heading)}
        </h1>
        <HelpButton topic={tr(stagesStrings.introTopic)}>{tr(stagesStrings.intro)}</HelpButton>
        <p className="stages__total" data-testid="stages-total">
          <span className="stages__total-star">
            <IconStar filled />
          </span>
          <span className="visually-hidden">{tr(stagesStrings.totalStars)}: </span>
          <span className="num">
            {totals.stars} / {totals.maxStars}
          </span>
        </p>
      </div>
      {stages.length === 0 ? (
        <p className="muted">{tr(stagesStrings.empty)}</p>
      ) : mode === 'tall' ? (
        // Phone: a drawing and a card per stage, in normal flow.
        <ol className="stage-map stage-map--tall stage-map__list">
          {stages.map((scenario, index) => {
            const strip = strips.strips[index]!;
            const open = unlocked[index] === true;
            return (
              <li key={scenario.id} className="stage-map__row">
                <svg
                  className="stage-map__art"
                  viewBox={`0 0 ${strips.width} ${strips.height}`}
                  aria-hidden="true"
                  focusable="false"
                >
                  <StripScenery
                    strip={strip}
                    order={scenario.order}
                    unlocked={open}
                    nextUnlocked={unlocked[index + 1] === true}
                  />
                  {index === nextIndex && (
                    <circle className="m-pulse" cx={strip.x} cy={strip.y + ROAD_DY} r="12" />
                  )}
                  <rect
                    className={open ? 'm-hit m-hit--open' : 'm-hit'}
                    x={strip.x - 90}
                    y={strip.y - 60}
                    width="180"
                    height="120"
                    onClick={open ? () => void openStage(scenario.id) : undefined}
                  />
                </svg>
                {card(scenario, index)}
              </li>
            );
          })}
        </ol>
      ) : (
        <>
          {/* Wide: the cards lie over the drawing. Row: they are a line under it, one column
              per neighbourhood. */}
          <div
            className={`stage-map stage-map--${mode}`}
            style={
              mode === 'wide' ? { aspectRatio: `${layout.width} / ${layout.height}` } : undefined
            }
            onMouseLeave={() => setHovered(null)}
          >
            <svg
              className="stage-map__art"
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              aria-hidden="true"
              focusable="false"
            >
              <Scenery layout={layout} orders={orders} unlockedCount={unlockedCount} />
              {nextSite && (
                <circle className="m-pulse" cx={nextSite.x} cy={nextSite.y + ROAD_DY} r="12" />
              )}
              {showDetails && activeSite && (
                <ellipse
                  className="m-halo"
                  cx={activeSite.x}
                  cy={activeSite.y + 4}
                  rx="96"
                  ry="60"
                />
              )}
              {layout.sites.map((site, index) => {
                const scenario = stages[index]!;
                return (
                  <rect
                    key={scenario.id}
                    className={unlocked[index] ? 'm-hit m-hit--open' : 'm-hit'}
                    x={site.x - 90}
                    y={site.y - 60}
                    width="180"
                    height="120"
                    onMouseEnter={() => setHovered(scenario.id)}
                    onClick={unlocked[index] ? () => void openStage(scenario.id) : undefined}
                  />
                );
              })}
            </svg>
            <ol className="stage-map__list">
              {stages.map((scenario, index) => (
                <li
                  key={scenario.id}
                  className="stage-map__item"
                  style={layout.sites[index]?.label}
                  onMouseEnter={() => setHovered(scenario.id)}
                >
                  {card(scenario, index)}
                </li>
              ))}
            </ol>
          </div>
          {/* With a pointer: the stage under it or with focus, for sighted users (the button
              has the same text as its description). */}
          {showDetails && active && (
            <div className="stages__details" aria-hidden="true" data-testid="stage-details">
              <strong>{tr(stagesStrings.unlockedLabel(active.order, tr(active.title)))}</strong>
              <StageFacts
                scenario={active}
                progress={progress[active.id]}
                unlocked={unlocked[activeIndex] === true}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}

interface StageFactsProps {
  scenario: Scenario;
  progress: StageProgress | undefined;
  unlocked: boolean;
}

/** Summary and best cost of a stage, or how to unlock it. No status word: the card has it. */
function StageFacts({ scenario, progress, unlocked }: StageFactsProps) {
  const tr = useTr();
  const fmt = useFormat();
  return (
    <>
      <span className="stage-facts__line">{tr(scenario.summary)}</span>
      {progress?.bestCost != null && (
        <span className="stage-facts__line">
          {tr(stagesStrings.bestCost)}:{' '}
          <span className="num">{money(fmt(progress.bestCost, 2))}</span>
        </span>
      )}
      {!unlocked && (
        <span className="stage-facts__line muted">
          {tr(stagesStrings.lockedHint(scenario.order - 1))}
        </span>
      )}
    </>
  );
}

interface StageCardProps extends StageFactsProps {
  active: boolean;
  /** The stage to play next. */
  next: boolean;
  onOpen: () => void;
  onFocus: () => void;
}

/**
 * Card of a neighbourhood: the button that opens the stage (number, short name, status as
 * icons) and, beside it, the "?" with the summary, the status in words and the best cost.
 */
function StageCard({
  scenario,
  progress,
  unlocked,
  active,
  next,
  onOpen,
  onFocus,
}: StageCardProps) {
  const tr = useTr();
  const detailsId = useId();
  const title = tr(scenario.title);
  const status = !unlocked
    ? stagesStrings.locked
    : progress?.completed
      ? stagesStrings.completed
      : progress
        ? stagesStrings.inProgress
        : stagesStrings.notStarted;

  return (
    <div className="stage-card">
      <button
        type="button"
        className={['stage-pin', active && 'stage-pin--active', next && 'stage-pin--next']
          .filter(Boolean)
          .join(' ')}
        disabled={!unlocked}
        // The full title is the name; the card shows the short one.
        aria-label={tr(
          unlocked
            ? stagesStrings.unlockedLabel(scenario.order, title)
            : stagesStrings.lockedLabel(scenario.order, title, scenario.order - 1),
        )}
        aria-describedby={unlocked ? detailsId : undefined}
        onClick={onOpen}
        onFocus={onFocus}
      >
        <span className="stage-pin__number num" aria-hidden="true">
          {scenario.order}
        </span>
        <span className="stage-pin__title">{tr(shortTitle(scenario))}</span>
        <span id={detailsId} className="stage-pin__details">
          {next && (
            // Hidden from the description, which ends with the same information in words.
            <span className="badge badge--info" aria-hidden="true">
              <IconNext />
              {tr(stagesStrings.next)}
            </span>
          )}
          {/* The status is an icon; its word is for screen readers. */}
          <span
            className={
              progress?.completed ? 'stage-pin__status stage-pin__status--ok' : 'stage-pin__status'
            }
          >
            {!unlocked ? (
              <IconLock />
            ) : progress?.completed ? (
              <IconCheck />
            ) : (
              progress && <IconPending />
            )}
            <span className="visually-hidden">{tr(status)}</span>
          </span>
          {progress?.completed && <Stars value={progress.stars} />}
          {unlocked && (
            <>
              {/* The separators make the description read as sentences. */}
              <span className="visually-hidden">.</span>{' '}
              <span className="visually-hidden">{tr(scenario.summary)}</span>
              {next && <span className="visually-hidden">. {tr(stagesStrings.nextHint)}</span>}
            </>
          )}
        </span>
      </button>
      <HelpButton topic={title} className="stage-card__help">
        <span className="stage-facts__line">
          <strong>{tr(status)}</strong>
        </span>
        <StageFacts scenario={scenario} progress={progress} unlocked={unlocked} />
      </HelpButton>
    </div>
  );
}
