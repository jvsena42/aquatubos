import { initialDiameters } from '../../game/buildNetwork';
import { evaluateStage } from '../../game/evaluate';
import { SCENARIOS, getScenario } from '../../scenarios';
import type { Scenario } from '../../scenarios/types';
import {
  DEFAULT_EXAGGERATION,
  EXAGGERATIONS,
  findPoint,
  fitDistance,
  gridAxis,
  gridIndices,
  gridLineIndices,
  gridPositions,
  groundPoints,
  headPoints,
  idw,
  interpolateGrid,
  pipePath,
  pipeRadius,
  sceneLayout,
  segmentTransform,
  toWorld,
  type Vec3,
} from './geometry';
import { criticalNode, pressureStatus, velocityStatus } from './status';

function stage(id: string): Scenario {
  const scenario = getScenario(id);
  if (!scenario) throw new Error(`missing ${id}`);
  return scenario;
}

/** Applies a quaternion to the +Y unit vector. */
function rotateUp([x, y, z, w]: [number, number, number, number]): Vec3 {
  return { x: 2 * (x * y - w * z), y: 1 - 2 * (x * x + z * z), z: 2 * (y * z + w * x) };
}

describe('sceneLayout and toWorld', () => {
  it('has the five real stages to work with', () => {
    expect(SCENARIOS).toHaveLength(5);
  });

  it.each(SCENARIOS.map((s) => [s.id, s] as const))(
    '%s: every node and reservoir lies inside the plan box, with margin',
    (_id, scenario) => {
      const layout = sceneLayout(scenario);
      for (const p of [...scenario.nodes, ...scenario.reservoirs]) {
        expect(p.x).toBeGreaterThan(layout.minX);
        expect(p.x).toBeLessThan(layout.maxX);
        expect(p.y).toBeGreaterThan(layout.minY);
        expect(p.y).toBeLessThan(layout.maxY);
        expect(p.elevation).toBeGreaterThanOrEqual(layout.baseElevation);
        expect(layout.topElevation).toBeGreaterThanOrEqual(p.elevation);
      }
      expect(layout.extent).toBe(Math.max(layout.maxX - layout.minX, layout.maxY - layout.minY));
    },
  );

  it('maps stage 2 plan coordinates to centred world coordinates', () => {
    const scenario = stage('stage2');
    const layout = sceneLayout(scenario);
    // x from 0 to 760, y from 80 to 520, lowest ground 111 m (N3), water level 150 m.
    expect(layout.centerX).toBeCloseTo(380, 9);
    expect(layout.centerY).toBeCloseTo(300, 9);
    expect(layout.baseElevation).toBe(111);
    expect(layout.topElevation).toBe(150);

    expect(toWorld(layout, 380, 300, 111, 1)).toEqual({ x: 0, y: 0, z: 0 });
    // N4 (500, 80, 132 m): plan y becomes world z, elevation becomes world y.
    expect(toWorld(layout, 500, 80, 132, 1)).toEqual({ x: 120, y: 21, z: -220 });
  });

  it('includes the pump shutoff head in the top of the stage 5 scene', () => {
    const scenario = stage('stage5');
    expect(sceneLayout(scenario).topElevation).toBe(150);
  });

  it('scales only the height with the vertical exaggeration', () => {
    const layout = sceneLayout(stage('stage2'));
    const flat = toWorld(layout, 500, 80, 132, 1);
    for (const k of EXAGGERATIONS) {
      const world = toWorld(layout, 500, 80, 132, k);
      expect(world.x).toBe(flat.x);
      expect(world.z).toBe(flat.z);
      expect(world.y).toBe(flat.y * k);
    }
    expect(EXAGGERATIONS).toContain(DEFAULT_EXAGGERATION);
  });
});

describe('idw', () => {
  const points = [
    { x: 0, y: 0, value: 10 },
    { x: 100, y: 0, value: 30 },
  ];

  it('returns the exact value at a known point', () => {
    expect(idw(points, 0, 0)).toBe(10);
    expect(idw(points, 100, 0)).toBe(30);
  });

  it('returns the mean halfway between two points and leans to the nearer one', () => {
    expect(idw(points, 50, 0)).toBeCloseTo(20, 12);
    expect(idw(points, 50, 400)).toBeCloseTo(20, 12);
    // Weights 1/25² and 1/75²: (9·10 + 1·30) / 10 = 12.
    expect(idw(points, 25, 0)).toBeCloseTo(12, 12);
  });

  it('returns a single value everywhere and 0 without points', () => {
    expect(idw([{ x: 5, y: 5, value: 7 }], 300, -40)).toBeCloseTo(7, 12);
    expect(idw([], 1, 2)).toBe(0);
  });
});

