import { useState } from 'react';
import { useFormat, useTr } from '../../i18n';
import { SCENARIOS } from '../../scenarios';
import { useAppStore } from '../../state/store';
import { GlossaryDialog } from '../glossary/GlossaryDialog';
import { IconBook, IconInfo, IconNext, IconStar } from '../shell/icons';
import { money, shellStrings } from '../shell/strings';
import { stagesStrings } from '../stages/strings';
import { AboutDialog } from './AboutDialog';
import { HomeLogo } from './HomeLogo';
import { homeAction, summarizeProgress } from './homeModel';
import { HomeScene } from './HomeScene';
import { HowToPlayDialog } from './HowToPlayDialog';
import { homeStrings } from './strings';
import './home.css';

type DialogId = 'howto' | 'glossary' | 'about' | null;

/** Title screen: what the game is, the main action and the saved progress. */
export function HomeScreen() {
  const tr = useTr();
  const fmt = useFormat();
  const progress = useAppStore((s) => s.progress);
  const goToMap = useAppStore((s) => s.goToMap);
  const openStage = useAppStore((s) => s.openStage);
  const [dialog, setDialog] = useState<DialogId>(null);
  const close = () => setDialog(null);

  const action = homeAction(SCENARIOS, progress);
  const summary = summarizeProgress(SCENARIOS, progress);

  // Main button: Play, Continue (with the stage it opens) or, when all is done, the stage map.
  const playLabel = tr(
    action.kind === 'continue'
      ? homeStrings.continue
      : action.kind === 'done'
        ? homeStrings.stageMap
        : homeStrings.play,
  );
  const playDetail =
    action.kind === 'continue'
      ? tr(stagesStrings.unlockedLabel(action.stage.order, tr(action.stage.title)))
      : action.kind === 'done'
        ? tr(homeStrings.allDone)
        : null;

  return (
    <section className="home" aria-labelledby="home-heading">
      <div className="home__content">
        <h1 id="home-heading" className="home__title" tabIndex={-1}>
          <HomeLogo />
          <span className="visually-hidden">{tr(shellStrings.appName)}</span>
        </h1>
        <p className="home__tagline">{tr(homeStrings.tagline)}</p>
        <p className="home__lead">{tr(homeStrings.lead)}</p>

        <div className="home__actions">
          <button
            type="button"
            className="btn btn--primary home__play"
            // The visible label and the line under it, as one name.
            aria-label={playDetail ? `${playLabel}: ${playDetail}` : undefined}
            onClick={action.kind === 'continue' ? () => void openStage(action.stage.id) : goToMap}
          >
            <span className="home__play-label">
              {playLabel}
              <IconNext />
            </span>
            {playDetail && <span className="home__play-stage">{playDetail}</span>}
          </button>
          {action.kind === 'continue' && (
            <button type="button" className="btn home__secondary" onClick={goToMap}>
              {tr(homeStrings.stageMap)}
            </button>
          )}
        </div>

        <ul className="home__links" aria-label={tr(homeStrings.more)}>
          <li>
            <button type="button" className="btn" onClick={() => setDialog('howto')}>
              {tr(homeStrings.howToPlay)}
            </button>
          </li>
          <li>
            <button type="button" className="btn" onClick={() => setDialog('glossary')}>
              <IconBook />
              {tr(homeStrings.glossary)}
            </button>
          </li>
          <li>
            <button type="button" className="btn" onClick={() => setDialog('about')}>
              <IconInfo />
              {tr(homeStrings.about)}
            </button>
          </li>
        </ul>

        {summary.hasProgress ? (
          <dl className="home__stats" role="group" aria-label={tr(homeStrings.progress)}>
            <div className="home__stat">
              <dt>{tr(homeStrings.stars)}</dt>
              <dd className="num">
                <span className="home__star">
                  <IconStar filled />
                </span>
                {summary.stars} / {summary.maxStars}
              </dd>
            </div>
            <div className="home__stat">
              <dt>{tr(homeStrings.stagesCompleted)}</dt>
              <dd className="num">
                {summary.completed} / {summary.total}
              </dd>
            </div>
            {summary.bestCostTotal !== null && (
              <div className="home__stat">
                <dt>{tr(homeStrings.bestCost(summary.costStages))}</dt>
                <dd className="num">{money(fmt(summary.bestCostTotal, 2))}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="home__zero">{tr(homeStrings.noProgress)}</p>
        )}
      </div>

      <div className="home__scene">
        <HomeScene />
      </div>

      <HowToPlayDialog open={dialog === 'howto'} onClose={close} />
      <GlossaryDialog open={dialog === 'glossary'} onClose={close} />
      <AboutDialog open={dialog === 'about'} onClose={close} />
    </section>
  );
}
