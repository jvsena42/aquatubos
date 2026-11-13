import { pointInPolygon } from './geometry';
import { buildTerrain, elevationAt, FLAT_SPAN } from './terrain';

const bounds = { minX: 0, minY: 0, maxX: 400, maxY: 200 };
const hill = [
  { x: 50, y: 100, elevation: 100 },
  { x: 350, y: 100, elevation: 130 },
];

describe('terrain', () => {
  it('interpolates between the known elevations', () => {
    // Midway between two points the weights are equal: the mean.
    expect(elevationAt(hill, 200, 100)).toBeCloseTo(115);
    expect(elevationAt(hill, 350, 100)).toBeGreaterThan(elevationAt(hill, 50, 100));
    for (const [x, y] of [
      [0, 0],
      [120, 40],
      [390, 190],
    ] as const) {
      const value = elevationAt(hill, x, y);
      expect(value).toBeGreaterThan(100);
      expect(value).toBeLessThan(130);
    }
    expect(elevationAt([], 0, 0)).toBe(0);
  });

  it('gives no shading to flat ground', () => {
    expect(buildTerrain([hill[0]!], bounds)).toBeNull();
    expect(
      buildTerrain([hill[0]!, { x: 300, y: 100, elevation: 100 + FLAT_SPAN }], bounds),
    ).toBeNull();
  });

  it('stacks bands that rise towards the high point', () => {
    const terrain = buildTerrain(hill, bounds)!;
    expect(terrain.bands.length).toBeGreaterThanOrEqual(3);
    expect(terrain.bands.length).toBeLessThanOrEqual(6);
    expect(terrain.min).toBeGreaterThanOrEqual(100);
    expect(terrain.max).toBeLessThanOrEqual(130);
    const levels = terrain.bands.map((band) => band.level);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
    expect(terrain.base).toBeGreaterThan(0);
    expect(terrain.base).toBeLessThan(terrain.bands.length);

    const covers = (index: number, x: number, y: number) =>
      terrain.bands[index]!.polygons.some((polygon) => pointInPolygon({ x, y }, polygon));
    const top = terrain.bands.length - 1;
    // The high end is inside every band, the low end inside none.
    expect(covers(0, 350, 100)).toBe(true);
    expect(covers(top, 350, 100)).toBe(true);
    expect(covers(0, 50, 100)).toBe(false);
    // Bands shrink as the level rises.
    expect(covers(0, 210, 100)).toBe(true);
    expect(covers(top, 210, 100)).toBe(false);
  });
});
