import type { Network } from '../engine/types';
import { getScenario } from '../scenarios';
import { buildNetwork, initialDiameters } from './buildNetwork';
import { designCost, evaluateStage } from './evaluate';
import { pumpChart } from './systemCurve';
import { solveNetwork } from '../engine/solver';

describe('buildNetwork', () => {
  it('converts display units to SI', () => {
    const scenario = getScenario('stage5')!;
    const network = buildNetwork(scenario, { ...initialDiameters(scenario), T1: 150 });
    expect(network.junctions.find((j) => j.id === 'N2')).toEqual({
      id: 'N2',
      elevation: 112,
      demand: 0.002,
    });
    expect(network.reservoirs).toEqual([{ id: 'R1', head: 100 }]);
    const t1 = network.pipes.find((p) => p.id === 'T1')!;
    expect(t1.diameter).toBeCloseTo(0.15, 12);
    expect(t1.hazenWilliamsC).toBe(140);
    expect(t1.roughness).toBeCloseTo(0.0000015, 12);
    // Points (0, 50), (10 L/s, 44), (20 L/s, 26) give H = 50 − 60000·Q².
    const curve = network.pumps[0]!.curve;
    expect(curve.a).toBeCloseTo(50, 9);
    expect(curve.c).toBeCloseTo(2, 9);
    expect(curve.b).toBeCloseTo(60000, 3);
  });

  it('falls back to the initial DN for pipes without a chosen diameter', () => {
    const scenario = getScenario('stage1')!;
    expect(buildNetwork(scenario, {}).pipes.every((p) => p.diameter === 0.05)).toBe(true);
  });
});

describe('evaluateStage', () => {
  it('computes the cost from the catalog', () => {
    const scenario = getScenario('stage1')!;
    // 1100 m of DN 50 at R$ 25/m.
    expect(designCost(scenario, initialDiameters(scenario))).toBeCloseTo(27500, 2);
  });

  it('fails a design that passes the checks but exceeds the budget', () => {
    const scenario = getScenario('stage4')!;
    const all150 = Object.fromEntries(scenario.pipes.map((p) => [p.id, 150]));
    const evaluation = evaluateStage(scenario, all150);
    expect(evaluation.report.passed).toBe(true);
    expect(evaluation.withinBudget).toBe(false);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.stars).toBe(0);
  });

  it('returns plain data that survives structured cloning', () => {
    const scenario = getScenario('stage4')!;
    const evaluation = evaluateStage(scenario, scenario.reference.diameters);
    expect(structuredClone(evaluation)).toEqual(evaluation);
    expect(JSON.parse(JSON.stringify(evaluation))).toEqual(
      JSON.parse(JSON.stringify(structuredClone(evaluation))),
    );
  });

  it('omits the Hardy Cross table and the pump chart where the stage does not use them', () => {
    const scenario = getScenario('stage1')!;
    const evaluation = evaluateStage(scenario, scenario.reference.diameters);
    expect(evaluation.hardyCross).toBeUndefined();
    expect(evaluation.pumpChart).toBeUndefined();
  });

  it('detects loops when the scenario does not list them', () => {
    const scenario = { ...getScenario('stage3')!, loops: undefined };
    const evaluation = evaluateStage(scenario, scenario.reference.diameters);
    expect(evaluation.hardyCross?.loops).toHaveLength(1);
    expect(evaluation.hardyCross?.result.converged).toBe(true);
  });

  it('has no Hardy Cross table for a branched network', () => {
    const base = getScenario('stage1')!;
    const scenario = { ...base, features: { ...base.features, hardyCross: true } };
    expect(evaluateStage(scenario, base.reference.diameters).hardyCross).toBeUndefined();
  });
});

describe('pumpChart', () => {
  const scenario = getScenario('stage5')!;
  const network = buildNetwork(scenario, scenario.reference.diameters);
  const result = solveNetwork(network);

  it('starts the system curve at the static lift plus the minimum pressure', () => {
    const chart = pumpChart(network, result, 10)!;
    // Highest node N4 at 128 m needs 138 m; the reservoir is at 100 m.
    expect(chart.points[0]).toEqual({ flow: 0, pumpHead: 50, systemHead: 38 });
    const heads = chart.points.map((p) => p.systemHead);
    expect([...heads].sort((a, b) => a - b)).toEqual(heads);
  });

  it('matches the solved network at the operating point', () => {
    const chart = pumpChart(network, result, 10)!;
    // Pump head minus required head equals the pressure margin at the worst node.
    const margin = Math.min(
      ...network.junctions
        .filter((j) => j.id !== 'J1')
        .map((j) => result.nodes[j.id]!.pressure - 10),
    );
    expect(chart.operating.head - chart.requiredHead).toBeCloseTo(margin, 6);
  });

  it('is undefined for layouts it does not cover', () => {
    const noPump: Network = { ...network, pumps: [] };
    expect(pumpChart(noPump, result, 10)).toBeUndefined();
    const twoReservoirs: Network = {
      ...network,
      reservoirs: [...network.reservoirs, { id: 'R2', head: 150 }],
    };
    expect(pumpChart(twoReservoirs, result, 10)).toBeUndefined();
    const noDemand: Network = {
      ...network,
      junctions: network.junctions.map((j) => ({ ...j, demand: 0 })),
    };
    expect(pumpChart(noDemand, result, 10)).toBeUndefined();
    const pumpNotAtSource: Network = {
      ...network,
      pumps: [{ ...network.pumps[0]!, from: 'N2', to: 'N3' }],
    };
    expect(pumpChart(pumpNotAtSource, result, 10)).toBeUndefined();
  });
});
