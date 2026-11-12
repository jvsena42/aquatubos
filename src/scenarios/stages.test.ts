import { COMMERCIAL_DNS } from '../engine/cost';
import { initialDiameters } from '../game/buildNetwork';
import { designCost, evaluateStage } from '../game/evaluate';
import { SCENARIOS, getScenario } from './index';
import { validateScenario } from './validate';

describe('scenario files', () => {
  it('has five stages in order', () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual(['stage1', 'stage2', 'stage3', 'stage4', 'stage5']);
    expect(SCENARIOS.map((s) => s.order)).toEqual([1, 2, 3, 4, 5]);
    expect(getScenario('stage3')?.id).toBe('stage3');
    expect(getScenario('nope')).toBeUndefined();
  });

  describe.each(SCENARIOS.map((s) => [s.id, s] as const))('%s', (_id, scenario) => {
    it('is structurally valid', () => {
      expect(validateScenario(scenario)).toEqual([]);
    });

    it('fails at least one check with the initial diameters', () => {
      const evaluation = evaluateStage(scenario, initialDiameters(scenario));
      expect(evaluation.result.converged).toBe(true);
      expect(evaluation.passed).toBe(false);
      expect(evaluation.report.issues.some((i) => i.severity === 'error')).toBe(true);
      expect(evaluation.stars).toBe(0);
    });

    it('passes every check with the reference solution', () => {
      const evaluation = evaluateStage(scenario, scenario.reference.diameters);
      expect(evaluation.result.converged).toBe(true);
      expect(evaluation.report.issues.filter((i) => i.severity === 'error')).toEqual([]);
      expect(evaluation.withinBudget).toBe(true);
      expect(evaluation.passed).toBe(true);
      expect(evaluation.stars).toBe(3);
    });

    it('stores the cost of its reference solution', () => {
      expect(designCost(scenario, scenario.reference.diameters)).toBeCloseTo(
        scenario.reference.cost,
        2,
      );
    });

    it('also passes with the reference solution under Darcy-Weisbach or says why not', () => {
      // The reference is computed with the stage formula. With the other formula the result
      // must at least converge, so the formula selector never breaks a stage.
      const other = scenario.formula === 'hazen-williams' ? 'darcy-weisbach' : 'hazen-williams';
      const evaluation = evaluateStage(scenario, scenario.reference.diameters, other);
      expect(evaluation.result.converged).toBe(true);
    });

    it('passes with the largest diameter everywhere unless a budget forbids it', () => {
      const largest = COMMERCIAL_DNS[COMMERCIAL_DNS.length - 1]!;
      const all = Object.fromEntries(scenario.pipes.map((p) => [p.id, largest]));
      const evaluation = evaluateStage(scenario, all);
      expect(evaluation.report.passed).toBe(true);
      if (scenario.budget !== null) expect(evaluation.withinBudget).toBe(false);
    });
  });

  it('gives a Hardy Cross table that agrees with the solver in the looped stages', () => {
    for (const id of ['stage3', 'stage4']) {
      const scenario = getScenario(id)!;
      const evaluation = evaluateStage(scenario, scenario.reference.diameters);
      const hc = evaluation.hardyCross;
      expect(hc).toBeDefined();
      expect(hc!.result.converged).toBe(true);
      for (const pipe of scenario.pipes) {
        expect(hc!.result.flows[pipe.id]).toBeCloseTo(evaluation.result.pipes[pipe.id]!.flow, 6);
      }
    }
  });

  it('gives a pump chart in the pumping stage with the pump above the system curve', () => {
    const scenario = getScenario('stage5')!;
    const passing = evaluateStage(scenario, scenario.reference.diameters).pumpChart!;
    expect(passing.operating.flow).toBeCloseTo(0.012, 6);
    expect(passing.operating.head).toBeGreaterThanOrEqual(passing.requiredHead);
    const failing = evaluateStage(scenario, initialDiameters(scenario)).pumpChart!;
    expect(failing.operating.head).toBeLessThan(failing.requiredHead);
  });
});

describe('validateScenario', () => {
  it('reports structural problems', () => {
    const base = getScenario('stage3')!;
    const broken = {
      ...base,
      nodes: [...base.nodes, { ...base.nodes[0]!, demandLps: -1 }],
      pipes: [
        { ...base.pipes[0]!, initialDN: 60, length: 0, to: 'ZZ' },
        { ...base.pipes[1]!, fixed: true },
        ...base.pipes.slice(2),
        { ...base.pipes[2]! },
      ],
      loops: [{ id: 'I', pipes: [{ pipeId: 'T99', direction: 1 as const }] }],
      profilePath: ['R1', 'C', 'XX'],
      budget: 1,
      reference: { ...base.reference, diameters: { ...base.reference.diameters, T3: 60 } },
      reservoirs: [],
      title: { pt: '', en: 'x' },
    };
    const problems = validateScenario(broken);
    for (const fragment of [
      'duplicate node id A',
      'no reservoir',
      'negative demand',
      'unknown node ZZ',
      'non-positive length',
      'initial DN 60',
      'reference DN 60',
      'is fixed but',
      'duplicate link id T3',
      'unknown pipe T99',
      'profile path references unknown node XX',
      'is not a link',
      'budget is below',
      'missing pt or en',
    ]) {
      expect(
        problems.some((p) => p.includes(fragment)),
        fragment,
      ).toBe(true);
    }
  });
});