describe('gridAxis', () => {
  it('contains the ends and the required coordinates, in increasing order', () => {
    const axis = gridAxis(0, 100, 10, [33, 70, 70, 250]);
    expect(axis[0]).toBe(0);
    expect(axis.at(-1)).toBe(100);
    expect(axis).toContain(33);
    expect(axis.filter((v) => v === 70)).toHaveLength(1);
    expect(axis).not.toContain(250);
    for (let i = 1; i < axis.length; i++) expect(axis[i]).toBeGreaterThan(axis[i - 1]!);
  });

  it('drops even samples that would leave a sliver next to a required coordinate', () => {
    const axis = gridAxis(0, 100, 10, [31]);
    expect(axis).not.toContain(30);
    expect(axis).toContain(31);
  });
});

describe.each(SCENARIOS.map((s) => [s.id, s] as const))(
  'terrain and HGL of %s',
  (_id, scenario) => {
    const layout = sceneLayout(scenario);
    const ground = groundPoints(scenario);
    const terrain = interpolateGrid(layout, ground);
    const evaluation = evaluateStage(scenario, scenario.reference.diameters);
    const heads = headPoints(scenario, evaluation.result);

    it('interpolates the exact ground elevation at every node and reservoir', () => {
      for (const p of [...scenario.nodes, ...scenario.reservoirs]) {
        expect(idw(ground, p.x, p.y)).toBe(p.elevation);
      }
    });

    it('has a grid vertex with the exact elevation at every node and reservoir', () => {
      for (const p of [...scenario.nodes, ...scenario.reservoirs]) {
        const ix = terrain.xs.indexOf(p.x);
        const iy = terrain.ys.indexOf(p.y);
        expect(ix).toBeGreaterThanOrEqual(0);
        expect(iy).toBeGreaterThanOrEqual(0);
        expect(terrain.values[iy * terrain.xs.length + ix]).toBe(p.elevation);
      }
    });

    it('gives finite terrain values within the range of the data over the whole grid', () => {
      const min = Math.min(...ground.map((p) => p.value));
      const max = Math.max(...ground.map((p) => p.value));
      expect(terrain.values).toHaveLength(terrain.xs.length * terrain.ys.length);
      for (const value of terrain.values) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(min - 1e-9);
        expect(value).toBeLessThanOrEqual(max + 1e-9);
      }
      expect(terrain.xs[0]).toBe(layout.minX);
      expect(terrain.xs.at(-1)).toBe(layout.maxX);
      expect(terrain.ys[0]).toBe(layout.minY);
      expect(terrain.ys.at(-1)).toBe(layout.maxY);
    });

    it('interpolates the exact head at every node and the water level at the reservoir', () => {
      expect(heads).not.toBeNull();
      for (const node of scenario.nodes) {
        expect(idw(heads!, node.x, node.y)).toBe(evaluation.result.nodes[node.id]!.head);
      }
      for (const reservoir of scenario.reservoirs) {
        expect(idw(heads!, reservoir.x, reservoir.y)).toBe(reservoir.waterLevel);
      }
    });

    it('keeps the HGL of the reference design above the terrain over the whole grid', () => {
      const hgl = interpolateGrid(layout, heads!);
      expect(hgl.xs).toEqual(terrain.xs);
      expect(hgl.ys).toEqual(terrain.ys);
      hgl.values.forEach((head, i) => {
        expect(Number.isFinite(head)).toBe(true);
        expect(head).toBeGreaterThanOrEqual(terrain.values[i]! - 1e-9);
      });
    });

    it('builds world positions and triangle indices that match the grid', () => {
      const nx = terrain.xs.length;
      const ny = terrain.ys.length;
      const positions = gridPositions(layout, terrain, 5);
      expect(positions).toHaveLength(nx * ny * 3);
      expect(positions.every((v) => Number.isFinite(v))).toBe(true);

      const node = scenario.nodes[0]!;
      const vertex = terrain.ys.indexOf(node.y) * nx + terrain.xs.indexOf(node.x);
      const world = toWorld(layout, node.x, node.y, node.elevation, 5);
      expect(positions[vertex * 3]).toBeCloseTo(world.x, 3);
      expect(positions[vertex * 3 + 1]).toBeCloseTo(world.y, 3);
      expect(positions[vertex * 3 + 2]).toBeCloseTo(world.z, 3);

      const indices = gridIndices(nx, ny);
      expect(indices).toHaveLength((nx - 1) * (ny - 1) * 6);
      expect(Math.max(...indices)).toBe(nx * ny - 1);
      const lines = gridLineIndices(nx, ny, 2);
      expect(lines.length % 2).toBe(0);
      expect(Math.max(...lines)).toBe(nx * ny - 1);
    });

    it('draws every pipe from node to node along the terrain', () => {
      const lift = 3;
      for (const pipe of scenario.pipes) {
        const path = pipePath(scenario, layout, pipe, 5, lift, 8);
        expect(path).toHaveLength(9);
        const from = findPoint(scenario, pipe.from)!;
        const to = findPoint(scenario, pipe.to)!;
        const start = toWorld(layout, from.x, from.y, from.value, 5);
        const end = toWorld(layout, to.x, to.y, to.value, 5);
        expect(path![0]).toEqual({ ...start, y: start.y + lift });
        expect(path![8]).toEqual({ ...end, y: end.y + lift });
        for (const point of path!) {
          const elevation = idw(ground, point.x + layout.centerX, point.z + layout.centerY);
          expect(point.y).toBeCloseTo((elevation - layout.baseElevation) * 5 + lift, 6);
        }
      }
    });
  },
);

