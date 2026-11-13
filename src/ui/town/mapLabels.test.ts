import { initialDiameters } from '../../game/buildNetwork';
import { evaluateStage } from '../../game/evaluate';
import { serviceStatuses } from '../../game/houses';
import { generateTown } from '../../game/town';
import { SCENARIOS } from '../../scenarios';
import type { Diameters, Scenario } from '../../scenarios/types';
import { toScreen, INITIAL_VIEW, type Size } from '../network/geometry';
import { rectsOverlap, type Rect } from '../network/labels';
import { layoutMap, obstacleTouches } from '../network/mapLayout';
import { schematicBounds, schematicObstacles, schematicPadding } from '../network/NetworkView';
import { schematicLabels } from '../network/schematicLabels';
import { nodeStatuses, pipeStatuses } from '../network/status';
import { townBounds, townLabels, townObstacles, townPadding } from './townLabels';

/**
 * The guarantees of the maps at phone size, on the five real stages: after the fit nothing of
 * the network lies under the controls, every pipe and node shows its id, no two labels touch
 * and no label is under a control. 344 × 330 is the canvas of a 360 × 640 phone and 374 × 530
 * that of a 390 × 844 one; the others are a taller canvas, a phone lying down and a tablet.
 */
const SIZES: Size[] = [
  { width: 344, height: 330 },
  { width: 344, height: 282 },
  { width: 374, height: 530 },
  { width: 440, height: 250 },
  { width: 700, height: 560 },
];

const num = (value: number, digits = 2) => value.toFixed(digits).replace('.', ',');

interface Labelled {
  ids: string[];
  rects: Rect[];
}

function designs(scenario: Scenario): { name: string; diameters: Diameters; solved: boolean }[] {
  return [
    { name: 'before a result', diameters: initialDiameters(scenario), solved: false },
    { name: 'initial design', diameters: initialDiameters(scenario), solved: true },
    { name: 'reference design', diameters: scenario.reference.diameters, solved: true },
  ];
}

function expectLabels(scenario: Scenario, size: Size, keepClear: Rect, { ids, rects }: Labelled) {
  for (const pipe of scenario.pipes) expect(ids).toContain(`pipe:${pipe.id}`);
  for (const node of scenario.nodes) expect(ids).toContain(`node:${node.id}`);
  for (const reservoir of scenario.reservoirs) expect(ids).toContain(`reservoir:${reservoir.id}`);
  for (const pump of scenario.pumps) expect(ids).toContain(`pump:${pump.id}`);
  rects.forEach((rect, index) => {
    expect(rectsOverlap(rect, keepClear), `${ids[index]} under the controls`).toBe(false);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(size.width);
    expect(rect.y + rect.height).toBeLessThanOrEqual(size.height);
    for (let other = index + 1; other < rects.length; other++) {
      expect(rectsOverlap(rect, rects[other]!), `${ids[index]} over ${ids[other]}`).toBe(false);
    }
  });
}

describe.each(SCENARIOS.map((scenario) => [scenario.id, scenario] as const))(
  'map labels of %s',
  (_id, scenario) => {
    const town = generateTown(scenario);

    it.each(SIZES)('schematic at $width × $height', (size) => {
      for (const coarse of [true, false]) {
        const obstacles = schematicObstacles(scenario, coarse);
        const layout = layoutMap({
          bounds: schematicBounds(scenario),
          obstacles,
          size,
          padding: schematicPadding(size),
          slots: 4,
        });
        for (const obstacle of obstacles) {
          expect(obstacleTouches(obstacle, layout.keepClear, layout.fit, size)).toBe(false);
        }
        const world = new Map(
          [...scenario.nodes, ...scenario.reservoirs].map((n) => [n.id, { x: n.x, y: n.y }]),
        );
        const at = (id: string) => toScreen(world.get(id)!, layout.fit, INITIAL_VIEW, size);
        for (const design of designs(scenario)) {
          const evaluation = design.solved
            ? evaluateStage(scenario, design.diameters, scenario.formula)
            : null;
          for (const selection of [null, { type: 'pipe' as const, id: scenario.pipes[0]!.id }]) {
            const { labels } = schematicLabels({
              scenario,
              diameters: design.diameters,
              evaluation,
              nodeStatus: nodeStatuses(evaluation, scenario.checks),
              pipeStatus: pipeStatuses(evaluation, scenario.checks),
              selection,
              at,
              inward: toScreen(layout.fit.center, layout.fit, INITIAL_VIEW, size),
              size,
              blocked: [layout.keepClear],
              num,
            });
            expectLabels(scenario, size, layout.keepClear, {
              ids: [...labels.keys()],
              rects: [...labels.values()].map((label) => label.rect),
            });
          }
        }
      }
    });

    it.each(SIZES)('town at $width × $height', (size) => {
      for (const coarse of [true, false]) {
        const obstacles = townObstacles(town, scenario, coarse);
        const layout = layoutMap({
          bounds: townBounds(town),
          obstacles,
          size,
          padding: townPadding(size),
          slots: 4,
        });
        for (const obstacle of obstacles) {
          expect(obstacleTouches(obstacle, layout.keepClear, layout.fit, size)).toBe(false);
        }
        const origin = toScreen({ x: 0, y: 0 }, layout.fit, INITIAL_VIEW, size);
        const scale = layout.fit.scale;
        for (const design of designs(scenario)) {
          const evaluation = design.solved
            ? evaluateStage(scenario, design.diameters, scenario.formula)
            : null;
          for (const selection of [null, { type: 'pipe' as const, id: scenario.pipes[0]!.id }]) {
            const { pills } = townLabels({
              town,
              scenario,
              diameters: design.diameters,
              evaluation,
              pipeStatus: pipeStatuses(evaluation, scenario.checks),
              service: serviceStatuses(scenario, evaluation),
              selection,
              size,
              scale,
              project: (p) => ({ x: origin.x + p.x * scale, y: origin.y + p.y * scale }),
              blocked: [layout.keepClear],
              num,
            });
            expectLabels(scenario, size, layout.keepClear, {
              ids: pills.map(({ pill }) => `${pill.kind}:${pill.id}`),
              rects: pills.map(({ rect }) => rect),
            });
          }
        }
      }
    });
  },
);
