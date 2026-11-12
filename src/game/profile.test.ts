import { NBR_CHECK_LIMITS } from '../engine/config/nbr12218';
import { getScenario } from '../scenarios';
import type { Scenario } from '../scenarios/types';
import { initialDiameters } from './buildNetwork';
import { evaluateStage } from './evaluate';
import { buildProfile, findProfilePath, profilePathTo, profileSource } from './profile';

const MIN = NBR_CHECK_LIMITS.minDynamicPressure;

function stage(id: string): Scenario {
  const scenario = getScenario(id);
  if (!scenario) throw new Error(`missing ${id}`);
  return scenario;
}

describe('findProfilePath', () => {
  it('starts at the source reservoir', () => {
    expect(profileSource(stage('stage2'))).toBe('R1');
    expect(findProfilePath(stage('stage2'), 'R1')).toEqual(['R1']);
  });

  it('follows the branches of a tree network', () => {
    const scenario = stage('stage2');
    expect(findProfilePath(scenario, 'N4')).toEqual(['R1', 'N1', 'N2', 'N4']);
    expect(findProfilePath(scenario, 'N6')).toEqual(['R1', 'N1', 'N2', 'N3', 'N6']);
    expect(findProfilePath(scenario, 'N5')).toEqual(['R1', 'N1', 'N5']);
  });

  it('takes the path with the fewest links in a looped network', () => {
    const scenario = stage('stage4');
    expect(findProfilePath(scenario, 'N6')).toEqual(['R1', 'N1', 'N2', 'N6']);
    expect(findProfilePath(scenario, 'N5')).toEqual(['R1', 'N1', 'N5']);
    expect(findProfilePath(scenario, 'N8')).toHaveLength(6);
  });

  it('goes against the drawn direction of a pipe when needed', () => {
    // T5 is drawn D → C; the path to D through C would use it backwards.
    const scenario: Scenario = {
      ...stage('stage3'),
      pipes: stage('stage3').pipes.filter((p) => p.id !== 'T4'),
    };
    expect(findProfilePath(scenario, 'D')).toEqual(['R1', 'A', 'B', 'C', 'D']);
  });

  it('crosses the pump', () => {
    expect(findProfilePath(stage('stage5'), 'N6')).toEqual(['R1', 'J1', 'N2', 'N3', 'N6']);
  });

  it('returns null for a node that is not connected', () => {
    expect(findProfilePath(stage('stage2'), 'nope')).toBeNull();
  });

  it('finds every node of every stage', () => {
    for (const id of ['stage1', 'stage2', 'stage3', 'stage4', 'stage5']) {
      const scenario = stage(id);
      for (const node of scenario.nodes) {
        const path = findProfilePath(scenario, node.id);
        expect(path?.[0]).toBe('R1');
        expect(path?.[path.length - 1]).toBe(node.id);
      }
    }
  });
});

describe('profilePathTo', () => {
  it('keeps the path of the scenario for its own end node', () => {
    const scenario = stage('stage4');
    expect(profilePathTo(scenario, 'N8')).toEqual(scenario.profilePath);
    expect(profilePathTo(scenario, 'N7')).toEqual(findProfilePath(scenario, 'N7'));
  });
});

describe('buildProfile', () => {
  it('accumulates pipe lengths and copies the solver heads', () => {
    const scenario = stage('stage2');
    const evaluation = evaluateStage(scenario, scenario.reference.diameters);
    const profile = buildProfile(scenario, evaluation, scenario.profilePath, MIN)!;

    expect(profile.points.map((p) => p.id)).toEqual(['R1', 'N1', 'N2', 'N4']);
    expect(profile.points.map((p) => p.distance)).toEqual([0, 250, 500, 720]);
    expect(profile.totalLength).toBe(720);
    expect(profile.segments.map((s) => s.id)).toEqual(['T1', 'T2', 'T4']);

    const [r1, n1, , n4] = profile.points;
    expect(r1).toMatchObject({ kind: 'reservoir', elevation: 146, head: 150, staticHead: 150 });
    expect(r1!.minHead).toBeNull();
    expect(n1!.head).toBe(evaluation.result.nodes.N1!.head);
    expect(n1!.elevation).toBe(128);
    expect(n1!.pressure).toBe(evaluation.result.nodes.N1!.pressure);
    expect(n1!.staticHead).toBeCloseTo(150, 9);
    expect(n1!.minHead).toBe(138);
    expect(n4!.belowMin).toBe(false);
    for (const segment of profile.segments) {
      expect(segment.kind).toBe('pipe');
      expect(segment.headChange).toBeLessThan(0);
    }
    expect(profile.segments[0]!.headChange).toBeCloseTo(-evaluation.result.pipes.T1!.headLoss, 6);
  });

  it('marks the nodes below the minimum pressure', () => {
    const scenario = stage('stage2');
    const evaluation = evaluateStage(scenario, initialDiameters(scenario));
    const profile = buildProfile(scenario, evaluation, scenario.profilePath, MIN)!;
    expect(profile.points.map((p) => p.belowMin)).toEqual([false, true, true, true]);
  });

  it('shows the pump of stage 5 as a jump of the hydraulic grade at the same distance', () => {
    const scenario = stage('stage5');
    const evaluation = evaluateStage(scenario, scenario.reference.diameters);
    const profile = buildProfile(scenario, evaluation, scenario.profilePath, MIN)!;

    expect(profile.points.map((p) => p.distance)).toEqual([0, 0, 300, 550, 750]);
    const [pumpSegment] = profile.segments;
    expect(pumpSegment).toMatchObject({ kind: 'pump', id: 'B1', from: 'R1', to: 'J1', length: 0 });
    expect(pumpSegment!.headChange).toBeCloseTo(evaluation.result.pumps.B1!.head, 6);
    expect(pumpSegment!.headChange).toBeGreaterThan(40);

    const [r1, j1] = profile.points;
    expect(r1!.head).toBe(100);
    expect(j1!.head).toBeCloseTo(100 + evaluation.result.pumps.B1!.head, 6);
    // With the pump stopped the grade downstream is the level plus the shutoff head.
    expect(j1!.staticHead).toBeCloseTo(150, 9);
    // J1 is the pump discharge, not a consumption node: no pressure limit there.
    expect(j1!.minHead).toBeNull();
    expect(profile.points[4]!.minHead).toBe(138);
  });

  it('works along a path that runs against a pipe direction', () => {
    const scenario = stage('stage3');
    const evaluation = evaluateStage(scenario, scenario.reference.diameters);
    const profile = buildProfile(scenario, evaluation, ['R1', 'A', 'B', 'C', 'D'], MIN)!;
    expect(profile.points.map((p) => p.distance)).toEqual([0, 250, 600, 1020, 1380]);
    // Water flows D → C, so going C → D the grade rises.
    expect(profile.segments[3]).toMatchObject({ id: 'T5', from: 'C', to: 'D' });
    expect(profile.segments[3]!.headChange).toBeGreaterThan(0);
  });

  it('returns null for a path that is not a chain of links', () => {
    const scenario = stage('stage2');
    const evaluation = evaluateStage(scenario, scenario.reference.diameters);
    expect(buildProfile(scenario, evaluation, ['R1', 'N4'], MIN)).toBeNull();
    expect(buildProfile(scenario, evaluation, [], MIN)).toBeNull();
  });
});
