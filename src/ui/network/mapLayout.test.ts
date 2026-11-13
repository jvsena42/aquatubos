import { SCENARIOS } from '../../scenarios';
import { fitToSize, INITIAL_VIEW, toScreen } from './geometry';
import { rectsOverlap } from './labels';
import {
  fitPoint,
  fitWithInsets,
  LABEL_ROOM,
  layoutMap,
  obstacleRect,
  obstacleTouches,
  STRIP_BUTTON,
  STRIP_GAP,
  STRIP_MARGIN,
  STRIP_OFFSET,
  stripRect,
  type Obstacle,
  type WorldBox,
} from './mapLayout';
import { schematicBounds, schematicObstacles, schematicPadding } from './NetworkView';

const phone = { width: 344, height: 330 };
const box: WorldBox = { minX: 0, minY: 0, maxX: 1000, maxY: 400 };
const point = (x: number, y: number, pad = 22): Obstacle => ({
  kind: 'box',
  box: { minX: x, minY: y, maxX: x, maxY: y },
  pad,
});

describe('stripRect', () => {
  it('puts a row of four 34 px buttons in the top right corner', () => {
    // 4 × 34 + 3 × 4 = 148 px long, 6 px from the top and right edges.
    expect(stripRect(phone, 'row', 4)).toEqual({ x: 344 - 6 - 148, y: 6, width: 148, height: 34 });
    expect(4 * STRIP_BUTTON + 3 * STRIP_GAP).toBe(148);
    expect(STRIP_OFFSET).toBe(6);
  });

  it('puts a column in the same corner', () => {
    // Three buttons: 3 × 34 + 2 × 4 = 110 px.
    expect(stripRect(phone, 'column', 3)).toEqual({
      x: 344 - 6 - 34,
      y: 6,
      width: 34,
      height: 110,
    });
  });

  it('keeps a margin that covers the 44 px touch areas of the buttons', () => {
    // A 34 px button with a 44 px hit area reaches 5 px beyond itself.
    expect(STRIP_MARGIN).toBeGreaterThanOrEqual((44 - STRIP_BUTTON) / 2);
  });
});

describe('fitWithInsets', () => {
  it('is fitToSize with the same padding on every side', () => {
    const insets = { top: 20, bottom: 20, left: 30, right: 30 };
    const fit = fitWithInsets(box, phone, insets);
    const reference = fitToSize(
      [
        { x: 0, y: 0 },
        { x: 1000, y: 400 },
      ],
      phone,
      { x: 30, y: 20 },
    );
    expect(fit.scale).toBeCloseTo(reference.scale);
    expect(fit.center).toEqual(reference.center);
  });

  it('centres the box in the area left by unequal insets', () => {
    // 344 × 330 minus 12 px at the sides, 60 px at the top and 14 px at the bottom:
    // 320 × 256 free. The box is 1000 × 400 m: scale min(0.32, 0.64) = 0.32 px/m.
    const fit = fitWithInsets(box, phone, { top: 60, bottom: 14, left: 12, right: 12 });
    expect(fit.scale).toBeCloseTo(0.32);
    // The box is 128 px tall, centred in y between 60 and 316: from 124 to 252.
    expect(fitPoint({ x: 0, y: 0 }, fit, phone)).toEqual({ x: 12, y: 124 });
    const end = fitPoint({ x: 1000, y: 400 }, fit, phone);
    expect(end.x).toBeCloseTo(332);
    expect(end.y).toBeCloseTo(252);
    // Same result through the view transform of the drawings.
    expect(toScreen({ x: 0, y: 0 }, fit, INITIAL_VIEW, phone).y).toBeCloseTo(124);
  });
});

describe('obstacles', () => {
  const fit = fitWithInsets(box, phone, { top: 0, bottom: 0, left: 0, right: 0 });

  it('grows a point by its fixed size on screen', () => {
    // Scale 0.344 px/m; the box is 137.6 px tall, centred: y from 96.2 to 233.8.
    const rect = obstacleRect(point(1000, 0), fit, phone);
    expect(rect.x).toBeCloseTo(344 - 22);
    expect(rect.y).toBeCloseTo(96.2 - 22);
    expect(rect.width).toBe(44);
  });

  it('tests a pipe by its distance, not by its bounding box', () => {
    const diagonal: Obstacle = {
      kind: 'segment',
      a: { x: 0, y: 0 },
      b: { x: 1000, y: 400 },
      halfWorld: 0,
      halfPx: 22,
    };
    // The top right corner is inside the bounding box of the diagonal but 100 px from it.
    const corner = { x: 300, y: 96, width: 44, height: 30 };
    expect(rectsOverlap(obstacleRect(diagonal, fit, phone), corner)).toBe(true);
    expect(obstacleTouches(diagonal, corner, fit, phone)).toBe(false);
    expect(obstacleTouches(diagonal, { x: 150, y: 150, width: 44, height: 30 }, fit, phone)).toBe(
      true,
    );
  });

  it('uses the wider of the width in metres and in px for a segment', () => {
    const street: Obstacle = {
      kind: 'segment',
      a: { x: 0, y: 200 },
      b: { x: 1000, y: 200 },
      halfWorld: 100,
      halfPx: 5,
    };
    // 100 m is 34.4 px at this scale: a rect 30 px above the street touches it.
    expect(obstacleTouches(street, { x: 100, y: 125, width: 10, height: 10 }, fit, phone)).toBe(
      true,
    );
    expect(
      obstacleTouches(
        { ...street, halfWorld: 0 },
        { x: 100, y: 125, width: 10, height: 10 },
        fit,
        phone,
      ),
    ).toBe(false);
  });
});

