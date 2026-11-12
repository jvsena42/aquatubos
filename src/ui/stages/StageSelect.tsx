import { useId } from 'react';
import { useFormat, useTr } from '../../i18n';
import type { StageProgress } from '../../game/types';
import { SCENARIOS } from '../../scenarios';
import type { Scenario } from '../../scenarios/types';
import { isUnlocked, useAppStore } from '../../state/store';
import { IconCheck, IconLock } from '../shell/icons';
import { Stars } from '../shell/Stars';
import { money } from '../shell/strings';
import { stagesStrings } from './strings';
import './stages.css';

export function StageSelect() {
  const tr = useTr();
  const progress = useAppStore((s) => s.progress);
  const openStage = useAppStore((s) => s.openStage);
  const stages = [...SCENARIOS].sort((a, b) => a.order - b.order);

  return (
    <section className="stages" aria-labelledby="stages-heading">
      <div className="stages__header">
        <h1 id="stages-heading">{tr(stagesStrings.heading)}</h1>
        <p className="muted">{tr(stagesStrings.intro)}</p>
      </div>
      {stages.length === 0 ? (
        <p className="muted">{tr(stagesStrings.empty)}</p>
      ) : (
        <ol className="stages__list">
          {stages.map((scenario) => (
            <li key={scenario.id}>
              <StageCard
                scenario={scenario}
                progress={progress[scenario.id]}
                unlocked={isUnlocked(scenario, progress)}
                onOpen={() => void openStage(scenario.id)}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

interface StageCardProps {
  scenario: Scenario;
  progress: StageProgress | undefined;
  unlocked: boolean;
  onOpen: () => void;
}

function StageCard({ scenario, progress, unlocked, onOpen }: StageCardProps) {
  const tr = useTr();
  const fmt = useFormat();
  const detailsId = useId();
  const title = tr(scenario.title);

  return (
    <button
      type="button"
      className="card stage-card"
      disabled={!unlocked}
      aria-label={tr(
        unlocked
          ? stagesStrings.unlockedLabel(scenario.order, title)
          : stagesStrings.lockedLabel(scenario.order, title, scenario.order - 1),
      )}
      aria-describedby={unlocked ? detailsId : undefined}
      onClick={onOpen}
    >
      <span className="stage-card__number num" aria-hidden="true">
        {scenario.order}
      </span>
      <span className="stage-card__content">
        <span className="stage-card__title">{title}</span>
        <span id={detailsId} className="stage-card__details">
          <span className="stage-card__summary">{tr(scenario.summary)}</span>
          <span className="stage-card__status">
            {!unlocked ? (
              <>
                <span className="badge">
                  <IconLock />
                  {tr(stagesStrings.locked)}
                </span>
                <span className="muted">{tr(stagesStrings.lockedHint(scenario.order - 1))}</span>
              </>
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
                <Stars value={progress?.stars ?? 0} />
                {progress?.bestCost != null && (
                  <span className="stage-card__cost">
                    {tr(stagesStrings.bestCost)}:{' '}
                    <span className="num">{money(fmt(progress.bestCost, 2))}</span>
                  </span>
                )}
              </>
            )}
          </span>
        </span>
      </span>
    </button>
  );
}
