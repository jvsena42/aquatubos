import { useId, useMemo, useState, useSyncExternalStore } from 'react';
import { useFormat, useTr } from '../../i18n';
import type { StageProgress } from '../../game/types';
import { SCENARIOS } from '../../scenarios';
import type { Scenario } from '../../scenarios/types';
import { isUnlocked, useAppStore } from '../../state/store';
import { summarizeProgress } from '../home/homeModel';
import { IconBack, IconCheck, IconLock, IconNext, IconStar } from '../shell/icons';
import { Stars } from '../shell/Stars';
import { money } from '../shell/strings';
import { ROAD_DY, stripLayout, wideLayout, type Site } from './mapLayout';
import { Scenery, StripScenery } from './StageMap';
import { stagesStrings } from './strings';
import './stages.css';

/** Below this width the map is drawn as a vertical path. Keep in sync with stages.css. */
const TALL_QUERY = '(max-width: 800px)';
/** Touch screens: nothing shows on hover there, so every summary is always on screen. */
const NO_HOVER_QUERY = '(hover: none)';

/** Whether a media query matches, kept up to date. False where `matchMedia` does not exist. */
function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
    () => false,
  );
}

/** Stage select drawn as a map: one neighbourhood per stage along a road with a water main. */
export function StageSelect() {
  const tr = useTr();
  const progress = useAppStore((s) => s.progress);
  const openStage = useAppStore((s) => s.openStage);
  const goHome = useAppStore((s) => s.goHome);
  const tall = useMediaQuery(TALL_QUERY);
  const noHover = useMediaQuery(NO_HOVER_QUERY);
  const [hovered, setHovered] = useState<string | null>(null);

  const stages = useMemo(() => [...SCENARIOS].sort((a, b) => a.order - b.order), []);
  const orders = useMemo(() => stages.map((s) => s.order), [stages]);
  const layout = useMemo(() => wideLayout(stages.length), [stages.length]);
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

  return (
    <section className="stages" aria-labelledby="stages-heading">
      <div className="stages__header">
        <div className="stages__bar">
          <button type="button" className="btn btn--sm" onClick={goHome}>
            <IconBack />
            {tr(stagesStrings.home)}
          </button>
          <h1 id="stages-heading" tabIndex={-1}>
            {tr(stagesStrings.heading)}
          </h1>
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
        <p className="muted">{tr(stagesStrings.intro)}</p>
      </div>
      {stages.length === 0 ? (
        <p className="muted">{tr(stagesStrings.empty)}</p>
      ) : tall ? (
        // Phone: a drawing and a card per stage, in normal flow. The card shows the summary.
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
                <StagePin
                  scenario={scenario}
                  progress={progress[scenario.id]}
                  unlocked={open}
                  active={scenario === active}
                  next={index === nextIndex}
                  showSummary
                  onOpen={() => void openStage(scenario.id)}
                  onFocus={() => setHovered(scenario.id)}
                />
              </li>
            );
          })}
        </ol>
      ) : (
        <>
          <div
            className="stage-map"
            style={{ aspectRatio: `${layout.width} / ${layout.height}` }}
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
              {activeSite && (
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
                  style={(layout.sites[index] as Site).label}
                  onMouseEnter={() => setHovered(scenario.id)}
                >
                  <StagePin
                    scenario={scenario}
                    progress={progress[scenario.id]}
                    unlocked={unlocked[index] === true}
                    active={scenario === active}
                    next={index === nextIndex}
                    showSummary={false}
                    onOpen={() => void openStage(scenario.id)}
                    onFocus={() => setHovered(scenario.id)}
                  />
                </li>
              ))}
            </ol>
          </div>
          {/* The same text is the description of each button, so these copies are for sighted
              users only. With a pointer, the summary of the stage under it or with focus;
              without one, all of them. */}
          {noHover ? (
            <ol
              className="stages__details stages__details--all"
              aria-hidden="true"
              data-testid="stage-details"
            >
              {stages.map((scenario, index) => (
                <li key={scenario.id}>
                  <StageDetails scenario={scenario} unlocked={unlocked[index] === true} />
                </li>
              ))}
            </ol>
          ) : (
            active && (
              <div className="stages__details" aria-hidden="true" data-testid="stage-details">
                <StageDetails scenario={active} unlocked={unlocked[activeIndex] === true} />
              </div>
            )
          )}
        </>
      )}
    </section>
  );
}

