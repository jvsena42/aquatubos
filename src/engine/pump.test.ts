import { MIN_HEAD_LOSS_GRADIENT } from './headloss';
import { fitPumpCurve, pumpHead, pumpHeadGradient, pumpLinkLoss, pumpRunoutFlow } from './pump';
import type { PumpCurve, PumpCurvePoint } from './types';

type Points = [PumpCurvePoint, PumpCurvePoint, PumpCurvePoint];

describe('fitPumpCurve', () => {
  // Points (0; 50), (0.010; 45), (0.020; 30), Q in m³/s and H in m.
  //   a = 50
  //   c = ln((50 − 30)/(50 − 45)) / ln(0.020/0.010) = ln 4 / ln 2 = 2
  //   b = (50 − 45) / 0.010² = 50 000
  it('fits the hand-computed parabola through a shutoff point', () => {
    const curve = fitPumpCurve([
      { flow: 0, head: 50 },
      { flow: 0.01, head: 45 },
      { flow: 0.02, head: 30 },
    ]);
    expect(curve.a).toBeCloseTo(50, 12);
    expect(curve.b).toBeCloseTo(50000, 6);
    expect(curve.c).toBeCloseTo(2, 12);
  });

  it.each<[string, Points]>([
    [
      'shutoff point first',
      [
        { flow: 0, head: 42 },
        { flow: 0.006, head: 38 },
        { flow: 0.012, head: 25 },
      ],
    ],
    [
      'unevenly spaced flows',
      [
        { flow: 0, head: 80 },
        { flow: 0.004, head: 77 },
        { flow: 0.03, head: 12 },
      ],
    ],
    [
      'first point with Q > 0',
      [
        { flow: 0.005, head: 48.75 },
        { flow: 0.01, head: 45 },
        { flow: 0.02, head: 30 },
      ],
    ],
    [
      'first point with Q > 0 and a non-integer exponent',
      [
        { flow: 0.002, head: 39 },
        { flow: 0.008, head: 33 },
        { flow: 0.015, head: 21 },
      ],
    ],
  ])('reproduces its three points: %s', (_name, points) => {
    const curve = fitPumpCurve(points);
    for (const p of points) {
      expect(pumpHead(curve, p.flow)).toBeCloseTo(p.head, 9);
    }
    expect(curve.b).toBeGreaterThan(0);
    expect(curve.c).toBeGreaterThan(0);
  });

  it('recovers the parabola when the first point is not the shutoff point', () => {
    // The three points lie on H = 50 − 50 000·Q².
    const curve = fitPumpCurve([
      { flow: 0.005, head: 48.75 },
      { flow: 0.01, head: 45 },
      { flow: 0.02, head: 30 },
    ]);
    expect(curve.a).toBeCloseTo(50, 8);
    expect(curve.c).toBeCloseTo(2, 8);
    expect(curve.b / 50000).toBeCloseTo(1, 7);
  });

  it.each<[string, Points, RegExp]>([
    [
      'flows not increasing',
      [
        { flow: 0, head: 50 },
        { flow: 0.02, head: 45 },
        { flow: 0.01, head: 30 },
      ],
      /increasing flow/,
    ],
    [
      'repeated flow',
      [
        { flow: 0, head: 50 },
        { flow: 0.01, head: 45 },
        { flow: 0.01, head: 30 },
      ],
      /increasing flow/,
    ],
    [
      'head not decreasing',
      [
        { flow: 0, head: 50 },
        { flow: 0.01, head: 50 },
        { flow: 0.02, head: 30 },
      ],
      /strictly decrease/,
    ],
    [
      'negative flow',
      [
        { flow: -0.01, head: 50 },
        { flow: 0.01, head: 45 },
        { flow: 0.02, head: 30 },
      ],
      /flow cannot be negative/,
    ],
    [
      'negative head',
      [
        { flow: 0, head: 50 },
        { flow: 0.01, head: 45 },
        { flow: 0.02, head: -1 },
      ],
      /head cannot be negative/,
    ],
    [
      'non-finite value',
      [
        { flow: 0, head: Number.NaN },
        { flow: 0.01, head: 45 },
        { flow: 0.02, head: 30 },
      ],
      /finite/,
    ],
    [
      'exponent above the accepted range',
      [
        { flow: 0, head: 50 },
        { flow: 0.01, head: 49.999999 },
        { flow: 0.02, head: 10 },
      ],
      /no curve/,
    ],
    [
      // With Q1 > 0 the head drop between the first two points is too large for any c > 0:
      // the ratio of head drops, 30/1, exceeds ln(Q2/Q1)/ln(Q3/Q2) = 1.
      'points with Q1 > 0 that no power curve fits',
      [
        { flow: 0.005, head: 50 },
        { flow: 0.01, head: 20 },
        { flow: 0.02, head: 19 },
      ],
      /no curve/,
    ],
  ])('rejects %s', (_name, points, message) => {
    expect(() => fitPumpCurve(points)).toThrow(message);
  });

  it('rejects a wrong number of points', () => {
    const two = [
      { flow: 0, head: 50 },
      { flow: 0.01, head: 45 },
    ] as unknown as Points;
    expect(() => fitPumpCurve(two)).toThrow(/three points/);
  });
});

