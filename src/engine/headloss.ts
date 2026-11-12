import type { HeadLossFormula, Pipe } from './types';

const notImplemented = (): never => {
  throw new Error('not implemented');
};

/** Exponent of Q in the Hazen-Williams formula. */
export const HAZEN_WILLIAMS_EXPONENT = 1.852;

/**
 * Hazen-Williams unit head loss J (m/m) for |flow|.
 * J = 10.643 · Q^1.852 / (C^1.852 · D^4.87), Q in m³/s, D in m, C = Hazen-Williams coefficient.
 */
export function hazenWilliamsUnitLoss(_flow: number, _c: number, _diameter: number): number {
  return notImplemented();
}

/** Hazen-Williams head loss over `length`, m, with the sign of `flow`. */
export function hazenWilliamsHeadLoss(
  _flow: number,
  _c: number,
  _diameter: number,
  _length: number,
): number {
  return notImplemented();
}

/** Re = |V|·D/ν. */
export function reynoldsNumber(
  _flow: number,
  _diameter: number,
  _kinematicViscosity: number,
): number {
  return notImplemented();
}

/** Swamee-Jain explicit approximation of the Darcy friction factor (turbulent flow). */
export function swameeJainFrictionFactor(_reynolds: number, _relativeRoughness: number): number {
  return notImplemented();
}

/**
 * Darcy friction factor. Laminar (Re < 2000): 64/Re. Turbulent (Re > 4000): Colebrook-White
 * solved iteratively from the Swamee-Jain guess. In between: interpolation, continuous in Re.
 */
export function colebrookFrictionFactor(_reynolds: number, _relativeRoughness: number): number {
  return notImplemented();
}

/** Darcy-Weisbach head loss hf = f·(L/D)·V²/(2g), m, with the sign of `flow`. */
export function darcyWeisbachHeadLoss(
  _flow: number,
  _diameter: number,
  _length: number,
  _roughness: number,
  _kinematicViscosity: number,
): number {
  return notImplemented();
}

export interface PipeLoss {
  /** Head loss from → to, m, with the sign of the flow. */
  headLoss: number;
  /** d(headLoss)/dQ, s/m², always > 0 (bounded below for Q → 0 so solvers can divide by it). */
  gradient: number;
  /** Exponent n in hL = K·Q^n used by Hardy Cross (1.852 for Hazen-Williams, 2 for Darcy). */
  exponent: number;
  /** Only for Darcy-Weisbach. */
  frictionFactor?: number;
  /** Only for Darcy-Weisbach. */
  reynolds?: number;
}

export interface PipeLossOptions {
  formula: HeadLossFormula;
  /** m²/s */
  kinematicViscosity: number;
}

/** Head loss and its derivative for a pipe at a given signed flow, using the selected formula. */
export function pipeLoss(_pipe: Pipe, _flow: number, _options: PipeLossOptions): PipeLoss {
  return notImplemented();
}
