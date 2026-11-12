import { NBR_CHECK_LIMITS } from './config/nbr12218';
import type { CheckLimits, CheckReport, CheckSettings, Network, SolveResult } from './types';

export const DEFAULT_CHECK_SETTINGS: CheckSettings = {
  minDynamicPressure: 'error',
  maxStaticPressure: 'error',
  minVelocity: 'warning',
  maxVelocity: 'error',
  minDiameter: 'error',
};

/**
 * Static pressure head per junction, m: the no-flow condition. The static head of a junction is
 * the highest head among the reservoirs it is connected to; a pump on the way adds its shutoff
 * head in the from → to direction.
 */
export function staticPressures(_network: Network): Record<string, number> {
  throw new Error('not implemented');
}

/**
 * Compares a solved network against the design criteria. Each violation becomes one issue with
 * an explanation in pt and en that includes the computed value, the limit and a suggestion.
 * A non-converged result adds a `convergence` error.
 */
export function runChecks(
  _network: Network,
  _result: SolveResult,
  _settings: CheckSettings = DEFAULT_CHECK_SETTINGS,
  _limits: CheckLimits = NBR_CHECK_LIMITS,
): CheckReport {
  throw new Error('not implemented');
}
