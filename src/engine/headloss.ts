import type { HeadLossFormula, Pipe } from './types';
import { GRAVITY, pipeArea } from './units';

/** Exponent of Q in the Hazen-Williams formula. */
export const HAZEN_WILLIAMS_EXPONENT = 1.852;

/** Numerical constant of the Hazen-Williams formula in SI units (Q in m³/s, D in m). */
export const HAZEN_WILLIAMS_CONSTANT = 10.643;

/** Exponent of D in the Hazen-Williams formula. */
export const HAZEN_WILLIAMS_DIAMETER_EXPONENT = 4.87;

/** Flow is laminar below this Reynolds number. */
export const LAMINAR_REYNOLDS = 2000;

/** Flow is fully turbulent above this Reynolds number. */
export const TURBULENT_REYNOLDS = 4000;

/**
 * Lower bound of d(headLoss)/dQ returned by `pipeLoss`, s/m².
 *
 * The Hazen-Williams gradient tends to zero with the flow, and the Global Gradient Algorithm
 * divides by it. Below this bound the head loss is replaced by the straight line
 * hL = MIN_HEAD_LOSS_GRADIENT · Q, so that the loss and its derivative stay consistent (the same
 * device EPANET uses). A typical 100 mm pipe 100 m long only falls in this range below about
 * 3·10⁻¹⁰ m³/s, and the head loss there is below 10⁻¹³ m.
 */
export const MIN_HEAD_LOSS_GRADIENT = 1e-4;

/** Resistance K of hL = K·Q^1.852 for the Hazen-Williams formula, s^1.852/m^4.556. */
function hazenWilliamsResistance(c: number, diameter: number, length: number): number {
  return (
    (HAZEN_WILLIAMS_CONSTANT * length) /
    (Math.pow(c, HAZEN_WILLIAMS_EXPONENT) * Math.pow(diameter, HAZEN_WILLIAMS_DIAMETER_EXPONENT))
  );
}

/**
 * Hazen-Williams unit head loss J (m/m) for |flow|.
 * J = 10.643 · Q^1.852 / (C^1.852 · D^4.87), Q in m³/s, D in m, C = Hazen-Williams coefficient.
 */
export function hazenWilliamsUnitLoss(flow: number, c: number, diameter: number): number {
  return (
    hazenWilliamsResistance(c, diameter, 1) * Math.pow(Math.abs(flow), HAZEN_WILLIAMS_EXPONENT)
  );
}

/** Hazen-Williams head loss over `length`, m, with the sign of `flow`. */
export function hazenWilliamsHeadLoss(
  flow: number,
  c: number,
  diameter: number,
  length: number,
): number {
  return Math.sign(flow) * hazenWilliamsUnitLoss(flow, c, diameter) * length;
}

/** Re = |V|·D/ν. */
export function reynoldsNumber(flow: number, diameter: number, kinematicViscosity: number): number {
  return ((Math.abs(flow) / pipeArea(diameter)) * diameter) / kinematicViscosity;
}

/** Swamee-Jain explicit approximation of the Darcy friction factor (turbulent flow). */
export function swameeJainFrictionFactor(reynolds: number, relativeRoughness: number): number {
  const log = Math.log10(relativeRoughness / 3.7 + 5.74 / Math.pow(reynolds, 0.9));
  return 0.25 / (log * log);
}

const COLEBROOK_MAX_ITERATIONS = 50;
const COLEBROOK_TOLERANCE = 1e-13;

/**
 * Colebrook-White friction factor and its derivative with respect to Re.
 *
 * With x = 1/√f the equation is g(x) = x + 2·log10(ε/(3.7·D) + 2.51·x/Re) = 0, solved by Newton's
 * method from the Swamee-Jain value. g is increasing and concave, so the iteration converges in
 * a handful of steps for any Re and roughness.
 */
function colebrookTurbulent(
  reynolds: number,
  relativeRoughness: number,
): { f: number; dfdRe: number } {
  const a = relativeRoughness / 3.7;
  const b = 2.51 / reynolds;
  const twoOverLn10 = 2 / Math.LN10;
  let x = 1 / Math.sqrt(swameeJainFrictionFactor(reynolds, relativeRoughness));
  for (let i = 0; i < COLEBROOK_MAX_ITERATIONS; i++) {
    const inner = a + b * x;
    const g = x + 2 * Math.log10(inner);
    const dg = 1 + (twoOverLn10 * b) / inner;
    const step = g / dg;
    x -= step;
    if (Math.abs(step) <= COLEBROOK_TOLERANCE * x) break;
  }
  const f = 1 / (x * x);
  // Implicit differentiation of g(x, Re) = 0: dx/dRe = k·x / (Re·(1 + k)), and f = x⁻².
  const k = (twoOverLn10 * b) / (a + b * x);
  const dfdRe = (-2 * f * k) / (reynolds * (1 + k));
  return { f, dfdRe };
}

/** Friction factor and df/dRe over the whole range of Re > 0. */
function frictionFactorWithSlope(
  reynolds: number,
  relativeRoughness: number,
): { f: number; dfdRe: number } {
  if (reynolds < LAMINAR_REYNOLDS) {
    const f = 64 / reynolds;
    return { f, dfdRe: -f / reynolds };
  }
  if (reynolds > TURBULENT_REYNOLDS) return colebrookTurbulent(reynolds, relativeRoughness);
  const laminar = 64 / LAMINAR_REYNOLDS;
  const turbulent = colebrookTurbulent(TURBULENT_REYNOLDS, relativeRoughness).f;
  const slope = (turbulent - laminar) / (TURBULENT_REYNOLDS - LAMINAR_REYNOLDS);
  return { f: laminar + slope * (reynolds - LAMINAR_REYNOLDS), dfdRe: slope };
}