/** Title and summary of a stage, and how to unlock it when it is locked. */
function StageDetails({ scenario, unlocked }: { scenario: Scenario; unlocked: boolean }) {
  const tr = useTr();
  return (
    <>
      <strong>{tr(stagesStrings.unlockedLabel(scenario.order, tr(scenario.title)))}</strong>
      <p>{tr(scenario.summary)}</p>
      {!unlocked && <p className="muted">{tr(stagesStrings.lockedHint(scenario.order - 1))}</p>}
    </>
  );
}

interface StagePinProps {
  scenario: Scenario;
  progress: StageProgress | undefined;
  unlocked: boolean;
  active: boolean;
  /** The stage to play next. */
  next: boolean;
  /** Show the summary in the card (phone map); otherwise it is only part of the description. */
  showSummary: boolean;
  onOpen: () => void;
  onFocus: () => void;
}

/** Label of a neighbourhood: the button that opens the stage, with its status. */
function StagePin({
  scenario,
  progress,
  unlocked,
  active,
  next,
  showSummary,
  onOpen,
  onFocus,
}: StagePinProps) {
  const tr = useTr();
  const fmt = useFormat();
  const detailsId = useId();
  const title = tr(scenario.title);

  return (
    <button
      type="button"
      className={['stage-pin', active && 'stage-pin--active', next && 'stage-pin--next']
        .filter(Boolean)
        .join(' ')}
      disabled={!unlocked}
      aria-label={tr(
        unlocked
          ? stagesStrings.unlockedLabel(scenario.order, title)
          : stagesStrings.lockedLabel(scenario.order, title, scenario.order - 1),
      )}
      aria-describedby={unlocked ? detailsId : undefined}
      onClick={onOpen}
      onFocus={onFocus}
    >
      <span className="stage-pin__head">
        <span className="stage-pin__number num" aria-hidden="true">
          {scenario.order}
        </span>
        <span className="stage-pin__title">{title}</span>
      </span>
      <span id={detailsId} className="stage-pin__details">
        {!unlocked ? (
          <>
            <span className="badge">
              <IconLock />
              {tr(stagesStrings.locked)}
            </span>
            {showSummary && (
              <>
                <span className="stage-pin__summary">{tr(scenario.summary)}</span>
                <span className="stage-pin__hint">
                  {tr(stagesStrings.lockedHint(scenario.order - 1))}
                </span>
              </>
            )}
          </>
        ) : (
          <>
            {next && (
              // Hidden from the description, which ends with the same information in words.
              <span className="badge badge--info" aria-hidden="true">
                <IconNext />
                {tr(stagesStrings.next)}
              </span>
            )}
            {progress?.completed ? (
              <span className="badge badge--ok">
                <IconCheck />
                {tr(stagesStrings.completed)}
              </span>
            ) : (
              <span className="badge">
                {tr(progress ? stagesStrings.inProgress : stagesStrings.notStarted)}
              </span>
            )}
            {progress?.completed && <Stars value={progress.stars} />}
            {progress?.bestCost != null && (
              <span className="stage-pin__cost">
                {tr(stagesStrings.bestCost)}:{' '}
                <span className="num">{money(fmt(progress.bestCost, 2))}</span>
              </span>
            )}
            {/* The separators make the description read as sentences. */}
            <span className="visually-hidden">.</span>{' '}
            <span className={showSummary ? 'stage-pin__summary' : 'visually-hidden'}>
              {tr(scenario.summary)}
            </span>
            {next && <span className="visually-hidden">. {tr(stagesStrings.nextHint)}</span>}
          </>
        )}
      </span>
    </button>
  );
}
