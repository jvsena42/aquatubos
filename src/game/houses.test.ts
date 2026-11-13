import { getScenario, SCENARIOS } from '../scenarios';
import { initialDiameters } from './buildNetwork';
import { evaluateStage } from './evaluate';
import { houseCount, housesSummary, serviceStatuses } from './houses';

describe('houseCount', () => {
  it('gives 3 houses per L/s between 2 and 12, none without demand', () => {
    expect(houseCount({ demandLps: 0 })).toBe(0);
    expect(houseCount({ demandLps: 0.2 })).toBe(2);
    expect(houseCount({ demandLps: 1.5 })).toBe(5);
    expect(houseCount({ demandLps: 2.5 })).toBe(8);
    expect(houseCount({ demandLps: 10 })).toBe(12);
  });

  it('gives every demand node of every stage at least two houses', () => {
    for (const scenario of SCENARIOS) {
      for (const node of scenario.nodes) {
        if (node.demandLps > 0) expect(houseCount(node)).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('serviceStatuses and housesSummary', () => {
  const stage2 = getScenario('stage2')!;

  it('is unknown before a result', () => {
    expect(new Set(Object.values(serviceStatuses(stage2, null)))).toEqual(new Set(['unknown']));
    // Demands 1, 2, 2.5, 1.5, 2, 1.5 L/s → 3 + 6 + 8 + 5 + 6 + 5 houses.
    expect(housesSummary(stage2, null)).toEqual({ served: 0, total: 33, worstNodeId: null });
  });

  it('serves every house with the reference solution', () => {
    const evaluation = evaluateStage(stage2, stage2.reference.diameters);
    expect(new Set(Object.values(serviceStatuses(stage2, evaluation)))).toEqual(new Set(['ok']));
    expect(housesSummary(stage2, evaluation)).toEqual({ served: 33, total: 33, worstNodeId: null });
  });

  it('marks nodes with low pressure and points to the worst one', () => {
    const evaluation = evaluateStage(stage2, initialDiameters(stage2));
    const statuses = serviceStatuses(stage2, evaluation);
    // N5 is the only node above 10 mca with the initial diameters.
    expect(statuses).toEqual({ N1: 'low', N2: 'low', N3: 'low', N4: 'low', N5: 'ok', N6: 'low' });
    const summary = housesSummary(stage2, evaluation);
    expect(summary.served).toBe(6);
    const pressures = stage2.nodes.map((n) => [n.id, evaluation.result.nodes[n.id]!.pressure]);
    const lowest = pressures.sort((a, b) => (a[1] as number) - (b[1] as number))[0]![0];
    expect(summary.worstNodeId).toBe(lowest);
  });

  it('marks high static pressure, with low pressure taking precedence', () => {
    const lowered = {
      ...stage2,
      nodes: stage2.nodes.map((n) => (n.id === 'N3' ? { ...n, elevation: 100 } : n)),
    };
    const passing = evaluateStage(lowered, stage2.reference.diameters);
    expect(serviceStatuses(lowered, passing).N3).toBe('high');
    expect(housesSummary(lowered, passing).worstNodeId).toBe('N3');
    expect(housesSummary(lowered, passing).served).toBe(25);
  });

  it('ignores checks that are off in the stage', () => {
    const stage1 = getScenario('stage1')!;
    const tall = { ...stage1, reservoirs: [{ ...stage1.reservoirs[0]!, waterLevel: 160 }] };
    // Static pressure is 60 mca but stage 1 has that check off.
    const evaluation = evaluateStage(tall, stage1.reference.diameters);
    expect(new Set(Object.values(serviceStatuses(tall, evaluation)))).toEqual(new Set(['ok']));
  });

  it('counts no houses at the pump discharge node', () => {
    const stage5 = getScenario('stage5')!;
    const evaluation = evaluateStage(stage5, stage5.reference.diameters);
    const summary = housesSummary(stage5, evaluation);
    expect(summary.total).toBe(6 + 8 + 6 + 8 + 9);
    expect(summary.served).toBe(summary.total);
  });
});