/**
 * Darcy friction factor. Laminar (Re < 2000): 64/Re. Turbulent (Re > 4000): Colebrook-White
 * solved iteratively from the Swamee-Jain guess. In between: interpolation, continuous in Re.
 *
 * The interpolation is linear in Re between f(2000) = 0.032 and the Colebrook value at Re = 4000.
 * Returns 0 for Re <= 0: with no flow the friction factor is undefined and there is no loss.
 */
export function colebrookFrictionFactor(reynolds: number, relativeRoughness: number): number {
  if (!(reynolds > 0)) return 0;
  return frictionFactorWithSlope(reynolds, relativeRoughness).f;
}

/** Darcy-Weisbach head loss hf = f·(L/D)·V²/(2g), m, with the sign of `flow`. */
export function darcyWeisbachHeadLoss(
  flow: number,
  diameter: number,
  length: number,
  roughness: number,
  kinematicViscosity: number,
): number {
  const reynolds = reynoldsNumber(flow, diameter, kinematicViscosity);
  const f = colebrookFrictionFactor(reynolds, roughness / diameter);
  const v = flow / pipeArea(diameter);
  return (Math.sign(flow) * f * (length / diameter) * v * v) / (2 * GRAVITY);
}

export interface PipeLoss {
  /** Head loss from → to, m, with the sign of the flow. */
  headLoss: number;
  /** d(headLoss)/dQ, s/m², always > 0 (bounded below for Q → 0 so solvers can divide by it). */
  gradient: number;
  /** Exponent n in hL = K·Q^n used by Hardy Cross (1.852 for Hazen-Williams, 2 for Darcy). */
  exponent: number;
  /** Only for Darcy-Weisbach. 0 when there is no flow. */
  frictionFactor?: number;
  /** Only for Darcy-Weisbach. */
  reynolds?: number;
}

export interface PipeLossOptions {
  formula: HeadLossFormula;
  /** m²/s */
  kinematicViscosity: number;
}

function hazenWilliamsPipeLoss(pipe: Pipe, flow: number): PipeLoss {
  const n = HAZEN_WILLIAMS_EXPONENT;
  const k = hazenWilliamsResistance(pipe.hazenWilliamsC, pipe.diameter, pipe.length);
  const gradient = n * k * Math.pow(Math.abs(flow), n - 1);
  if (gradient < MIN_HEAD_LOSS_GRADIENT) {
    return {
      headLoss: MIN_HEAD_LOSS_GRADIENT * flow,
      gradient: MIN_HEAD_LOSS_GRADIENT,
      exponent: n,
    };
  }
  return { headLoss: (gradient * flow) / n, gradient, exponent: n };
}

function darcyWeisbachPipeLoss(pipe: Pipe, flow: number, kinematicViscosity: number): PipeLoss {
  const { diameter, length } = pipe;
  const q = Math.abs(flow);
  const reynolds = reynoldsNumber(flow, diameter, kinematicViscosity);
  let headLoss: number;
  let gradient: number;
  let frictionFactor: number;
  if (reynolds < LAMINAR_REYNOLDS) {
    // Hagen-Poiseuille: with f = 64/Re the loss is linear in Q, hL = 128·ν·L·Q / (π·g·D⁴).
    // Written this way there is no division by the flow.
    gradient = (128 * kinematicViscosity * length) / (Math.PI * GRAVITY * Math.pow(diameter, 4));
    headLoss = gradient * flow;
    frictionFactor = reynolds > 0 ? 64 / reynolds : 0;
  } else {
    // hL = K·f·Q·|Q| with K = 8·L / (π²·g·D⁵). Since Re is proportional to |Q|,
    // dhL/dQ = K·|Q|·(2·f + Re·df/dRe).
    const k = (8 * length) / (Math.PI * Math.PI * GRAVITY * Math.pow(diameter, 5));
    const { f, dfdRe } = frictionFactorWithSlope(reynolds, pipe.roughness / diameter);
    frictionFactor = f;
    headLoss = k * f * flow * q;
    gradient = k * q * (2 * f + reynolds * dfdRe);
  }
  if (gradient < MIN_HEAD_LOSS_GRADIENT) {
    gradient = MIN_HEAD_LOSS_GRADIENT;
    headLoss = gradient * flow;
  }
  return { headLoss, gradient, exponent: 2, frictionFactor, reynolds };
}

/**
 * Head loss and its derivative for a pipe at a given signed flow, using the selected formula.
 *
 * Where the true derivative would fall below `MIN_HEAD_LOSS_GRADIENT` (flows that are zero for
 * every practical purpose) the loss is the line MIN_HEAD_LOSS_GRADIENT · Q, so `headLoss` can
 * differ from `hazenWilliamsHeadLoss` there by less than MIN_HEAD_LOSS_GRADIENT · |Q|.
 */
export function pipeLoss(pipe: Pipe, flow: number, options: PipeLossOptions): PipeLoss {
  return options.formula === 'darcy-weisbach'
    ? darcyWeisbachPipeLoss(pipe, flow, options.kinematicViscosity)
    : hazenWilliamsPipeLoss(pipe, flow);
}
