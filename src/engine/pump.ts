import { MIN_HEAD_LOSS_GRADIENT } from './headloss';
import type { PumpCurve, PumpCurvePoint } from './types';

/** Largest exponent accepted for a fitted curve (the limit EPANET uses). */
const MAX_CURVE_EXPONENT = 20;

/**
 * Exponent c for three points with Q1 > 0. Eliminating a and b from H = a − b·Q^c leaves
 *   (Q2^c − Q1^c) / (Q3^c − Q2^c) = (H1 − H2) / (H2 − H3),
 * whose left side decreases from ln(Q2/Q1)/ln(Q3/Q2) at c → 0 to 0 at c → ∞. Solved by bisection.
 */
function exponentByBisection(q1: number, q2: number, q3: number, headRatio: number): number {
  const u = q1 / q2;
  const w = q3 / q2;
  const g = (c: number): number => (1 - Math.pow(u, c)) / (Math.pow(w, c) - 1) - headRatio;
  let low = 1e-9;
  let high = MAX_CURVE_EXPONENT;
  if (!(g(low) > 0) || !(g(high) < 0)) return Number.NaN;
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    if (g(mid) > 0) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/**
 * Fits H = a − b·Q^c through three points of a pump curve.
 * The first point is normally the shutoff point (Q = 0); points must have increasing flow and
 * decreasing head. Throws an Error with a clear message when the points are not valid.
 *
 * With Q1 = 0 the fit is direct (and is the one EPANET makes for a three-point curve):
 *   a = H1,  c = ln((H1 − H3)/(H1 − H2)) / ln(Q3/Q2),  b = (H1 − H2) / Q2^c.
 */
export function fitPumpCurve(
  points: readonly [PumpCurvePoint, PumpCurvePoint, PumpCurvePoint],
): PumpCurve {
  if (points.length !== 3) {
    throw new Error('Pump curve: exactly three points are required.');
  }
  const [p1, p2, p3] = points;
  for (const p of points) {
    if (!Number.isFinite(p.flow) || !Number.isFinite(p.head)) {
      throw new Error('Pump curve: flow and head of every point must be finite numbers.');
    }
    if (p.flow < 0) throw new Error('Pump curve: flow cannot be negative.');
    if (p.head < 0) throw new Error('Pump curve: head cannot be negative.');
  }
  if (!(p1.flow < p2.flow && p2.flow < p3.flow)) {
    throw new Error('Pump curve: points must be given in order of strictly increasing flow.');
  }
  if (!(p1.head > p2.head && p2.head > p3.head)) {
    throw new Error('Pump curve: head must strictly decrease as the flow increases.');
  }

  let a: number;
  let b: number;
  let c: number;
  if (p1.flow === 0) {
    a = p1.head;
    c = Math.log((a - p3.head) / (a - p2.head)) / Math.log(p3.flow / p2.flow);
    b = (a - p2.head) / Math.pow(p2.flow, c);
  } else {
    c = exponentByBisection(p1.flow, p2.flow, p3.flow, (p1.head - p2.head) / (p2.head - p3.head));
    b = (p1.head - p2.head) / (Math.pow(p2.flow, c) - Math.pow(p1.flow, c));
    a = p1.head + b * Math.pow(p1.flow, c);
  }
  if (!Number.isFinite(c) || c <= 0 || c > MAX_CURVE_EXPONENT) {
    throw new Error(
      `Pump curve: no curve H = a − b·Q^c with 0 < c <= ${MAX_CURVE_EXPONENT} passes through the three points.`,
    );
  }
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) {
    throw new Error('Pump curve: the three points do not define a valid curve H = a − b·Q^c.');
  }
  return { a, b, c };
}

/** Pump head at `flow` (m³/s), m. For flow <= 0 returns the shutoff head `a`. */
export function pumpHead(curve: PumpCurve, flow: number): number {
  if (flow <= 0) return curve.a;
  return curve.a - curve.b * Math.pow(flow, curve.c);
}

/** dH/dQ of the pump curve at `flow` (<= 0). Zero for flow <= 0, where `pumpHead` is constant. */
export function pumpHeadGradient(curve: PumpCurve, flow: number): number {
  if (flow <= 0) return 0;
  return -curve.b * curve.c * Math.pow(flow, curve.c - 1);
}

/** Flow at which the pump head falls to zero, m³/s. */
export function pumpRunoutFlow(curve: PumpCurve): number {
  return Math.pow(curve.a / curve.b, 1 / curve.c);
}

/**
 * Upper bound of the gradient returned by `pumpLinkLoss`, s/m². Only reached by curves with
 * c < 1, whose slope is infinite at Q = 0.
 */
const MAX_PUMP_GRADIENT = 1e12;

export interface PumpLinkLoss {
  /** head[from] − head[to], m: minus the head added by the pump. */
  headLoss: number;
  /** d(headLoss)/dQ, s/m², always > 0. */
  gradient: number;
}

/**
 * The pump seen by the network solver as a link with "head loss" head[from] − head[to].
 *
 * For Q >= 0 this is −(a − b·Q^c). Above the runout flow the head added becomes negative, so the
 * pump simply turns into a resistance. For Q < 0 the curve is continued as an odd function about
 * the shutoff point, head added = a + b·|Q|^c: the head keeps rising as the flow reverses. This
 * keeps the function increasing and smooth through Q = 0, which Newton's method needs. There is
 * no check valve in the model: when the downstream head exceeds the upstream head by more than
 * the shutoff head, the solution has a negative pump flow, and callers should treat that as a
 * pump that cannot deliver.
 *
 * As in `pipeLoss`, the gradient is bounded below by `MIN_HEAD_LOSS_GRADIENT` and the curve is
 * replaced by a straight line through the shutoff point where the bound applies.
 */
export function pumpLinkLoss(curve: PumpCurve, flow: number): PumpLinkLoss {
  const q = Math.abs(flow);
  const gradient = curve.b * curve.c * Math.pow(q, curve.c - 1);
  if (!(gradient >= MIN_HEAD_LOSS_GRADIENT)) {
    return {
      headLoss: -curve.a + MIN_HEAD_LOSS_GRADIENT * flow,
      gradient: MIN_HEAD_LOSS_GRADIENT,
    };
  }
  return {
    headLoss: -curve.a + Math.sign(flow) * curve.b * Math.pow(q, curve.c),
    gradient: Math.min(gradient, MAX_PUMP_GRADIENT),
  };
}