describe('layoutMap', () => {
  const padding = { x: 12, y: 14 };

  it('keeps the plain fit when the corner under the strip is empty', () => {
    // Only a node at the bottom left: nothing near the top right corner.
    const layout = layoutMap({
      bounds: box,
      obstacles: [point(0, 400)],
      size: phone,
      padding,
      slots: 4,
    });
    expect(layout.reserved).toBe(false);
    expect(layout.orientation).toBe('row');
    expect(layout.fit.scale).toBeCloseTo(0.32);
    expect(layout.strip).toEqual(stripRect(phone, 'row', 4));
    // The blocked area is the strip plus its margin on every side.
    expect(layout.keepClear).toEqual({ x: 184, y: 0, width: 160, height: 46 });
  });

  it('sets the band of the strip aside when a node would lie under it', () => {
    // A tall network with a node in the top right corner of its extent.
    const tall: WorldBox = { minX: 0, minY: 0, maxX: 300, maxY: 400 };
    const obstacles = [point(300, 0), point(0, 400)];
    const plain = fitWithInsets(tall, phone, { top: 14, bottom: 14, left: 12, right: 12 });
    expect(
      obstacleTouches(obstacles[0]!, { x: 184, y: 0, width: 160, height: 46 }, plain, phone),
    ).toBe(true);
    const layout = layoutMap({ bounds: tall, obstacles, size: phone, padding, slots: 4 });
    expect(layout.reserved).toBe(true);
    // The height limits this fit, so a column at the right costs no scale.
    expect(layout.orientation).toBe('column');
    expect(layout.fit.scale).toBeCloseTo(plain.scale);
    for (const obstacle of obstacles) {
      expect(obstacleTouches(obstacle, layout.keepClear, layout.fit, phone)).toBe(false);
      // And a label still fits between the node and the controls.
      const rect = obstacleRect(obstacle, layout.fit, phone);
      const roomy = {
        x: layout.keepClear.x - LABEL_ROOM,
        y: layout.keepClear.y - LABEL_ROOM,
        width: layout.keepClear.width + 2 * LABEL_ROOM,
        height: layout.keepClear.height + 2 * LABEL_ROOM,
      };
      expect(rectsOverlap(rect, roomy)).toBe(false);
    }
  });

  it('turns the strip into a column when that keeps the drawing larger', () => {
    // A wide canvas and a wide network that fills its width: a row would cost height, which is
    // what limits the scale; a column costs width, which is to spare.
    const size = { width: 700, height: 240 };
    const wide: WorldBox = { minX: 0, minY: 0, maxX: 1200, maxY: 400 };
    const obstacles = [point(1200, 0), point(0, 0), point(1200, 400), point(0, 400)];
    const layout = layoutMap({ bounds: wide, obstacles, size, padding, slots: 4 });
    expect(layout.orientation).toBe('column');
    expect(layout.strip).toEqual(stripRect(size, 'column', 4));
    for (const obstacle of obstacles) {
      expect(obstacleTouches(obstacle, layout.keepClear, layout.fit, size)).toBe(false);
    }
    expect(layout.reserved).toBe(true);
    const row = fitWithInsets(wide, size, {
      top: 46 + LABEL_ROOM + 22,
      bottom: 14,
      left: 12,
      right: 12,
    });
    expect(layout.fit.scale).toBeGreaterThan(row.scale);
  });

  it('never uses a column that does not fit the height', () => {
    const size = { width: 400, height: 140 };
    const layout = layoutMap({
      bounds: box,
      obstacles: [point(1000, 0)],
      size,
      padding,
      slots: 4,
    });
    expect(layout.orientation).toBe('row');
  });

  it.each(SCENARIOS.map((scenario) => [scenario.id, scenario] as const))(
    'clears the strip in %s at 360 × 640 and 390 × 844, for touch and mouse',
    (_id, scenario) => {
      for (const size of [phone, { width: 374, height: 530 }]) {
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
          // Every node marker stays inside the canvas with its 44 px hit area.
          for (const node of [...scenario.nodes, ...scenario.reservoirs]) {
            const p = fitPoint(node, layout.fit, size);
            expect(p.x).toBeGreaterThanOrEqual(22);
            expect(p.x).toBeLessThanOrEqual(size.width - 22);
            expect(p.y).toBeGreaterThanOrEqual(22);
            expect(p.y).toBeLessThanOrEqual(size.height - 22);
          }
        }
      }
    },
  );
});