describe('gridPositions', () => {
  it('raises values under the floor elevation to the floor', () => {
    const layout = sceneLayout(stage('stage2'));
    const grid = { xs: [0, 10], ys: [0, 10], values: [50, 111, 120, -400] };
    const positions = gridPositions(layout, grid, 5, 105);
    expect([positions[1], positions[4], positions[7], positions[10]]).toEqual([-30, 0, 45, -30]);
  });
});

describe('headPoints', () => {
  it('is null when the result does not cover the scenario', () => {
    const scenario = stage('stage2');
    const other = evaluateStage(stage('stage3'), stage('stage3').reference.diameters);
    expect(headPoints(scenario, other.result)).toBeNull();
  });
});

describe('pipeRadius', () => {
  it('grows with DN and makes DN 300 five times as thick as DN 50', () => {
    const catalog = [50, 75, 100, 150, 200, 250, 300];
    const radii = catalog.map((dn) => pipeRadius(dn, 1000));
    for (let i = 1; i < radii.length; i++) expect(radii[i]).toBeGreaterThan(radii[i - 1]!);
    expect(radii[2]! / radii[0]!).toBeGreaterThan(1.8);
    expect(radii.at(-1)! / radii[0]!).toBeCloseTo(5, 1);
    expect(pipeRadius(50, 2000)).toBeCloseTo(2 * pipeRadius(50, 1000), 12);
  });
});

describe('pipePath', () => {
  it('is null when an end of the link is unknown', () => {
    const scenario = stage('stage1');
    expect(pipePath(scenario, sceneLayout(scenario), { from: 'R1', to: 'nope' }, 5)).toBeNull();
  });
});

