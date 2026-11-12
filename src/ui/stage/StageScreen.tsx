import { lazy, Suspense, useId, useState } from 'react';
import { useTr } from '../../i18n';
import type { HeadLossFormula } from '../../engine/types';
import { useAppStore } from '../../state/store';
import { NetworkView } from '../network/NetworkView';
import { CalcPanel } from '../panels/CalcPanel';
import { ChecksPanel } from '../panels/ChecksPanel';
import { HardyCrossTable } from '../panels/HardyCrossTable';
import { HglProfile } from '../panels/HglProfile';
import { PumpChart } from '../panels/PumpChart';
import { ResultsTable } from '../panels/ResultsTable';
import { Dialog } from '../shell/Dialog';
import { IconInfo, IconStale } from '../shell/icons';
import { tabId, tabPanelId, Tabs, type TabItem } from '../shell/Tabs';
import { formulaLabels, stageStrings, tabLabels, type StageTab } from './strings';
import './stage.css';

// three.js is only downloaded when the 3D tab is opened.
const Network3D = lazy(() => import('../three/Network3D'));

const FORMULAS: HeadLossFormula[] = ['hazen-williams', 'darcy-weisbach'];

/** Layout of an open stage. Mount it with `key={scenario.id}` so each stage starts fresh. */
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

  if (!scenario) return null;

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

  return (
    <div className="stage">
      <header className="stage__bar">
        <h1 className="stage__title">
          <span className="stage__number">{tr(stageStrings.stage(scenario.order))}</span>
          {tr(scenario.title)}
        </h1>

        <div className="stage__actions">
          <button type="button" className="btn" onClick={() => setBriefingOpen(true)}>
            <IconInfo />
            {tr(stageStrings.briefing)}
          </button>
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
            {tr(stageStrings.reset)}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={solving}
            onClick={() => void verify()}
          >
            {tr(solving ? stageStrings.solving : stageStrings.verify)}
          </button>
        </div>

        <p className="stage__stale" role="status">
          {stale && !solving && (
            <span className="badge badge--warn">
              <IconStale />
              {tr(stageStrings.stale)}
            </span>
          )}
        </p>
      </header>

      <div className="stage__layout">
        <section className="panel stage__main" aria-label={tr(stageStrings.views)}>
          <Tabs
            idBase={idBase}
            label={tr(stageStrings.views)}
            tabs={tabs}
            active={active}
            onChange={setTab}
          />
          <div
            role="tabpanel"
            id={tabPanelId(idBase, active)}
            aria-labelledby={tabId(idBase, active)}
            tabIndex={0}
            className="stage__tabpanel"
          >
            {active === 'network' && <NetworkView />}
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
      </div>

      <Dialog
        open={briefingOpen}
        onClose={() => setBriefingOpen(false)}
        title={stageTitle}
        footer={
          <button type="button" className="btn btn--primary" onClick={() => setBriefingOpen(false)}>
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
