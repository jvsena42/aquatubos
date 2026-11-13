import {
  lazy,
  Suspense,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { useTr } from '../../i18n';
import type { HeadLossFormula } from '../../engine/types';
import { useAppStore } from '../../state/store';
import { StageHud } from '../hud/StageHud';
import { NetworkModeToggle, NetworkTab } from '../network/NetworkTab';
import { CalcPanel } from '../panels/CalcPanel';
import { ChecksPanel } from '../panels/ChecksPanel';
import { HardyCrossTable } from '../panels/HardyCrossTable';
import { HglProfile } from '../panels/HglProfile';
import { PumpChart } from '../panels/PumpChart';
import { ResultsTable } from '../panels/ResultsTable';
import { useDevice, useLandscape, usePhoneLandscape } from '../shell/breakpoints';
import { Dialog } from '../shell/Dialog';
import { getHeaderSlot, useHeaderSlot } from '../shell/headerSlot';
import { IconHelp, IconReset, IconStale } from '../shell/icons';
import { tabId, tabPanelId, Tabs, type TabItem } from '../shell/Tabs';
import { SHEET_HALF } from './sheetState';
import { StageSheet } from './StageSheet';
import { FORMULAS, formulaLabels, stageStrings, tabLabels, type StageTab } from './strings';
import './stage.css';

// three.js is only downloaded when the 3D tab is opened.
const Network3D = lazy(() => import('../three/Network3D'));

/**
 * Layout of an open stage. Mount it with `key={scenario.id}` so each stage starts fresh.
 *
 * The stage name, the briefing button and, on phones, the HUD go into the app header (through
 * `useHeaderSlot`), so the top of the screen is one row.
 *
 * Desktop: a bar with the HUD and the actions, the views and a side column with the calculation
 * and the checks; the page scrolls.
 * Phones and tablets: a frame that does not scroll. The view fills it and the two panels are in
 * a bottom sheet whose bar holds "Calcular / Verificar"; held sideways (a phone) or in landscape
 * (a tablet) the sheet is a panel beside the view. Formula and reset are in the header menu.
 */
export function StageScreen() {
  const tr = useTr();
  const scenario = useAppStore((s) => s.scenario);
  const formula = useAppStore((s) => s.formula);
  const stale = useAppStore((s) => s.stale);
  const solving = useAppStore((s) => s.solving);
  const setFormula = useAppStore((s) => s.setFormula);
  const verify = useAppStore((s) => s.verify);
  const resetDiameters = useAppStore((s) => s.resetDiameters);

  const idBase = useId();
  const formulaId = useId();
  const [tab, setTab] = useState<StageTab>('network');
  const [briefingOpen, setBriefingOpen] = useState(true);
  const heading = useRef<HTMLHeadingElement>(null);
  const slot = useHeaderSlot();
  const inline = useRef<HTMLDivElement>(null);
  // The head is rendered into an element of its own, which is then placed in the header slot
  // (or in the stage itself where there is no header, as in component tests). Placing it in a
  // layout effect of the commit that mounts the stage means the heading is already in the
  // header when App moves the focus to it, and it is never re-created.
  const [host] = useState(() => {
    const element = document.createElement('div');
    element.className = 'stage__head-host';
    return element;
  });
  useLayoutEffect(() => {
    // Only moved when the place changes: taking a focused heading out of the document blurs it.
    const parent = getHeaderSlot() ?? inline.current;
    if (parent && host.parentElement !== parent) parent.append(host);
  }, [slot, host]);
  useLayoutEffect(() => () => host.remove(), [host]);
  const device = useDevice();
  const landscape = useLandscape();
  const sideways = usePhoneLandscape();

  if (!scenario) return null;

  const phone = device === 'phone';
  const tablet = device === 'tablet';
  const framed = phone || tablet;
  const side = phone ? sideways : tablet && landscape;
  const half = phone ? SHEET_HALF.phone : SHEET_HALF.tablet;

  const available: StageTab[] = [
    'network',
    'table',
    ...(scenario.features.hglProfile ? (['profile'] as const) : []),
    ...(scenario.features.hardyCross ? (['hardyCross'] as const) : []),
    ...(scenario.features.pumpChart ? (['pump'] as const) : []),
    '3d',
  ];
  const tabs: TabItem<StageTab>[] = available.map((id) => ({ id, label: tr(tabLabels[id]) }));
  const active: StageTab = available.includes(tab) ? tab : 'network';
  const stageTitle = `${tr(stageStrings.stage(scenario.order))}: ${tr(scenario.title)}`;

  const staleNotice = stale && !solving;

  const closeBriefing = () => {
    setBriefingOpen(false);
    // The dialog gives the focus back to what had it before. When that is nothing, or <main>
    // (where App parks the focus while the stage loads; it shows no ring), the heading takes
    // it, so the keyboard starts at the top of the stage on something with a visible ring.
    requestAnimationFrame(() => {
      const current = document.activeElement;
      if (!current || current === document.body || current.tagName === 'MAIN') {
        heading.current?.focus();
      }
    });
  };

  const stageClass = [
    'stage',
    framed && 'stage--frame',
    phone && 'stage--phone',
    tablet && 'stage--tablet',
    framed && side && 'stage--side',
  ]
    .filter(Boolean)
    .join(' ');
  const stageStyle = framed
    ? ({ '--sheet-half-fraction': String(half) } as CSSProperties)
    : undefined;

  // Name of the stage, its numbers on phones, and the briefing: shown in the app header.
  const head = (
    <div className={phone ? 'stage__head stage__head--phone' : 'stage__head'}>
      <h1 ref={heading} className="stage__title" tabIndex={-1}>
        <span className="stage__number">
          {tr(stageStrings.stage(scenario.order))}
          <span className="visually-hidden">:</span>
        </span>{' '}
        <span className="stage__name">{tr(scenario.title)}</span>
      </h1>
      {phone && <StageHud compact />}
      <button
        type="button"
        className="btn btn--ghost btn--icon stage__briefing"
        aria-label={tr(stageStrings.briefing)}
        title={tr(stageStrings.briefing)}
        onClick={() => setBriefingOpen(true)}
      >
        <IconHelp />
      </button>
    </div>
  );

  return (
    <div className={stageClass} style={stageStyle}>
      <div ref={inline} className="stage__head-inline" />
      {createPortal(head, host)}

      {!phone && (
        <div className="stage__bar" role="group" aria-label={tr(stageStrings.hudBar)}>
          <StageHud />
          {!framed && (
            <div className="stage__actions">
              <div className="stage__formula">
                <label htmlFor={formulaId} className="visually-hidden">
                  {tr(stageStrings.formula)}
                </label>
                <select
                  id={formulaId}
                  className="select"
                  value={formula}
                  onChange={(event) => setFormula(event.target.value as HeadLossFormula)}
                >
                  {FORMULAS.map((option) => (
                    <option key={option} value={option}>
                      {formulaLabels[option]}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className="btn" onClick={resetDiameters}>
                <IconReset />
                {tr(stageStrings.reset)}
              </button>
              <button
                type="button"
                className="btn btn--primary stage__verify"
                disabled={solving}
                data-stale={staleNotice ? 'true' : undefined}
                onClick={() => void verify()}
              >
                {staleNotice && <IconStale />}
                {tr(solving ? stageStrings.solving : stageStrings.verify)}
              </button>
            </div>
          )}
        </div>
      )}

      <p className="visually-hidden" role="status">
        {staleNotice && tr(stageStrings.stale)}
      </p>

      <div className="stage__layout">
        <section className="panel stage__main" aria-label={tr(stageStrings.views)}>
          <div className="stage__tabs">
            <Tabs
              idBase={idBase}
              label={tr(stageStrings.views)}
              tabs={tabs}
              active={active}
              onChange={setTab}
            />
            {framed && active === 'network' && <NetworkModeToggle compact={phone} />}
          </div>
          <div
            role="tabpanel"
            id={tabPanelId(idBase, active)}
            aria-labelledby={tabId(idBase, active)}
            tabIndex={0}
            className={
              active === 'network' || active === '3d'
                ? 'stage__tabpanel stage__tabpanel--flush'
                : 'stage__tabpanel'
            }
          >
            {active === 'network' && <NetworkTab toggle={!framed} />}
            {active === 'table' && <ResultsTable />}
            {active === 'profile' && <HglProfile />}
            {active === 'hardyCross' && <HardyCrossTable />}
            {active === 'pump' && <PumpChart />}
            {active === '3d' && (
              <Suspense fallback={<p className="muted">{tr(stageStrings.loading3d)}</p>}>
                <Network3D />
              </Suspense>
            )}
          </div>
        </section>

        {!framed && (
          <aside className="stage__side" aria-label={tr(stageStrings.sidePanel)}>
            <section className="panel" aria-labelledby={`${idBase}-calc`}>
              <h2 id={`${idBase}-calc`} className="panel__title">
                {tr(stageStrings.calcPanel)}
              </h2>
              <div className="panel__body">
                <CalcPanel />
              </div>
            </section>
            <section className="panel" aria-labelledby={`${idBase}-checks`}>
              <h2 id={`${idBase}-checks`} className="panel__title">
                {tr(stageStrings.checksPanel)}
              </h2>
              <div className="panel__body">
                <ChecksPanel />
              </div>
            </section>
          </aside>
        )}
      </div>

      {framed && <StageSheet side={side} half={half} />}

      <Dialog
        open={briefingOpen}
        onClose={closeBriefing}
        title={stageTitle}
        footer={
          <button type="button" className="btn btn--primary" onClick={closeBriefing}>
            {tr(stageStrings.continue)}
          </button>
        }
      >
        <div className="briefing">
          {scenario.briefing.map((paragraph, index) => (
            <p key={index}>{tr(paragraph)}</p>
          ))}
          <h3>{tr(stageStrings.objectives)}</h3>
          <ul>
            {scenario.objectives.map((objective, index) => (
              <li key={index}>{tr(objective)}</li>
            ))}
          </ul>
        </div>
      </Dialog>
    </div>
  );
}
