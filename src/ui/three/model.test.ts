import { initialDiameters } from '../../game/buildNetwork';
import { evaluateStage } from '../../game/evaluate';
import { getScenario } from '../../scenarios';
import type { Scenario } from '../../scenarios/types';
import { DETAIL, pipeRadius, toWorld } from './geometry';
import { buildSceneModel } from './model';

function stage(id: string): Scenario {
  const scenario = getScenario(id);
  if (!scenario) throw new Error(`missing ${id}`);
  return scenario;
}

describe('buildSceneModel', () => {
  const scenario = stage('stage2');
  const reference = scenario.reference.diameters;

  it('has terrain, pipes, nodes and the reservoir but no HGL before a result exists', () => {
    const model = buildSceneModel(scenario, reference, null, 5);
    expect(model.hgl).toBeNull();
    expect(model.pipes.map((p) => p.id)).toEqual(scenario.pipes.map((p) => p.id));
    expect(model.nodes.map((n) => n.id)).toEqual(scenario.nodes.map((n) => n.id));
    expect(model.reservoirs).toHaveLength(1);
    expect(model.pumps).toHaveLength(0);
    for (const node of model.nodes) {
      expect(node.status).toBe('none');
      expect(node.pressure).toBeNull();
      expect(node.hgl).toBeNull();
    }
    expect(model.terrain.positions.length).toBeGreaterThan(0);
  });

  it('draws each pipe with the radius of the diameter chosen by the player', () => {
    const model = buildSceneModel(scenario, { ...reference, T6: 300 }, null, 5);
    const { extent } = model.layout;
    expect(model.pipes.find((p) => p.id === 'T1')).toMatchObject({
      dn: 100,
      radius: pipeRadius(100, extent),
    });
    expect(model.pipes.find((p) => p.id === 'T6')).toMatchObject({
      dn: 300,
      radius: pipeRadius(300, extent),
    });
    // Node spheres cover the ends of the thickest pipe.
    for (const node of model.nodes) expect(node.radius).toBeGreaterThan(pipeRadius(300, extent));
  });

  it('puts the HGL point of each node above its ground point by pressure × exaggeration', () => {
    const evaluation = evaluateStage(scenario, reference);
    for (const exaggeration of [1, 5, 10]) {
      const model = buildSceneModel(scenario, reference, evaluation, exaggeration);
      expect(model.hgl).not.toBeNull();
      expect(model.hgl!.positions).toHaveLength(model.terrain.positions.length);
      for (const node of model.nodes) {
        const source = scenario.nodes.find((n) => n.id === node.id)!;
        expect(node.ground).toEqual(
          toWorld(model.layout, source.x, source.y, source.elevation, exaggeration),
        );
        expect(node.pressure).toBe(evaluation.result.nodes[node.id]!.pressure);
        expect(node.hgl!.x).toBe(node.ground.x);
        expect(node.hgl!.z).toBe(node.ground.z);
        expect(node.hgl!.y - node.ground.y).toBeCloseTo(node.pressure! * exaggeration, 9);
        expect(node.status).toBe('ok');
      }
    }
  });

  it('places the water surface of the reservoir at its water level', () => {
    const model = buildSceneModel(scenario, reference, null, 5);
    const tank = model.reservoirs[0]!;
    // Water level 150 m over the lowest ground at 111 m, times 5.
    expect(tank.waterY).toBe(195);
    expect(tank.position.y).toBe(175);
    expect(tank.bottomY).toBeLessThan(tank.waterY);
    expect(tank.topY).toBeGreaterThan(tank.waterY);
  });

  it('keeps a collapsed HGL within a limited depth under the terrain', () => {
    const diameters = initialDiameters(scenario);
    const evaluation = evaluateStage(scenario, diameters);
    const model = buildSceneModel(scenario, diameters, evaluation, 5);
    const lowestHead = Math.min(...scenario.nodes.map((n) => evaluation.result.nodes[n.id]!.head));
    expect(lowestHead).toBeLessThan(model.layout.baseElevation - 50);
    // Relief of the scene: 150 − 111 = 39 m, so the floor is 19.5 m under the lowest ground.
    const floorY = -19.5 * 5;
    for (const node of model.nodes) expect(node.hgl!.y).toBeGreaterThanOrEqual(floorY);
    for (let i = 1; i < model.hgl!.positions.length; i += 3) {
      expect(model.hgl!.positions[i]).toBeGreaterThanOrEqual(floorY);
    }
    expect(model.nodes.some((n) => n.status === 'low')).toBe(true);
  });

  it('ignores a result that does not belong to the scenario', () => {
    const other = stage('stage3');
    const evaluation = evaluateStage(other, other.reference.diameters);
    expect(buildSceneModel(scenario, reference, evaluation, 5).hgl).toBeNull();
  });

  it('adds the pump of stage 5 between its suction and discharge nodes', () => {
    const pumped = stage('stage5');
    const model = buildSceneModel(pumped, pumped.reference.diameters, null, 5);
    expect(model.pumps).toHaveLength(1);
    const pump = model.pumps[0]!;
    expect(pump.id).toBe('B1');
    const from = model.reservoirs[0]!.position;
    const to = model.nodes.find((n) => n.id === 'J1')!.ground;
    expect(pump.marker.position.x).toBeCloseTo((from.x + to.x) / 2, 9);
    expect(pump.marker.position.z).toBeCloseTo((from.z + to.z) / 2, 9);
    expect(pump.marker.length).toBeGreaterThan(0);
  });

  it('frames a box that contains the terrain and the highest water level', () => {
    const model = buildSceneModel(scenario, reference, null, 5);
    const { center, halfSize } = model.bounds;
    expect(halfSize.x).toBeCloseTo((model.layout.maxX - model.layout.minX) / 2, 9);
    expect(halfSize.z).toBeCloseTo((model.layout.maxY - model.layout.minY) / 2, 9);
    expect(center.y + halfSize.y).toBeGreaterThanOrEqual(model.reservoirs[0]!.topY);
    expect(center.y - halfSize.y).toBeCloseTo(0, 9);
  });
});

