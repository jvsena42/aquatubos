import {
  boundsOf,
  boxCorners,
  convexHull,
  foldAngle,
  pointInPolygon,
  pointPolygonDistance,
  pointSegmentDistance,
  polygonDistance,
  segmentPolygonDistance,
  segmentSegmentDistance,
  segmentsIntersect,
} from './geometry';

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe('town geometry', () => {
  it('gives the corners of a turned box', () => {
    // 4 x 2 box at (10, 10) turned 90°: its long side runs along y.
    const corners = boxCorners({ x: 10, y: 10, w: 4, d: 2, rotation: Math.PI / 2 });
    const { minX, maxX, minY, maxY } = boundsOf(corners);
    expect(minX).toBeCloseTo(9);
    expect(maxX).toBeCloseTo(11);
    expect(minY).toBeCloseTo(8);
    expect(maxY).toBeCloseTo(12);
  });

  it('measures point to segment distance, clamped at the ends', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };
    expect(pointSegmentDistance({ x: 5, y: 3 }, a, b)).toBeCloseTo(3);
    // Beyond the end: distance to the end point, hypot(3, 4) = 5.
    expect(pointSegmentDistance({ x: 13, y: 4 }, a, b)).toBeCloseTo(5);
    expect(pointSegmentDistance({ x: 3, y: 4 }, a, a)).toBeCloseTo(5);
  });

  it('detects crossing, touching and separate segments', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 10 };
    expect(segmentsIntersect(a, b, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(true);
    expect(segmentsIntersect(a, b, { x: 5, y: 5 }, { x: 9, y: 0 })).toBe(true);
    expect(segmentsIntersect(a, b, { x: 6, y: 5 }, { x: 9, y: 0 })).toBe(false);
    expect(segmentSegmentDistance(a, { x: 10, y: 0 }, { x: 0, y: 4 }, { x: 10, y: 4 })).toBe(4);
    expect(segmentSegmentDistance(a, b, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(0);
  });

  it('tests points against a convex polygon in either winding', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 5, y: 5 }, [...square].reverse())).toBe(true);
    expect(pointInPolygon({ x: 10, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 11, y: 5 }, square)).toBe(false);
    expect(pointPolygonDistance({ x: 5, y: 5 }, square)).toBe(0);
    expect(pointPolygonDistance({ x: 13, y: 14 }, square)).toBeCloseTo(5);
  });

  it('measures segment to polygon distance', () => {
    expect(segmentPolygonDistance({ x: -5, y: 5 }, { x: 15, y: 5 }, square)).toBe(0);
    expect(segmentPolygonDistance({ x: 2, y: 2 }, { x: 3, y: 3 }, square)).toBe(0);
    expect(segmentPolygonDistance({ x: -5, y: 13 }, { x: 15, y: 13 }, square)).toBeCloseTo(3);
  });

  it('measures polygon to polygon distance', () => {
    const moved = (dx: number, dy: number) => square.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    expect(polygonDistance(square, moved(5, 5))).toBe(0);
    expect(polygonDistance(square, moved(14, 0))).toBeCloseTo(4);
    // One inside the other.
    const inner = [
      { x: 4, y: 4 },
      { x: 6, y: 4 },
      { x: 6, y: 6 },
      { x: 4, y: 6 },
    ];
    expect(polygonDistance(square, inner)).toBe(0);
    expect(polygonDistance(inner, square)).toBe(0);
    // A 2 x 2 box turned 45° at (13, 13): its edge faces the corner (10, 10) of the square.
    // Centre to corner is 3√2 and the edge is 1 from the centre, so the gap is 3√2 − 1.
    const diamond = boxCorners({ x: 13, y: 13, w: 2, d: 2, rotation: Math.PI / 4 });
    expect(polygonDistance(square, diamond)).toBeCloseTo(3 * Math.SQRT2 - 1);
  });

  it('builds a convex hull without interior points', () => {
    const hull = convexHull([...square, { x: 5, y: 5 }, { x: 5, y: 0 }, { x: 2, y: 8 }]);
    expect(hull).toHaveLength(4);
    for (const corner of square) expect(hull).toContainEqual(corner);
    expect(convexHull([{ x: 1, y: 1 }])).toEqual([{ x: 1, y: 1 }]);
  });

  it('folds directions so a street and its reverse agree', () => {
    expect(foldAngle(Math.PI)).toBeCloseTo(0);
    expect(foldAngle(-Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    expect(foldAngle((3 * Math.PI) / 4)).toBeCloseTo(-Math.PI / 4);
    expect(foldAngle(0.3)).toBeCloseTo(0.3);
  });
});
