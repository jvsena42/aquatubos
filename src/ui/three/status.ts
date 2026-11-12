import { pressureCheckedJunctions } from '../../engine/checks';
import { NBR_CHECK_LIMITS } from '../../engine/config/nbr12218';
import type { StageEvaluation } from '../../game/types';

/** `none`: no result for the element, or the limits do not apply to it. */
export type Status = 'low' | 'ok' | 'high' | 'none';

/**
 * Pressure status of a node: low when the dynamic pressure is under the minimum, high when the
 * static pressure is over the maximum.
 */
export function pressureStatus(evaluation: StageEvaluation | null, nodeId: string): Status {
  if (!evaluation) return 'none';
  const pressure = evaluation.result.nodes[nodeId]?.pressure;
  if (pressure === undefined) return 'none';
  if (!pressureCheckedJunctions(evaluation.network).some((j) => j.id === nodeId)) return 'none';
  if (pressure < NBR_CHECK_LIMITS.minDynamicPressure) return 'low';
  const atRest = evaluation.report.staticPressure[nodeId];
  if (atRest !== undefined && atRest > NBR_CHECK_LIMITS.maxStaticPressure) return 'high';
  return 'ok';
}

/** Velocity status of a pipe, compared in absolute value. */
export function velocityStatus(evaluation: StageEvaluation | null, pipeId: string): Status {
  const velocity = evaluation?.result.pipes[pipeId]?.velocity;
  if (velocity === undefined) return 'none';
  const speed = Math.abs(velocity);
  if (speed < NBR_CHECK_LIMITS.minVelocity) return 'low';
  if (speed > NBR_CHECK_LIMITS.maxVelocity) return 'high';
  return 'ok';
}

/** The node with the lowest dynamic pressure among those where the pressure limits apply. */
export function criticalNode(
  evaluation: StageEvaluation | null,
): { id: string; pressure: number } | null {
  if (!evaluation) return null;
  let critical: { id: string; pressure: number } | null = null;
  for (const junction of pressureCheckedJunctions(evaluation.network)) {
    const pressure = evaluation.result.nodes[junction.id]?.pressure;
    if (pressure === undefined || !Number.isFinite(pressure)) continue;
    if (!critical || pressure < critical.pressure) critical = { id: junction.id, pressure };
  }
  return critical;
}
