import { useId, useMemo, useState, useSyncExternalStore } from 'react';
import { useFormat, useTr } from '../../i18n';
import type { StageProgress } from '../../game/types';
import { SCENARIOS } from '../../scenarios';
import type { Scenario } from '../../scenarios/types';
import { isUnlocked, useAppStore } from '../../state/store';
import { IconCheck, IconLock } from '../shell/icons';
import { Stars } from '../shell/Stars';
import { money } from '../shell/strings';
import { tallLayout, wideLayout, type Site } from './mapLayout';
import { Scenery } from './StageMap';
import { stagesStrings } from './strings';
import './stages.css';

/** Below this width the map is drawn as a vertical path. Keep in sync with stages.css. */
const TALL_QUERY = '(max-width: 800px)';

function subscribeTall(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const list = window.matchMedia(TALL_QUERY);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

function isTall(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(TALL_QUERY).matches;
}

/** Stage select drawn as a map: one neighbourhood per stage along a road with a water main. */
export function StageSelect() {
  const tr = useTr();
  const progress = useAppStore((s) => s.progress);
  const openStage = useAppStore((s) => s.openStage);
  const tall = useSyncExternalStore(subscribeTall, isTall, () => false);
  const [hovered, setHovered] = useState<string | null>(null);

  const stages = useMemo(() => [...SCENARIOS].sort((a, b) => a.order - b.order), []);
  const orders = useMemo(() => stages.map((s) => s.order), [stages]);
  const layout = useMemo(
    () => (tall ? tallLayout(stages.length) : wideLayout(stages.length)),
    [tall, stages.length],
  );

  const unlocked = stages.map((scenario) => isUnlocked(scenario, progress));
  // Stages unlock in order, so the unlocked ones are a prefix of the list.
  const unlockedCount = unlocked.filter(Boolean).length;
  const current = stages[Math.max(0, unlockedCount - 1)];
  const active = stages.find((s) => s.id === hovered) ?? current;
  const activeIndex = active ? stages.indexOf(active) : -1;
  const activeSite = layout.sites[activeIndex];

  return (
    <section className="stages" aria-labelledby="stages-heading">
      <div className="stages__header">
        <h1 id="stages-heading">{tr(stagesStrings.heading)}</h1>
        <p className="muted">{tr(stagesStrings.intro)}</p>
      </div>
      {stages.length === 0 ? (
        <p className="muted">{tr(stagesStrings.empty)}</p>
      ) : (
        <>
          <div
            className={tall ? 'stage-map stage-map--tall' : 'stage-map'}
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
                    onOpen={() => void openStage(scenario.id)}
                    onFocus={() => setHovered(scenario.id)}
                  />
                </li>
              ))}
            </ol>
          </div>
          {active && (
            // The same text is the description of each button, so this copy is for sighted
            // users only.
            <div className="stages__details" aria-hidden="true" data-testid="stage-details">
              <strong>{tr(stagesStrings.unlockedLabel(active.order, tr(active.title)))}</strong>
              <p>{tr(active.summary)}</p>
              {!unlocked[activeIndex] && (
                <p className="muted">{tr(stagesStrings.lockedHint(active.order - 1))}</p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

interface StagePinProps {
  scenario: Scenario;
  progress: StageProgress | undefined;
  unlocked: boolean;
  active: boolean;
  onOpen: () => void;
  onFocus: () => void;
}

/** Label of a neighbourhood: the button that opens the stage, with its status. */
function StagePin({ scenario, progress, unlocked, active, onOpen, onFocus }: StagePinProps) {
  const tr = useTr();
  const fmt = useFormat();
  const detailsId = useId();
  const title = tr(scenario.title);

  return (
    <button
      type="button"
      className={active ? 'stage-pin stage-pin--active' : 'stage-pin'}
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
          <span className="badge">
            <IconLock />
            {tr(stagesStrings.locked)}
          </span>
        ) : (
          <>
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
            <span className="visually-hidden">. {tr(scenario.summary)}</span>
          </>
        )}
      </span>
    </button>
  );
}
