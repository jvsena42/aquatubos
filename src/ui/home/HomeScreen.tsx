import { useFormat, useTr } from '../../i18n';
import { SCENARIOS } from '../../scenarios';
import { useAppStore } from '../../state/store';
import { usePhoneLandscape } from '../shell/breakpoints';
import { HelpButton } from '../shell/Help';
import { IconNext, IconStar } from '../shell/icons';
import { money, shellStrings } from '../shell/strings';
import { shortTitle, stagesStrings } from '../stages/strings';
import { HomeLogo } from './HomeLogo';
import { homeAction, summarizeProgress } from './homeModel';
import { HomeScene } from './HomeScene';
import { homeStrings } from './strings';
import './home.css';

/**
 * Title screen: the name, one button and the saved progress, over the town scene. Everything
 * that explains sits behind the "?" next to the tagline; how to play, the glossary and the
 * credits are in the header menu.
 */
export function HomeScreen() {
  const tr = useTr();
  const fmt = useFormat();
  const progress = useAppStore((s) => s.progress);
  const goToMap = useAppStore((s) => s.goToMap);
  const openStage = useAppStore((s) => s.openStage);
  // A phone held sideways: name on the left, button and progress on the right.
  const landscape = usePhoneLandscape();

  const action = homeAction(SCENARIOS, progress);
  const summary = summarizeProgress(SCENARIOS, progress);

  // The one button: Play, Continue (with the stage it opens) or, when all is done, the map.
  const playLabel = tr(
    action.kind === 'continue'
      ? homeStrings.continue
      : action.kind === 'done'
        ? homeStrings.stageMap
        : homeStrings.play,
  );
  const playDetail =
    action.kind === 'continue'
      ? tr(stagesStrings.unlockedLabel(action.stage.order, tr(shortTitle(action.stage))))
      : null;

  return (
    <section className={landscape ? 'home home--landscape' : 'home'} aria-labelledby="home-heading">
      <div className="home__content">
        {/* Two groups: stacked in portrait, side by side on a phone in landscape. */}
        <div className="home__intro">
          <h1 id="home-heading" className="home__title" tabIndex={-1}>
            <HomeLogo />
            <span className="visually-hidden">{tr(shellStrings.appName)}</span>
          </h1>
          <div className="home__pitch">
            <p className="home__tagline">{tr(homeStrings.tagline)}</p>
            <HelpButton topic={tr(homeStrings.helpTopic)}>
              <span className="home__help-line">{tr(homeStrings.lead)}</span>
              <span className="home__help-line">{tr(homeStrings.saved)}</span>
            </HelpButton>
          </div>
        </div>

        <div className="home__menu">
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
          {/* Continue opens a stage directly, so the map needs its own way in. */}
          {action.kind === 'continue' && (
            <button type="button" className="home__map-link" onClick={goToMap}>
              {tr(homeStrings.stageMap)}
            </button>
          )}

          {summary.hasProgress && (
            <div className="home__chips" role="group" aria-label={tr(homeStrings.progress)}>
              <span className="home__chip">
                <span className="home__star">
                  <IconStar filled />
                </span>
                <span className="visually-hidden">{tr(homeStrings.stars)}: </span>
                <span className="num">
                  {summary.stars}/{summary.maxStars}
                </span>
              </span>
              <span className="home__chip">
                <span className="visually-hidden">{tr(homeStrings.stagesCompleted)}: </span>
                <span className="num">
                  {summary.completed}/{summary.total}
                </span>
                <span aria-hidden="true">{tr(homeStrings.stagesUnit)}</span>
              </span>
              {summary.bestCostTotal !== null && (
                <span className="home__chip">
                  <span className="visually-hidden">
                    {tr(homeStrings.bestCost(summary.costStages))}:{' '}
                  </span>
                  <span className="num">{money(fmt(summary.bestCostTotal, 0))}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="home__scene">
        <HomeScene />
      </div>
    </section>
  );
}
