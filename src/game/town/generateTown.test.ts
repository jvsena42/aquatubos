import { SCENARIOS, getScenario } from '../../scenarios';
import type { Scenario } from '../../scenarios/types';
import { makeScenario } from '../../test/fixtures';
import { houseCount } from '../houses';
import { generateTown, LANE_WIDTH, STREET_WIDTH } from './generateTown';
import {
  boxCorners,
  distance,
  pointPolygonDistance,
  pointSegmentDistance,
  polygonDistance,
  segmentPolygonDistance,
  type Box,
  type Point,
} from './geometry';
import { createRng } from './random';
import type { Town } from './types';

/** A random network: nodes scattered on the plan, a spanning tree, a few loops, maybe a pump. */
function randomScenario(seed: string): Scenario {
  const rng = createRng(seed);
  const count = 3 + rng.int(7);
  const points: Point[] = [];
  while (points.length < count + 1) {
    const p = { x: Math.round(rng.range(0, 1000)), y: Math.round(rng.range(0, 600)) };
    if (points.every((q) => distance(p, q) >= 70)) points.push(p);
  }
  const withPump = rng.next() < 0.4;
  const nodes = points.slice(1).map((p, index) => ({
    id: `N${index + 1}`,
    ...p,
    elevation: Math.round(rng.range(90, 130)),
    // The node after a pump has no demand, like in stage 5; some others have none either.
    demandLps: (withPump && index === 0) || rng.next() < 0.15 ? 0 : rng.range(0.2, 5),
  }));
  const reservoir = { id: 'R1', ...points[0]!, elevation: 100, waterLevel: rng.range(100, 130) };
  const pipes: Scenario['pipes'] = [];
  const link = (from: string, to: string) =>
    pipes.push({ id: `T${pipes.length + 1}`, from, to, length: 100, initialDN: 50 });
  if (!withPump) link('R1', 'N1');
  for (let i = 1; i < nodes.length; i++) link(nodes[rng.int(i)]!.id, nodes[i]!.id);
  for (let extra = rng.int(3); extra > 0; extra--) {
    const a = rng.int(nodes.length);
    const b = rng.int(nodes.length);
    if (a !== b) link(nodes[a]!.id, nodes[b]!.id);
  }
  const point = { flowLps: 5, head: 30 };
  return makeScenario(1, {
    id: `random-${seed}`,
    nodes,
    reservoirs: [reservoir],
    pipes,
    pumps: withPump ? [{ id: 'B1', from: 'R1', to: 'N1', points: [point, point, point] }] : [],
  });
}

const RANDOM = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((seed) => randomScenario(seed));
const ALL: Scenario[] = [...SCENARIOS, ...RANDOM];
const town = (scenario: Scenario): Town => generateTown(scenario);

/** Footprints that must stay clear of everything: node houses and scenery buildings. */
function footprints(t: Town): { label: string; box: Box; corners: Point[] }[] {
  return [
    ...t.clusters.flatMap((cluster) =>
      cluster.houses.map((house, index) => ({ label: `${cluster.nodeId}#${index}`, box: house })),
    ),
    ...t.buildings.map((building, index) => ({
      label: `${building.kind}#${index}`,
      box: building,
    })),
  ].map((item) => ({ ...item, corners: boxCorners(item.box) }));
}

