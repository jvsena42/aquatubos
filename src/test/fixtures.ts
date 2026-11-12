import type { CheckIssue } from '../engine/types';
import type { StageEvaluation, StageProgress } from '../game/types';
import type { Scenario } from '../scenarios/types';

/** Scenario for UI tests. It is not a playable stage; the evaluation is always mocked. */
export function makeScenario(order: number, overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: `stage-${order}`,
    order,
    title: { pt: `Título ${order}`, en: `Title ${order}` },
    summary: { pt: `Resumo ${order}`, en: `Summary ${order}` },
    briefing: [{ pt: `Enunciado ${order}`, en: `Briefing ${order}` }],
    objectives: [{ pt: `Objetivo ${order}`, en: `Objective ${order}` }],
    formula: 'hazen-williams',
    hazenWilliamsC: 140,
    roughnessMm: 0.0015,
    nodes: [{ id: 'N1', x: 100, y: 0, elevation: 10, demandLps: 2 }],
    reservoirs: [{ id: 'R1', x: 0, y: 0, elevation: 40, waterLevel: 45 }],
    pipes: [{ id: 'T1', from: 'R1', to: 'N1', length: 100, initialDN: 50 }],
    pumps: [],
    checks: {
      minDynamicPressure: 'error',
      maxStaticPressure: 'error',
      minVelocity: 'warning',
      maxVelocity: 'error',
      minDiameter: 'error',
    },
    budget: null,
    features: { hglProfile: false, hardyCross: false, cost: false, pumpChart: false },
    profilePath: ['R1', 'N1'],
    reference: { diameters: { T1: 75 }, cost: 1000, method: 'test' },
    ...overrides,
  };
}

export const fixtureScenarios: Scenario[] = [
  makeScenario(1),
  makeScenario(2, {
    budget: 2000,
    features: { hglProfile: true, hardyCross: false, cost: true, pumpChart: false },
  }),
  makeScenario(3, {
    features: { hglProfile: true, hardyCross: true, cost: true, pumpChart: true },
  }),
];

export function makeIssue(overrides: Partial<CheckIssue> = {}): CheckIssue {
  return {
    check: 'minDynamicPressure',
    severity: 'error',
    elementType: 'node',
    elementId: 'N1',
    value: 6,
    limit: 10,
    explanation: { pt: 'Pressão abaixo do mínimo no nó N1.', en: 'Pressure below minimum at N1.' },
    ...overrides,
  };
}

export function makeEvaluation(
  scenarioId: string,
  overrides: Partial<StageEvaluation> = {},
): StageEvaluation {
  return {
    scenarioId,
    diameters: { T1: 50 },
    network: { junctions: [], reservoirs: [], pipes: [], pumps: [] },
    result: {
      converged: true,
      iterations: 3,
      residual: 0,
      formula: 'hazen-williams',
      nodes: {},
      pipes: {},
      pumps: {},
    },
    report: { passed: true, issues: [], staticPressure: {} },
    cost: 1100,
    withinBudget: true,
    passed: true,
    stars: 2,
    ...overrides,
  };
}

export function makeProgress(
  stageId: string,
  overrides: Partial<StageProgress> = {},
): StageProgress {
  return {
    stageId,
    completed: true,
    stars: 2,
    bestCost: 12345.67,
    diameters: { T1: 75 },
    updatedAt: 1,
    ...overrides,
  };
}
