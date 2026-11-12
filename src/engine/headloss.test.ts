import {
  colebrookFrictionFactor,
  darcyWeisbachHeadLoss,
  hazenWilliamsHeadLoss,
  hazenWilliamsUnitLoss,
  HAZEN_WILLIAMS_EXPONENT,
  MIN_HEAD_LOSS_GRADIENT,
  pipeLoss,
  reynoldsNumber,
  swameeJainFrictionFactor,
} from './headloss';
import type { Pipe } from './types';

const pipe: Pipe = {
  id: 'p',
  from: 'a',
  to: 'b',
  length: 100,
  diameter: 0.1,
  hazenWilliamsC: 140,
  roughness: 0.0001,
};

const NU = 1e-6;
const HW = { formula: 'hazen-williams', kinematicViscosity: NU } as const;
const DW = { formula: 'darcy-weisbach', kinematicViscosity: NU } as const;

describe('Hazen-Williams', () => {
  // Q = 0.010 m³/s (10 L/s), C = 140, D = 0.100 m, L = 100 m.
  //   Q^1.852 = exp(1.852 · ln 0.01)  = exp(−8.52874) = 1.97697e−4
  //   C^1.852 = exp(1.852 · ln 140)   = exp(9.15192)  = 9432.55
  //   D^4.87  = 10^−4.87                               = 1.34896e−5
  //   J = 10.643 · 1.97697e−4 / (9432.55 · 1.34896e−5)
  //     = 2.104090e−3 / 0.1272415 = 0.0165362 m/m
  //   hL = J · L = 1.65362 m
  it('matches the hand-computed unit loss', () => {
    expect(hazenWilliamsUnitLoss(0.01, 140, 0.1)).toBeCloseTo(0.0165362, 6);
  });

  it('matches the hand-computed head loss', () => {
    expect(hazenWilliamsHeadLoss(0.01, 140, 0.1, 100)).toBeCloseTo(1.65362, 4);
  });

  it('uses C as a coefficient: a smoother pipe (higher C) loses less head', () => {
    // J is proportional to C^−1.852, so C = 70 gives 2^1.852 = 3.6100 times the loss of C = 140.
    const ratio = hazenWilliamsUnitLoss(0.01, 70, 0.1) / hazenWilliamsUnitLoss(0.01, 140, 0.1);
    expect(ratio).toBeCloseTo(Math.pow(2, 1.852), 10);
    expect(ratio).toBeCloseTo(3.61, 3);
  });

  it('unit loss ignores the sign of the flow and head loss keeps it', () => {
    expect(hazenWilliamsUnitLoss(-0.01, 140, 0.1)).toBe(hazenWilliamsUnitLoss(0.01, 140, 0.1));
    expect(hazenWilliamsHeadLoss(-0.01, 140, 0.1, 100)).toBe(
      -hazenWilliamsHeadLoss(0.01, 140, 0.1, 100),
    );
    expect(hazenWilliamsHeadLoss(0, 140, 0.1, 100)).toBe(0);
  });

  it('scales with Q^1.852 and D^−4.87', () => {
    const base = hazenWilliamsUnitLoss(0.01, 140, 0.1);
    expect(hazenWilliamsUnitLoss(0.02, 140, 0.1) / base).toBeCloseTo(Math.pow(2, 1.852), 10);
    expect(hazenWilliamsUnitLoss(0.01, 140, 0.2) / base).toBeCloseTo(Math.pow(2, -4.87), 10);
  });
});

