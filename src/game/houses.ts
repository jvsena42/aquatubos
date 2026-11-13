import type { Scenario, ScenarioNode } from '../scenarios/types';
import type { StageEvaluation } from './types';

/**
 * Houses drawn (and counted) for a demand node. The number grows with the demand so busier
 * nodes look busier: 3 houses per L/s, at least 2 and at most 12. A node without demand has
 * no houses.
 */
export function houseCount(node: Pick<ScenarioNode, 'demandLps'>): number {
  if (node.demandLps <= 0) return 0;
  return Math.min(12, Math.max(2, Math.round(node.demandLps * 3)));
}

/**
 * Service at a node as the town shows it:
 * `unknown` before a result, `ok` when no pressure check fails there,
 * `low` when the dynamic pressure is below the minimum (dry taps),
 * `high` when the static pressure is above the maximum (burst risk).
 * It follows the check report, so checks that are off in a stage never mark a house.
 */
export type ServiceStatus = 'unknown' | 'ok' | 'low' | 'high';

export function serviceStatuses(
  scenario: Scenario,
  evaluation: StageEvaluation | null,
): Record<string, ServiceStatus> {
  const statuses: Record<string, ServiceStatus> = {};
  for (const node of scenario.nodes) statuses[node.id] = evaluation ? 'ok' : 'unknown';
  if (!evaluation) return statuses;
  for (const issue of evaluation.report.issues) {
    if (issue.elementType !== 'node' || !(issue.elementId in statuses)) continue;
    // Low pressure wins over high static pressure when a node has both.
    if (issue.check === 'minDynamicPressure') statuses[issue.elementId] = 'low';
    else if (issue.check === 'maxStaticPressure' && statuses[issue.elementId] !== 'low') {
      statuses[issue.elementId] = 'high';
    }
  }
  return statuses;
}

export interface HousesSummary {
  /** Houses at nodes whose service is `ok`. Zero before a result. */
  served: number;
  total: number;
  /** Node with houses and the lowest pressure margin among failing nodes, if any. */
  worstNodeId: string | null;
}

/** "Casas atendidas X / Y" for the stage HUD, and the node the map should pan to on failure. */
export function housesSummary(
  scenario: Scenario,
  evaluation: StageEvaluation | null,
): HousesSummary {
  const statuses = serviceStatuses(scenario, evaluation);
  let served = 0;
  let total = 0;
  let worstNodeId: string | null = null;
  let worstMargin = Infinity;
  for (const node of scenario.nodes) {
    const houses = houseCount(node);
    total += houses;
    const status = statuses[node.id];
    if (status === 'ok') served += houses;
    if (houses === 0 || !evaluation || status === 'ok' || status === 'unknown') continue;
    const issue = evaluation.report.issues.find(
      (i) =>
        i.elementId === node.id &&
        i.check === (status === 'low' ? 'minDynamicPressure' : 'maxStaticPressure'),
    );
    if (!issue) continue;
    // Negative margin = how far the value is on the wrong side of the limit.
    const margin = status === 'low' ? issue.value - issue.limit : issue.limit - issue.value;
    if (margin < worstMargin) {
      worstMargin = margin;
      worstNodeId = node.id;
    }
  }
  return { served, total, worstNodeId };
}