describe.each(['stage1', 'stage2', 'stage3', 'stage4', 'stage5'])(
  'buildSceneModel in low quality: %s',
  (id) => {
    const scenario = stage(id);
    const diameters = scenario.reference.diameters;
    const evaluation = evaluateStage(scenario, diameters);
    const high = buildSceneModel(scenario, diameters, evaluation, 5);
    const low = buildSceneModel(scenario, diameters, evaluation, 5, 'low');

    it('uses the high budget by default and carries the budget it was built with', () => {
      expect(high.detail).toBe(DETAIL.high);
      expect(low.detail).toBe(DETAIL.low);
    });

    it('has fewer vertices, triangles and path points', () => {
      expect(low.terrain.positions.length).toBeLessThan(high.terrain.positions.length);
      expect(low.terrain.indices.length).toBeLessThan(high.terrain.indices.length);
      expect(low.terrain.lineIndices.length).toBeLessThan(high.terrain.lineIndices.length);
      expect(low.hgl!.positions.length).toBeLessThan(high.hgl!.positions.length);
      for (const pipe of low.pipes) expect(pipe.path).toHaveLength(DETAIL.low.pathSegments + 1);
      for (const pipe of high.pipes) expect(pipe.path).toHaveLength(DETAIL.high.pathSegments + 1);
    });

    it('is still a valid mesh: finite positions and indices inside the grid', () => {
      for (const surface of [low.terrain, low.hgl!]) {
        const vertices = surface.positions.length / 3;
        expect(Number.isInteger(vertices)).toBe(true);
        expect(surface.positions.every((v) => Number.isFinite(v))).toBe(true);
        expect(surface.indices.length % 3).toBe(0);
        expect(surface.indices.length).toBeGreaterThan(0);
        expect(Math.max(...surface.indices)).toBeLessThan(vertices);
        expect(Math.max(...surface.lineIndices)).toBeLessThan(vertices);
      }
      expect(low.hgl!.positions).toHaveLength(low.terrain.positions.length);
      for (const pipe of low.pipes) {
        for (const p of pipe.path) expect([p.x, p.y, p.z].every(Number.isFinite)).toBe(true);
      }
    });

    it('puts nodes, reservoirs, pipe ends and the frame in the same places', () => {
      expect(low.nodes).toEqual(high.nodes);
      expect(low.reservoirs).toEqual(high.reservoirs);
      expect(low.bounds).toEqual(high.bounds);
      expect(low.pipes.map((p) => [p.id, p.dn, p.radius, p.status])).toEqual(
        high.pipes.map((p) => [p.id, p.dn, p.radius, p.status]),
      );
      low.pipes.forEach((pipe, i) => {
        expect(pipe.path[0]).toEqual(high.pipes[i]!.path[0]);
        expect(pipe.path.at(-1)).toEqual(high.pipes[i]!.path.at(-1));
      });
    });

    it('keeps the pump marker at the middle of its link', () => {
      expect(low.pumps).toHaveLength(high.pumps.length);
      low.pumps.forEach((pump, i) => {
        const other = high.pumps[i]!;
        expect(pump.marker.length).toBeGreaterThan(0);
        expect(pump.marker.position.x).toBeCloseTo(other.marker.position.x, 6);
        expect(pump.marker.position.z).toBeCloseTo(other.marker.position.z, 6);
        expect(pump.path).toHaveLength(DETAIL.low.pathSegments + 1);
      });
    });
  },
);