describe('pump head', () => {
  const curve: PumpCurve = { a: 50, b: 50000, c: 2 };

  it('evaluates H = a − b·Q^c', () => {
    // 50 − 50 000 · 0.015² = 50 − 11.25 = 38.75
    expect(pumpHead(curve, 0.015)).toBeCloseTo(38.75, 12);
  });

  it('returns the shutoff head for zero and reverse flow', () => {
    expect(pumpHead(curve, 0)).toBe(50);
    expect(pumpHead(curve, -0.01)).toBe(50);
  });

  it('gradient is −b·c·Q^(c−1), never positive', () => {
    // −50 000 · 2 · 0.015 = −1500
    expect(pumpHeadGradient(curve, 0.015)).toBeCloseTo(-1500, 9);
    expect(pumpHeadGradient(curve, 0)).toBe(0);
    expect(pumpHeadGradient(curve, -0.01)).toBe(0);
  });

  it('gradient matches a finite difference', () => {
    const other: PumpCurve = { a: 42, b: 9000, c: 1.6 };
    for (const q of [0.001, 0.01, 0.03]) {
      const h = q * 1e-6;
      const numeric = (pumpHead(other, q + h) - pumpHead(other, q - h)) / (2 * h);
      expect(pumpHeadGradient(other, q) / numeric).toBeCloseTo(1, 7);
    }
  });

  it('runout flow is where the head reaches zero', () => {
    // (50 / 50 000)^(1/2) = 0.0316228
    expect(pumpRunoutFlow(curve)).toBeCloseTo(0.0316228, 7);
    expect(pumpHead(curve, pumpRunoutFlow(curve))).toBeCloseTo(0, 10);
  });
});

describe('pumpLinkLoss', () => {
  const curve: PumpCurve = { a: 50, b: 50000, c: 2 };

  it('is minus the pump head for forward flow, including beyond runout', () => {
    for (const q of [0.001, 0.015, 0.04]) {
      const loss = pumpLinkLoss(curve, q);
      expect(loss.headLoss).toBeCloseTo(-(curve.a - curve.b * q * q), 10);
      expect(loss.gradient).toBeCloseTo(-pumpHeadGradient(curve, q), 9);
    }
    expect(pumpLinkLoss(curve, 0.04).headLoss).toBeGreaterThan(0);
  });

  it('continues the curve as an odd function about the shutoff point for reverse flow', () => {
    // Head added at Q = −0.01: 50 + 50 000 · 0.01² = 55 m.
    const loss = pumpLinkLoss(curve, -0.01);
    expect(loss.headLoss).toBeCloseTo(-55, 10);
    expect(loss.gradient).toBeCloseTo(pumpLinkLoss(curve, 0.01).gradient, 12);
  });

  it('is increasing with a positive gradient everywhere', () => {
    let previous = -Infinity;
    for (let q = -0.03; q <= 0.03; q += 0.001) {
      const loss = pumpLinkLoss(curve, q);
      expect(loss.gradient).toBeGreaterThanOrEqual(MIN_HEAD_LOSS_GRADIENT);
      expect(loss.headLoss).toBeGreaterThan(previous);
      previous = loss.headLoss;
    }
  });

  it('stays finite at zero flow for a curve with c < 1', () => {
    const steep: PumpCurve = { a: 30, b: 200, c: 0.5 };
    const loss = pumpLinkLoss(steep, 0);
    expect(loss.headLoss).toBe(-30);
    expect(Number.isFinite(loss.gradient)).toBe(true);
    expect(loss.gradient).toBeGreaterThan(0);
  });

  it('uses a straight line through the shutoff point where the gradient bound applies', () => {
    expect(pumpLinkLoss(curve, 0)).toEqual({ headLoss: -50, gradient: MIN_HEAD_LOSS_GRADIENT });
    const loss = pumpLinkLoss(curve, 1e-10);
    expect(loss.gradient).toBe(MIN_HEAD_LOSS_GRADIENT);
    expect(loss.headLoss).toBe(-50 + MIN_HEAD_LOSS_GRADIENT * 1e-10);
  });
});