describe('Reynolds number and friction factor', () => {
  // Q = 0.010 m³/s, D = 0.100 m, ν = 1e−6 m²/s.
  //   A = π · 0.1² / 4 = 7.85398e−3 m²,  V = 0.01 / 7.85398e−3 = 1.27324 m/s
  //   Re = 1.27324 · 0.1 / 1e−6 = 127 324
  it('computes Re = V·D/ν', () => {
    expect(reynoldsNumber(0.01, 0.1, NU)).toBeCloseTo(127324, 0);
    expect(reynoldsNumber(-0.01, 0.1, NU)).toBeCloseTo(127324, 0);
    expect(reynoldsNumber(0, 0.1, NU)).toBe(0);
  });

  // Swamee-Jain, Re = 1e5, ε/D = 0.001:
  //   ε/(3.7·D) = 2.70270e−4,  5.74 / Re^0.9 = 5.74 / 31 622.8 = 1.81515e−4
  //   log10(4.51785e−4) = −3.34507
  //   f = 0.25 / 3.34507² = 0.25 / 11.1895 = 0.022342
  it('Swamee-Jain matches the hand-computed value', () => {
    expect(swameeJainFrictionFactor(1e5, 0.001)).toBeCloseTo(0.022342, 6);
  });

  it('is 64/Re in laminar flow', () => {
    expect(colebrookFrictionFactor(1000, 0.001)).toBeCloseTo(0.064, 12);
    expect(colebrookFrictionFactor(1999.999, 0)).toBeCloseTo(0.032, 6);
  });

  it('returns 0 when there is no flow', () => {
    expect(colebrookFrictionFactor(0, 0.001)).toBe(0);
  });

  // Reference values of the Colebrook-White equation (the ones a Moody chart is drawn from):
  //   Re = 1e5, ε/D = 0.001  → f = 0.02217
  //   Re = 1e6, ε/D = 0.0001 → f = 0.01344
  //   Re = 1e5, smooth pipe  → f = 0.01799
  // Check of the first one by substitution, with f = 0.022175, 1/√f = 6.7154:
  //   2.51 / (Re·√f) = 2.51 · 6.7154 / 1e5 = 1.68557e−4
  //   −2·log10(2.70270e−4 + 1.68557e−4) = −2 · (−3.35770) = 6.7154
  it.each([
    [1e5, 0.001, 0.022175],
    [1e6, 0.0001, 0.013441],
    [1e5, 0, 0.01799],
    [4000.0001, 0, 0.039907],
  ])('Colebrook-White at Re = %d, ε/D = %d', (re, rr, expected) => {
    expect(colebrookFrictionFactor(re, rr)).toBeCloseTo(expected, 5);
  });

  it('satisfies the Colebrook-White equation to machine precision', () => {
    for (const re of [4001, 1e4, 1e5, 1e6, 1e8]) {
      for (const rr of [0, 1e-6, 1e-4, 1e-2, 0.05]) {
        const f = colebrookFrictionFactor(re, rr);
        const rhs = -2 * Math.log10(rr / 3.7 + 2.51 / (re * Math.sqrt(f)));
        expect(1 / Math.sqrt(f)).toBeCloseTo(rhs, 10);
      }
    }
  });

  it('stays within 3 % of the Swamee-Jain approximation in its range of validity', () => {
    for (const re of [5e3, 1e5, 1e7]) {
      for (const rr of [1e-6, 1e-4, 1e-2]) {
        const exact = colebrookFrictionFactor(re, rr);
        expect(Math.abs(swameeJainFrictionFactor(re, rr) / exact - 1)).toBeLessThan(0.03);
      }
    }
  });

  it('is continuous across the transition range', () => {
    const rr = 0.001;
    expect(colebrookFrictionFactor(2000, rr)).toBeCloseTo(0.032, 12);
    expect(colebrookFrictionFactor(2000 - 1e-6, rr)).toBeCloseTo(0.032, 8);
    expect(colebrookFrictionFactor(4000, rr)).toBeCloseTo(
      colebrookFrictionFactor(4000 + 1e-6, rr),
      8,
    );
    // Midpoint of the linear interpolation between 0.032 and f(4000) = 0.040910.
    expect(colebrookFrictionFactor(3000, rr)).toBeCloseTo((0.032 + 0.04091) / 2, 5);
  });
});

describe('Darcy-Weisbach', () => {
  // Q = 0.010 m³/s, D = 0.100 m, L = 100 m, ε = 0.1 mm (ε/D = 0.001), ν = 1e−6 m²/s.
  //   V = 1.27324 m/s, Re = 127 324, Colebrook f = 0.021709
  //   V²/(2g) = 1.62114 / 19.6133 = 0.0826551 m
  //   hf = f · (L/D) · V²/(2g) = 0.021709 · 1000 · 0.0826551 = 1.7943 m
  it('matches the hand-computed head loss', () => {
    expect(darcyWeisbachHeadLoss(0.01, 0.1, 100, 0.0001, NU)).toBeCloseTo(1.7943, 4);
  });

  it('keeps the sign of the flow', () => {
    expect(darcyWeisbachHeadLoss(-0.01, 0.1, 100, 0.0001, NU)).toBeCloseTo(-1.7943, 4);
    expect(darcyWeisbachHeadLoss(0, 0.1, 100, 0.0001, NU)).toBe(0);
  });

  // Laminar flow obeys Hagen-Poiseuille: hf = 128·ν·L·Q / (π·g·D⁴).
  //   Q = 1e−4 m³/s → V = 0.0127324 m/s, Re = 1273
  //   hf = 128 · 1e−6 · 100 · 1e−4 / (π · 9.80665 · 1e−4) = 1.28e−6 / 3.08085e−3 = 4.1547e−4 m
  it('reduces to Hagen-Poiseuille in laminar flow', () => {
    expect(darcyWeisbachHeadLoss(1e-4, 0.1, 100, 0.0001, NU)).toBeCloseTo(4.1547e-4, 8);
  });
});

