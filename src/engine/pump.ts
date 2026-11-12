import type { PumpCurve, PumpCurvePoint } from './types';

/**
 * Fits H = a − b·Q^c through three points of a pump curve.
 * The first point is normally the shutoff point (Q = 0); points must have increasing flow and
 * decreasing head. Throws an Error with a clear message when the points are not valid.
 */
export function fitPumpCurve(
  _points: readonly [PumpCurvePoint, PumpCurvePoint, PumpCurvePoint],
): PumpCurve {
  throw new Error('not implemented');
}

/** Pump head at `flow` (m³/s), m. For flow <= 0 returns the shutoff head `a`. */
export function pumpHead(_curve: PumpCurve, _flow: number): number {
  throw new Error('not implemented');
}

/** dH/dQ of the pump curve at `flow` (<= 0). */
export function pumpHeadGradient(_curve: PumpCurve, _flow: number): number {
  throw new Error('not implemented');
}