describe('generateTown', () => {
  it('is deterministic for a scenario', () => {
    for (const scenario of ALL) {
      expect(generateTown(scenario)).toEqual(generateTown(scenario));
      // A copy of the scenario, not the same object.
      expect(generateTown(structuredClone(scenario))).toEqual(generateTown(scenario));
    }
  });

  it('changes the scenery with the seed and keeps the network', () => {
    const stage = getScenario('stage3')!;
    const a = generateTown(stage);
    const b = generateTown({ ...stage, town: { ...stage.town, seed: 'another seed' } });
    expect(b.seed).toBe('another seed');
    expect(a.seed).toBe('stage3');
    expect(b.trees).not.toEqual(a.trees);
    expect(b.buildings).not.toEqual(a.buildings);
    expect(b.streets).toEqual(a.streets);
    expect(b.plazas).toEqual(a.plazas);
    expect(b.clusters.map((c) => c.houses.length)).toEqual(a.clusters.map((c) => c.houses.length));
    // The seed of the stage id is the default.
    expect(generateTown({ ...stage, town: { ...stage.town, seed: 'stage3' } })).toEqual(a);
  });

  it('lays one street per pipe and a narrower lane per pump', () => {
    for (const scenario of ALL) {
      const t = town(scenario);
      expect(t.streets.map((s) => s.id)).toEqual([
        ...scenario.pipes.map((p) => p.id),
        ...scenario.pumps.map((p) => p.id),
      ]);
      for (const street of t.streets) {
        const link = [...scenario.pipes, ...scenario.pumps].find((l) => l.id === street.id)!;
        const from = [...scenario.nodes, ...scenario.reservoirs].find((n) => n.id === link.from)!;
        const to = [...scenario.nodes, ...scenario.reservoirs].find((n) => n.id === link.to)!;
        expect(street.a).toEqual({ x: from.x, y: from.y });
        expect(street.b).toEqual({ x: to.x, y: to.y });
        expect(street.width).toBe(street.kind === 'pipe' ? STREET_WIDTH : LANE_WIDTH);
      }
      expect(t.plazas.map((p) => p.nodeId)).toEqual(scenario.nodes.map((n) => n.id));
      expect(t.pumps.map((p) => p.id)).toEqual(scenario.pumps.map((p) => p.id));
    }
    const pumped = town(getScenario('stage5')!);
    // The pump house sits in the middle of the link R1 (0, 300) - J1 (220, 300).
    expect(pumped.pumps[0]).toMatchObject({ id: 'B1', x: 110, y: 300, rotation: 0 });
  });

  it('gives every demand node exactly its houses, tagged with the node', () => {
    for (const scenario of ALL) {
      const t = town(scenario);
      const expected = scenario.nodes.filter((node) => houseCount(node) > 0);
      expect(t.clusters.map((c) => c.nodeId)).toEqual(expected.map((n) => n.id));
      for (const node of expected) {
        const cluster = t.clusters.find((c) => c.nodeId === node.id)!;
        expect(cluster.houses).toHaveLength(houseCount(node));
        expect(cluster.houses.every((house) => house.nodeId === node.id)).toBe(true);
        expect(cluster.hull.length).toBeGreaterThanOrEqual(3);
      }
    }
    // Stage 5: the pump discharge node J1 has no demand and no houses.
    expect(town(getScenario('stage5')!).clusters.some((c) => c.nodeId === 'J1')).toBe(false);
  });

  it('keeps the houses of the stages next to their own node', () => {
    for (const scenario of SCENARIOS) {
      const points = [...scenario.nodes, ...scenario.reservoirs];
      for (const cluster of town(scenario).clusters) {
        for (const house of cluster.houses) {
          const own = distance(house, cluster);
          expect(own, `${scenario.id} ${cluster.nodeId}`).toBeLessThan(160);
          for (const other of points) {
            if (other.id !== cluster.nodeId) expect(distance(house, other)).toBeGreaterThan(own);
          }
        }
      }
    }
  });

  it('keeps the houses of random networks within a bounded distance of their node', () => {
    for (const scenario of RANDOM) {
      for (const cluster of town(scenario).clusters) {
        for (const house of cluster.houses) {
          expect(distance(house, cluster), `${scenario.id} ${cluster.nodeId}`).toBeLessThan(420);
        }
      }
    }
  });

  it('widens the search around a crowded node instead of dropping houses', () => {
    // Three nodes 40 m apart with the largest demand: their lots overlap almost completely.
    const scenario = makeScenario(1, {
      id: 'crowded',
      nodes: [0, 1, 2].map((i) => ({
        id: `N${i + 1}`,
        x: 100 + 40 * i,
        y: 0,
        elevation: 10,
        demandLps: 4,
      })),
      pipes: [
        { id: 'T1', from: 'R1', to: 'N1', length: 100, initialDN: 50 },
        { id: 'T2', from: 'N1', to: 'N2', length: 40, initialDN: 50 },
        { id: 'T3', from: 'N2', to: 'N3', length: 40, initialDN: 50 },
      ],
    });
    const t = town(scenario);
    expect(t.clusters.map((c) => c.houses.length)).toEqual([12, 12, 12]);
    expectNoOverlap(scenario, t);
  });

  function expectNoOverlap(scenario: Scenario, t: Town) {
    const items = footprints(t);
    const where = (label: string) => `${scenario.id}: ${label}`;
    for (const item of items) {
      for (const street of t.streets) {
        // The street covers its centre line (the pipe) plus half its width on each side.
        expect(
          segmentPolygonDistance(street.a, street.b, item.corners),
          where(`${item.label} on street ${street.id}`),
        ).toBeGreaterThan(street.width / 2);
      }
      for (const plaza of t.plazas) {
        expect(
          pointPolygonDistance(plaza, item.corners),
          where(`${item.label} on plaza ${plaza.nodeId}`),
        ).toBeGreaterThan(plaza.radius);
      }
      for (const site of t.reservoirs) {
        expect(
          pointPolygonDistance(site, item.corners),
          where(`${item.label} on reservoir ${site.id}`),
        ).toBeGreaterThan(site.radius);
      }
      for (const pump of t.pumps) {
        expect(
          polygonDistance(boxCorners(pump), item.corners),
          where(`${item.label} on pump ${pump.id}`),
        ).toBeGreaterThan(0);
      }
      if (t.park) {
        expect(
          pointPolygonDistance(t.park, item.corners),
          where(`${item.label} in the park`),
        ).toBeGreaterThan(t.park.radius);
      }
    }
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        expect(
          polygonDistance(items[i]!.corners, items[j]!.corners),
          where(`${items[i]!.label} on ${items[j]!.label}`),
        ).toBeGreaterThan(0);
      }
    }
    t.trees.forEach((tree, index) => {
      const label = where(`tree ${index}`);
      for (const street of t.streets) {
        expect(pointSegmentDistance(tree, street.a, street.b), label).toBeGreaterThan(
          street.width / 2 + tree.radius,
        );
      }
      for (const plaza of t.plazas) {
        expect(distance(tree, plaza), label).toBeGreaterThan(plaza.radius + tree.radius);
      }
      for (const site of t.reservoirs) {
        expect(distance(tree, site), label).toBeGreaterThan(site.radius + tree.radius);
      }
      for (const pump of t.pumps) {
        expect(pointPolygonDistance(tree, boxCorners(pump)), label).toBeGreaterThan(tree.radius);
      }
      for (const item of items) {
        expect(
          pointPolygonDistance(tree, item.corners),
          `${label} on ${item.label}`,
        ).toBeGreaterThan(tree.radius);
      }
    });
  }

  it.each(ALL.map((scenario) => [scenario.id, scenario] as const))(
    'keeps houses, buildings and trees of %s off streets, plazas, sites, the park and each other',
    (_id, scenario) => {
      expectNoOverlap(scenario, town(scenario));
    },
  );

  it('puts the park in free ground and plants trees in it', () => {
    for (const scenario of SCENARIOS) {
      const t = town(scenario);
      expect(t.park, scenario.id).not.toBeNull();
      const park = t.park!;
      expect(park.radius).toBeGreaterThanOrEqual(30);
      for (const street of t.streets) {
        expect(pointSegmentDistance(park, street.a, street.b)).toBeGreaterThan(
          park.radius + street.width / 2,
        );
      }
      const inPark = t.trees.filter((tree) => tree.inPark);
      expect(inPark.length).toBeGreaterThan(0);
      for (const tree of inPark) {
        expect(distance(tree, park) + tree.radius).toBeLessThan(park.radius);
      }
    }
  });

  it('honours the park, landmark and extra house overrides', () => {
    const stage = getScenario('stage1')!;
    const overrides = {
      park: { x: 150, y: 420, radius: 60 },
      landmarks: [
        { type: 'school' as const, x: 420, y: 80 },
        { type: 'church' as const, x: 700, y: 60 },
        { type: 'market' as const, x: 150, y: 80 },
        { type: 'square' as const, x: 760, y: 400 },
      ],
      extraHouses: [
        { x: 900, y: 420 },
        { x: -60, y: 20 },
      ],
    };
    const scenario = { ...stage, town: overrides };
    const t = town(scenario);
    expect(t.park).toEqual({ x: 150, y: 420, radius: 60 });
    for (const landmark of overrides.landmarks) {
      expect(t.buildings).toContainEqual(
        expect.objectContaining({ kind: landmark.type, x: landmark.x, y: landmark.y }),
      );
    }
    for (const extra of overrides.extraHouses) {
      expect(t.buildings).toContainEqual(expect.objectContaining({ kind: 'house', ...extra }));
    }
    expect(t.clusters.map((c) => c.houses.length)).toEqual(
      stage.nodes.map((node) => houseCount(node)),
    );
    // Generated houses, buildings and trees keep clear of the fixed items.
    expectNoOverlap(scenario, t);
    // The landmarks written in the stage files are in their towns.
    expect(town(stage).buildings).toContainEqual(
      expect.objectContaining({ kind: 'church', x: 150, y: 105 }),
    );
    expect(town(getScenario('stage4')!).buildings.map((b) => b.kind)).toEqual(
      expect.arrayContaining(['school', 'square', 'market']),
    );
    // A park without a radius gets the default one.
    expect(town({ ...stage, town: { park: { x: 150, y: 420 } } }).park?.radius).toBe(70);
  });

  it('leaves out the filler scenery when asked', () => {
    const stage = getScenario('stage4')!;
    const bare = town({ ...stage, town: { scenery: false } });
    const full = town({ ...stage, town: {} });
    expect(bare.buildings).toEqual([]);
    expect(bare.trees).toEqual([]);
    expect(bare.park).toBeNull();
    expect(bare.clusters).toEqual(full.clusters);
    expect(bare.streets).toEqual(full.streets);
    // Fixed items still appear without the filler.
    const fixed = town({
      ...stage,
      town: { scenery: false, landmarks: [{ type: 'school', x: 400, y: 620 }] },
    });
    expect(fixed.buildings.map((b) => b.kind)).toEqual(['school']);
  });

  it('draws an elevated tank or a ground reservoir by water depth, unless the file says', () => {
    const kinds = Object.fromEntries(
      SCENARIOS.map((scenario) => [scenario.id, town(scenario).reservoirs[0]!.kind]),
    );
    // Water level above ground: 25, 4, 22, 23 and 0 m.
    expect(kinds).toEqual({
      stage1: 'elevated',
      stage2: 'ground',
      stage3: 'elevated',
      stage4: 'elevated',
      stage5: 'ground',
    });
    const stage = getScenario('stage1')!;
    const forced = town({
      ...stage,
      reservoirs: stage.reservoirs.map((r) => ({ ...r, kind: 'ground' as const })),
    });
    expect(forced.reservoirs[0]!.kind).toBe('ground');
  });

  it('shades hills only where the ground is uneven', () => {
    const spans = Object.fromEntries(
      SCENARIOS.map((scenario) => [scenario.id, town(scenario).terrain?.bands.length ?? 0]),
    );
    // Stage 1 is flat (every node at 100 m).
    expect(spans.stage1).toBe(0);
    for (const id of ['stage2', 'stage3', 'stage4', 'stage5']) {
      expect(spans[id], id).toBeGreaterThanOrEqual(3);
    }
    // Stages 2 and 5 have the largest relief.
    expect(spans.stage2).toBeGreaterThan(spans.stage3!);
    expect(spans.stage5).toBeGreaterThan(spans.stage3!);
  });

  it('bounds everything and fits the network in the focus box', () => {
    for (const scenario of ALL) {
      const t = town(scenario);
      const inside = (p: Point, margin = 0) =>
        p.x - margin >= t.bounds.minX &&
        p.x + margin <= t.bounds.maxX &&
        p.y - margin >= t.bounds.minY &&
        p.y + margin <= t.bounds.maxY;
      for (const item of footprints(t)) expect(item.corners.every((p) => inside(p))).toBe(true);
      for (const tree of t.trees) expect(inside(tree, tree.radius)).toBe(true);
      if (t.park) expect(inside(t.park, t.park.radius)).toBe(true);
      for (const cluster of t.clusters) {
        for (const p of cluster.hull) {
          expect(p.x).toBeGreaterThanOrEqual(t.focus.minX);
          expect(p.x).toBeLessThanOrEqual(t.focus.maxX);
          expect(p.y).toBeGreaterThanOrEqual(t.focus.minY);
          expect(p.y).toBeLessThanOrEqual(t.focus.maxY);
        }
      }
      for (const site of t.reservoirs) {
        expect(site.x - site.radius).toBeGreaterThanOrEqual(t.focus.minX);
        expect(site.x + site.radius).toBeLessThanOrEqual(t.focus.maxX);
      }
      expect(t.focus.minX).toBeGreaterThanOrEqual(t.bounds.minX);
      expect(t.focus.maxX).toBeLessThanOrEqual(t.bounds.maxX);
    }
  });

  it('stays within the drawing budget', () => {
    for (const scenario of ALL) {
      const t = town(scenario);
      expect(t.buildings.length + t.trees.length, scenario.id).toBeLessThanOrEqual(250);
      expect(t.trees.length).toBeGreaterThan(20);
      expect(t.buildings.length).toBeGreaterThan(5);
    }
  });

  it('returns plain data', () => {
    const t = town(getScenario('stage2')!);
    expect(JSON.parse(JSON.stringify(t))).toEqual(t);
  });

  it('generates a town for a network without nodes', () => {
    const t = town(makeScenario(1, { nodes: [], pipes: [], reservoirs: [] }));
    expect(t.streets).toEqual([]);
    expect(t.clusters).toEqual([]);
  });
});
