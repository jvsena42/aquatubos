import { initialDiameters } from '../../game/buildNetwork';
import { evaluateStage } from '../../game/evaluate';
import { getScenario } from '../../scenarios';
import type { Scenario } from '../../scenarios/types';
import { pipeRadius, toWorld } from './geometry';
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
