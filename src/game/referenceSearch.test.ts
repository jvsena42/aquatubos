import { getScenario } from '../scenarios';
import type { Scenario } from '../scenarios/types';
import { designPasses, findReferenceDesign } from './referenceSearch';

const stage1 = getScenario('stage1')!;

describe('findReferenceDesign', () => {
  it('reproduces the stored reference of stage 1 by exhaustive search', () => {
    const found = findReferenceDesign(stage1)!;
    expect(found.method).toBe('exhaustive');
    expect(found.cost).toBeCloseTo(stage1.reference.cost, 2);
    expect(designPasses(stage1, found.diameters)).toBe(true);
  });

  it('finds the same cost by branch and bound', () => {
    const found = findReferenceDesign(stage1, undefined, { exhaustive: 0 })!;
    expect(found.method).toBe('branch-and-bound');
    expect(found.cost).toBeCloseTo(stage1.reference.cost, 2);
    expect(designPasses(stage1, found.diameters)).toBe(true);
  });

  it('falls back to the heuristic result when branch and bound hits its limit', () => {
    const found = findReferenceDesign(stage1, undefined, { exhaustive: 0, branchAndBound: 3 })!;
    expect(found.method).toBe('greedy+pairs');
    expect(designPasses(stage1, found.diameters)).toBe(true);
    // The heuristic may be more expensive than the optimum, never cheaper.
    expect(found.cost).toBeGreaterThanOrEqual(stage1.reference.cost - 0.01);
  });

  it('keeps fixed pipes at their initial diameter', () => {
    const fixed: Scenario = {
      ...stage1,
      pipes: stage1.pipes.map((p) => (p.id === 'T1' ? { ...p, initialDN: 150, fixed: true } : p)),
    };
    for (const limits of [{}, { exhaustive: 0 }]) {
      const found = findReferenceDesign(fixed, undefined, limits)!;
      expect(found.diameters.T1).toBe(150);
      expect(designPasses(fixed, found.diameters)).toBe(true);
    }
  });

  it('returns null when no design can pass', () => {
    const impossible: Scenario = {
      ...stage1,
      reservoirs: stage1.reservoirs.map((r) => ({ ...r, waterLevel: 105 })),
    };
    expect(findReferenceDesign(impossible)).toBeNull();
    expect(findReferenceDesign(stage1, [])).toBeNull();
  });
});
