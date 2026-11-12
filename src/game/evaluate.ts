import { runChecks } from '../engine/checks';
import { NBR_CHECK_LIMITS } from '../engine/config/nbr12218';
import { networkCost } from '../engine/cost';
import { findLoops, hardyCross, initialLoopFlows } from '../engine/hardyCross';
import { solveNetwork } from '../engine/solver';
import type { HeadLossFormula, Network } from '../engine/types';
import type { Diameters, Scenario } from '../scenarios/types';
import { buildNetwork } from './buildNetwork';
import { starRating } from './stars';
import { pumpChart } from './systemCurve';
import type { HardyCrossData, StageEvaluation } from './types';

/** Cost of a design, R$. */
export function designCost(scenario: Scenario, diameters: Diameters): number {
  return networkCost(
    scenario.pipes.map((p) => ({ dn: diameters[p.id] ?? p.initialDN, length: p.length })),
  );
}

function hardyCrossData(
  scenario: Scenario,
  network: Network,
  formula: HeadLossFormula,
): HardyCrossData | undefined {
  try {
    const loops = scenario.loops ?? findLoops(network);
    if (loops.length === 0) return undefined;
    const initial = initialLoopFlows(network, loops);
    return { loops, result: hardyCross(network, loops, initial, { formula }) };
  } catch {
    // The table is a teaching aid; the stage result does not depend on it.
    return undefined;
  }
}

/**
 * Solves a stage with the player's diameters and scores it. Pure function: it runs in the
 * solver worker and in tests alike.
 */
export function evaluateStage(
  scenario: Scenario,
  diameters: Diameters,
  formula: HeadLossFormula = scenario.formula,
): StageEvaluation {
  const network = buildNetwork(scenario, diameters);
  const result = solveNetwork(network, { formula });
  const report = runChecks(network, result, scenario.checks);
  const cost = designCost(scenario, diameters);
  const withinBudget = scenario.budget === null || cost <= scenario.budget;
  const passed = report.passed && withinBudget;

  return {
    scenarioId: scenario.id,
    diameters: { ...diameters },
    network,
    result,
    report,
    cost,
    withinBudget,
    passed,
    stars: starRating(passed, cost, scenario.reference.cost),
    hardyCross: scenario.features.hardyCross
      ? hardyCrossData(scenario, network, formula)
      : undefined,
    pumpChart: scenario.features.pumpChart
      ? pumpChart(network, result, NBR_CHECK_LIMITS.minDynamicPressure, { formula })
      : undefined,
  };
}