describe('pipeLoss', () => {
  const flows = [-0.02, -0.003, 1e-5, 0.0002, 0.00025, 0.004, 0.05];

  it('agrees with the Hazen-Williams formula and reports the exponent', () => {
    const loss = pipeLoss(pipe, 0.01, HW);
    expect(loss.headLoss).toBeCloseTo(1.65362, 4);
    expect(loss.exponent).toBe(HAZEN_WILLIAMS_EXPONENT);
    expect(loss.frictionFactor).toBeUndefined();
    expect(loss.reynolds).toBeUndefined();
    // For hL = K·Q^n the gradient is n·hL/Q = 1.852 · 1.65362 / 0.01 = 306.25 s/m².
    expect(loss.gradient).toBeCloseTo(306.25, 1);
  });

  it('agrees with the Darcy-Weisbach formula and reports f and Re', () => {
    const loss = pipeLoss(pipe, -0.01, DW);
    expect(loss.headLoss).toBeCloseTo(-1.7943, 4);
    expect(loss.exponent).toBe(2);
    expect(loss.frictionFactor).toBeCloseTo(0.021709, 5);
    expect(loss.reynolds).toBeCloseTo(127324, 0);
  });

  it.each([
    ['hazen-williams', HW],
    ['darcy-weisbach', DW],
  ] as const)('%s: head loss is odd in the flow and matches the plain formula', (_name, opt) => {
    for (const q of flows) {
      const plus = pipeLoss(pipe, Math.abs(q), opt);
      const minus = pipeLoss(pipe, -Math.abs(q), opt);
      expect(minus.headLoss).toBeCloseTo(-plus.headLoss, 14);
      expect(minus.gradient).toBeCloseTo(plus.gradient, 12);
      const formula =
        opt.formula === 'hazen-williams'
          ? hazenWilliamsHeadLoss(q, pipe.hazenWilliamsC, pipe.diameter, pipe.length)
          : darcyWeisbachHeadLoss(q, pipe.diameter, pipe.length, pipe.roughness, NU);
      expect(pipeLoss(pipe, q, opt).headLoss).toBeCloseTo(formula, 12);
    }
  });

  // The flows cover laminar (Re 127), transition (Re 2546 and 3183) and turbulent regimes.
  it.each([
    ['hazen-williams', HW],
    ['darcy-weisbach', DW],
  ] as const)('%s: gradient matches a central finite difference', (_name, opt) => {
    for (const q of flows) {
      const h = Math.abs(q) * 1e-6;
      const numeric =
        (pipeLoss(pipe, q + h, opt).headLoss - pipeLoss(pipe, q - h, opt).headLoss) / (2 * h);
      const { gradient } = pipeLoss(pipe, q, opt);
      expect(gradient).toBeGreaterThan(0);
      expect(Math.abs(gradient / numeric - 1)).toBeLessThan(1e-6);
    }
  });

  it.each([
    ['hazen-williams', HW],
    ['darcy-weisbach', DW],
  ] as const)('%s: zero flow gives zero loss and a positive finite gradient', (_name, opt) => {
    const loss = pipeLoss(pipe, 0, opt);
    expect(loss.headLoss).toBe(0);
    expect(loss.gradient).toBeGreaterThanOrEqual(MIN_HEAD_LOSS_GRADIENT);
    expect(Number.isFinite(loss.gradient)).toBe(true);
    expect(JSON.parse(JSON.stringify(loss))).toEqual(loss);
  });

  it('reports f = 0 and Re = 0 for Darcy-Weisbach at zero flow', () => {
    const loss = pipeLoss(pipe, 0, DW);
    expect(loss.frictionFactor).toBe(0);
    expect(loss.reynolds).toBe(0);
  });

  it('Hazen-Williams: uses the linear law below the gradient bound', () => {
    const q = 1e-12;
    const loss = pipeLoss(pipe, -q, HW);
    expect(loss.gradient).toBe(MIN_HEAD_LOSS_GRADIENT);
    expect(loss.headLoss).toBe(-MIN_HEAD_LOSS_GRADIENT * q);
  });

  it('Darcy-Weisbach: uses the linear law below the gradient bound', () => {
    // A short, very wide pipe: the laminar gradient 128·ν·L/(π·g·D⁴) = 4.2e−6 is below the bound.
    const wide: Pipe = { ...pipe, length: 1, diameter: 1 };
    const loss = pipeLoss(wide, 1e-6, DW);
    expect(loss.gradient).toBe(MIN_HEAD_LOSS_GRADIENT);
    expect(loss.headLoss).toBe(MIN_HEAD_LOSS_GRADIENT * 1e-6);
  });

  it('is monotonically increasing in the flow for both formulas', () => {
    for (const opt of [HW, DW]) {
      let previous = -Infinity;
      for (let q = -0.02; q <= 0.02; q += 0.0005) {
        const { headLoss } = pipeLoss(pipe, q, opt);
        expect(headLoss).toBeGreaterThan(previous);
        previous = headLoss;
      }
    }
  });
});
