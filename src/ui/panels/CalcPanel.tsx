import type { ReactNode } from 'react';
import { networkCost } from '../../engine/cost';
import { useTr } from '../../i18n';
import type { Scenario } from '../../scenarios/types';
import { useAppStore } from '../../state/store';
import { money } from '../shell/strings';
import { CalcNode } from './CalcNode';
import { Fact, useCalcFormat } from './calcParts';
import { CalcPipe } from './CalcPipe';
import { CalcPump, CalcReservoir } from './CalcSource';
import { calcStrings as text } from './calcStrings';
import './calc.css';

interface Target {
  title: string;
  body: ReactNode;
}

/**
 * The calculation of the selected element written out with the numbers of the last solve, or
 * a summary of the network when nothing is selected.
 */
export function CalcPanel() {
  const tr = useTr();
  const scenario = useAppStore((s) => s.scenario);
  const selection = useAppStore((s) => s.selection);
  const select = useAppStore((s) => s.select);

  if (!scenario) return null;

  const target = ((): Target | null => {
    if (!selection) return null;
    const { type, id } = selection;
    const pipe = scenario.pipes.find((p) => p.id === id);
    const pump = scenario.pumps.find((p) => p.id === id);
    const node = scenario.nodes.find((n) => n.id === id);
    const reservoir = scenario.reservoirs.find((r) => r.id === id);
    if (type === 'pipe' && pipe) {
      return { title: tr(text.pipe(id)), body: <CalcPipe pipe={pipe} /> };
    }
    if (type === 'pump' && pump) {
      return { title: tr(text.pump(id)), body: <CalcPump pump={pump} /> };
    }
    // Other panels may select a reservoir as a node; the id decides.
    if (node) return { title: tr(text.node(id)), body: <CalcNode node={node} /> };
    if (reservoir) {
      return { title: tr(text.reservoir(id)), body: <CalcReservoir reservoir={reservoir} /> };
    }
    return null;
  })();

  if (!target) return <Summary scenario={scenario} />;

  return (
    <div className="calc">
      <div className="calc__head">
        <h3 className="calc__title">{target.title}</h3>
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => select(null)}>
          {tr(text.clear)}
        </button>
      </div>
      {target.body}
    </div>
  );
}

function Summary({ scenario }: { scenario: Scenario }) {
  const tr = useTr();
  const { num } = useCalcFormat();
  const diameters = useAppStore((s) => s.diameters);
  const totalDemand = scenario.nodes.reduce((sum, node) => sum + node.demandLps, 0);
  const totalLength = scenario.pipes.reduce((sum, pipe) => sum + pipe.length, 0);
  const cost = networkCost(
    scenario.pipes.map((pipe) => ({
      dn: diameters[pipe.id] ?? pipe.initialDN,
      length: pipe.length,
    })),
  );

  return (
    <div className="calc">
      <p className="muted calc__hint">{tr(text.hint)}</p>
      <h3 className="calc__title">{tr(text.summary)}</h3>
      <dl className="calc__facts">
        <Fact label={tr(text.totalDemand)}>
          <span className="num" data-value="total-demand">
            {num(totalDemand, 2)} L/s
          </span>
        </Fact>
        <Fact label={tr(text.pipeCount)}>
          <span className="num" data-value="pipe-count">
            {scenario.pipes.length}
          </span>
        </Fact>
        <Fact label={tr(text.totalLength)}>
          <span className="num" data-value="total-length">
            {num(totalLength, 0)} m
          </span>
        </Fact>
        <Fact label={tr(text.currentCost)}>
          <span className="num" data-value="total-cost">
            {money(num(cost, 2))}
          </span>
        </Fact>
      </dl>
    </div>
  );
}
