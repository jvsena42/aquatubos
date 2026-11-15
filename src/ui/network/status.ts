import { pressureCheckedJunctions } from '../../engine/checks';
import { NBR_CHECK_LIMITS } from '../../engine/config/nbr12218';
import type { CheckLimits, CheckSettings } from '../../engine/types';
import type { StageEvaluation } from '../../game/types';

/** `none`: not evaluated, or the element is not checked in this stage. */
export type LimitStatus = 'none' | 'ok' | 'low' | 'high';

/** Same slack as the engine checks, so a value that sits on the limit passes. */
const TOLERANCE = 1e-9;

/** True when the speed (m/s, absolute value) is below the minimum velocity. */
export function isBelowMinVelocity(speed: number, limits: CheckLimits = NBR_CHECK_LIMITS) {
  return speed < limits.minVelocity - TOLERANCE;
}

/** True when the unit head loss (m/m) is above the maximum. */
export function isAboveMaxUnitHeadLoss(unitLoss: number, limits: CheckLimits = NBR_CHECK_LIMITS) {
  return unitLoss > limits.maxUnitHeadLoss + TOLERANCE;
}

export function isBelowMinPressure(pressure: number, limits: CheckLimits = NBR_CHECK_LIMITS) {
  return pressure < limits.minDynamicPressure - TOLERANCE;
}

export function isAboveMaxStatic(pressure: number, limits: CheckLimits = NBR_CHECK_LIMITS) {
  return pressure > limits.maxStaticPressure + TOLERANCE;
}

export interface NodeStatus {
  status: LimitStatus;
  /** Dynamic pressure below the minimum (and the check is active in the stage). */
  low: boolean;
  /** Static pressure above the maximum (and the check is active in the stage). */
  high: boolean;
}

const UNCHECKED: NodeStatus = { status: 'none', low: false, high: false };

/**
 * Pressure status of every junction of an evaluation, following the checks that are active in
 * the stage. Pump discharge nodes without demand are not checked and stay `none`.
 */
export function nodeStatuses(
  evaluation: StageEvaluation | null,
  settings: CheckSettings,
): Record<string, NodeStatus> {
  const statuses: Record<string, NodeStatus> = {};
  if (!evaluation) return statuses;
  const checkMin = settings.minDynamicPressure !== 'off';
  const checkMax = settings.maxStaticPressure !== 'off';
  const checked = new Set(pressureCheckedJunctions(evaluation.network).map((j) => j.id));
  for (const junction of evaluation.network.junctions) {
    const pressure = evaluation.result.nodes[junction.id]?.pressure;
    if (!checked.has(junction.id) || pressure === undefined || (!checkMin && !checkMax)) {
      statuses[junction.id] = UNCHECKED;
      continue;
    }
    const atRest = evaluation.report.staticPressure[junction.id];
    const low = checkMin && isBelowMinPressure(pressure);
    const high = checkMax && atRest !== undefined && isAboveMaxStatic(atRest);
    statuses[junction.id] = { status: low ? 'low' : high ? 'high' : 'ok', low, high };
  }
  return statuses;
}

/**
 * Status of every pipe of an evaluation, following the checks active in the stage: `high` when
 * the unit head loss is above the maximum, `low` when the velocity is below the minimum.
 */
export function pipeStatuses(
  evaluation: StageEvaluation | null,
  settings: CheckSettings,
): Record<string, LimitStatus> {
  const statuses: Record<string, LimitStatus> = {};
  if (!evaluation) return statuses;
  const checkMin = settings.minVelocity !== 'off';
  const checkLoss = settings.maxUnitHeadLoss !== 'off';
  for (const pipe of evaluation.network.pipes) {
    const result = evaluation.result.pipes[pipe.id];
    if (result === undefined || (!checkMin && !checkLoss)) {
      statuses[pipe.id] = 'none';
      continue;
    }
    if (checkLoss && isAboveMaxUnitHeadLoss(result.unitHeadLoss)) statuses[pipe.id] = 'high';
    else if (checkMin && isBelowMinVelocity(Math.abs(result.velocity))) statuses[pipe.id] = 'low';
    else statuses[pipe.id] = 'ok';
  }
  return statuses;
}
