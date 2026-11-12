/** Plane geometry for the town generator. Pure functions, plan coordinates in metres. */

export interface Point {
  x: number;
  y: number;
}

/** Rectangle centred at (x, y): `w` along its own x axis, `d` across, turned by `rotation` rad. */
export interface Box {
  x: number;
  y: number;
  w: number;
  d: number;
  rotation: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** The four corners of a box, in order around it. */
export function boxCorners(box: Box): Point[] {
  const cos = Math.cos(box.rotation);
  const sin = Math.sin(box.rotation);
  const hw = box.w / 2;
  const hd = box.d / 2;
  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([lx, ly]) => ({
    x: box.x + lx! * cos - ly! * sin,
    y: box.y + lx! * sin + ly! * cos,
  }));
}

export function pointSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  if (length2 === 0) return distance(p, a);
  const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** True when the two segments share at least one point. */
export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  const on = (p: Point, q: Point, r: Point) =>
    Math.min(p.x, q.x) <= r.x &&
    r.x <= Math.max(p.x, q.x) &&
    Math.min(p.y, q.y) <= r.y &&
    r.y <= Math.max(p.y, q.y);
  return (
    (d1 === 0 && on(c, d, a)) ||
    (d2 === 0 && on(c, d, b)) ||
    (d3 === 0 && on(a, b, c)) ||
    (d4 === 0 && on(a, b, d))
  );
}

export function segmentSegmentDistance(a: Point, b: Point, c: Point, d: Point): number {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b),
  );
}

/** Point inside or on the edge of a convex polygon (either winding). */
export function pointInPolygon(p: Point, polygon: readonly Point[]): boolean {
  let sign = 0;
  for (let i = 0; i < polygon.length; i++) {
    const c = cross(polygon[i]!, polygon[(i + 1) % polygon.length]!, p);
    if (c === 0) continue;
    if (sign === 0) sign = Math.sign(c);
    else if (Math.sign(c) !== sign) return false;
  }
  return true;
}

/** Distance from a point to a convex polygon; 0 when the point is inside. */
export function pointPolygonDistance(p: Point, polygon: readonly Point[]): number {
  if (pointInPolygon(p, polygon)) return 0;
  let best = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    best = Math.min(best, pointSegmentDistance(p, polygon[i]!, polygon[(i + 1) % polygon.length]!));
  }
  return best;
}

/** Distance from a segment to a convex polygon; 0 when they touch or the segment is inside. */
export function segmentPolygonDistance(a: Point, b: Point, polygon: readonly Point[]): number {
  if (pointInPolygon(a, polygon) || pointInPolygon(b, polygon)) return 0;
  let best = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const d = segmentSegmentDistance(a, b, polygon[i]!, polygon[(i + 1) % polygon.length]!);
    if (d === 0) return 0;
    best = Math.min(best, d);
  }
  return best;
}

/** Distance between two convex polygons; 0 when they overlap or touch. */
export function polygonDistance(p: readonly Point[], q: readonly Point[]): number {
  if (pointInPolygon(p[0]!, q) || pointInPolygon(q[0]!, p)) return 0;
  let best = Infinity;
  for (let i = 0; i < p.length; i++) {
    const d = segmentPolygonDistance(p[i]!, p[(i + 1) % p.length]!, q);
    if (d === 0) return 0;
    best = Math.min(best, d);
  }
  return best;
}

/** Convex hull (Andrew's monotone chain), without repeated or collinear points. */
export function convexHull(points: readonly Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length < 3) return sorted;
  const build = (list: readonly Point[]) => {
    const chain: Point[] = [];
    for (const p of list) {
      while (
        chain.length >= 2 &&
        cross(chain[chain.length - 2]!, chain[chain.length - 1]!, p) <= 0
      ) {
        chain.pop();
      }
      chain.push(p);
    }
    chain.pop();
    return chain;
  };
  return [...build(sorted), ...build([...sorted].reverse())];
}

/** Angle of a direction folded into (−π/2, π/2], so a street and its reverse give the same. */
export function foldAngle(angle: number): number {
  let folded = angle % Math.PI;
  if (folded > Math.PI / 2) folded -= Math.PI;
  if (folded <= -Math.PI / 2) folded += Math.PI;
  return folded;
}

export function boundsOf(points: readonly Point[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}