describe('segmentTransform', () => {
  const cases: [string, Vec3, Vec3][] = [
    ['up', { x: 0, y: 0, z: 0 }, { x: 0, y: 4, z: 0 }],
    ['down', { x: 1, y: 5, z: 2 }, { x: 1, y: -3, z: 2 }],
    ['along x', { x: -2, y: 1, z: 0 }, { x: 6, y: 1, z: 0 }],
    ['along z', { x: 0, y: 0, z: 3 }, { x: 0, y: 0, z: -9 }],
    ['oblique', { x: 10, y: 20, z: 30 }, { x: 250, y: -45, z: 110 }],
  ];

  it.each(cases)('aligns a cylinder with a segment pointing %s', (_name, a, b) => {
    const { position, length, quaternion } = segmentTransform(a, b);
    expect(length).toBeCloseTo(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z), 9);
    expect(position).toEqual({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
    expect(Math.hypot(...quaternion)).toBeCloseTo(1, 12);
    const axis = rotateUp(quaternion);
    expect(axis.x * length).toBeCloseTo(b.x - a.x, 9);
    expect(axis.y * length).toBeCloseTo(b.y - a.y, 9);
    expect(axis.z * length).toBeCloseTo(b.z - a.z, 9);
  });

  it('returns the identity rotation for a zero-length segment', () => {
    const p = { x: 1, y: 2, z: 3 };
    expect(segmentTransform(p, p)).toEqual({ position: p, length: 0, quaternion: [0, 0, 0, 1] });
  });
});

describe('fitDistance', () => {
  const fov = (35 * Math.PI) / 180;
  const directions: [string, Vec3][] = [
    ['the south', { x: 0, y: 0, z: 1 }],
    ['above', { x: 0, y: 1, z: 0 }],
    ['an oblique angle', { x: 0.35, y: 0.5, z: 1 }],
    ['the north-west', { x: -0.8, y: 0.2, z: -0.6 }],
  ];

  it.each(directions)('frames a box seen from %s without cutting any corner', (_name, raw) => {
    const length = Math.hypot(raw.x, raw.y, raw.z);
    const direction = { x: raw.x / length, y: raw.y / length, z: raw.z / length };
    const half = { x: 470, y: 100, z: 330 };
    for (const aspect of [0.45, 1, 2.2]) {
      const distance = fitDistance(half, direction, fov, aspect);
      expect(distance).toBeGreaterThan(0);
      // Largest angle between the view axis and a corner, as a fraction of the half field of view.
      let widest = 0;
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const c = { x: sx * half.x, y: sy * half.y, z: sz * half.z };
            const depth = distance - (c.x * direction.x + c.y * direction.y + c.z * direction.z);
            expect(depth).toBeGreaterThan(0);
            // Offset of the corner from the view axis, split into horizontal and vertical.
            const along = c.x * direction.x + c.y * direction.y + c.z * direction.z;
            const off = {
              x: c.x - along * direction.x,
              y: c.y - along * direction.y,
              z: c.z - along * direction.z,
            };
            const flat = Math.hypot(direction.x, direction.z);
            const right =
              flat < 1e-9 ? { x: 1, z: 0 } : { x: direction.z / flat, z: -direction.x / flat };
            const across = off.x * right.x + off.z * right.z;
            const upward = Math.sqrt(
              Math.max(0, off.x ** 2 + off.y ** 2 + off.z ** 2 - across ** 2),
            );
            const tanV = Math.tan(fov / 2);
            widest = Math.max(
              widest,
              Math.abs(across) / (depth * tanV * aspect),
              upward / (depth * tanV),
            );
          }
        }
      }
      // Every corner is inside the view and at least one touches its edge.
      expect(widest).toBeCloseTo(1, 9);
    }
  });
});

describe('status', () => {
  it('reports low pressure at the critical node of the undersized stage 2 design', () => {
    const scenario = stage('stage2');
    const evaluation = evaluateStage(scenario, initialDiameters(scenario));
    const critical = criticalNode(evaluation);
    expect(critical).not.toBeNull();
    const lowest = Math.min(...scenario.nodes.map((n) => evaluation.result.nodes[n.id]!.pressure));
    expect(critical!.pressure).toBe(lowest);
    expect(critical!.pressure).toBeLessThan(10);
    expect(pressureStatus(evaluation, critical!.id)).toBe('low');
  });

  it('reports ok pressures for the reference design and no status without a result', () => {
    const scenario = stage('stage2');
    const evaluation = evaluateStage(scenario, scenario.reference.diameters);
    for (const node of scenario.nodes) expect(pressureStatus(evaluation, node.id)).toBe('ok');
    expect(pressureStatus(evaluation, 'R1')).toBe('none');
    expect(pressureStatus(null, 'N1')).toBe('none');
    expect(criticalNode(null)).toBeNull();
    expect(velocityStatus(null, 'T1')).toBe('none');
    for (const pipe of scenario.pipes) {
      expect(['low', 'ok']).toContain(velocityStatus(evaluation, pipe.id));
    }
  });

  it('leaves the pump discharge node of stage 5 out of the pressure limits', () => {
    const scenario = stage('stage5');
    const evaluation = evaluateStage(scenario, scenario.reference.diameters);
    expect(pressureStatus(evaluation, 'J1')).toBe('none');
    expect(criticalNode(evaluation)!.id).not.toBe('J1');
  });
});
