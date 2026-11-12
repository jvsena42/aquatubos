import { COMMERCIAL_DNS } from '../engine/cost';
import type { Scenario } from './types';

/**
 * Structural validation of a scenario file. Returns a list of problems (empty when valid).
 * Hydraulic solvability is covered by the stage tests, not here.
 */
export function validateScenario(scenario: Scenario): string[] {
  const problems: string[] = [];
  const nodeIds = new Set<string>();
  for (const node of [...scenario.nodes, ...scenario.reservoirs]) {
    if (nodeIds.has(node.id)) problems.push(`duplicate node id ${node.id}`);
    nodeIds.add(node.id);
  }
  if (scenario.reservoirs.length === 0) problems.push('no reservoir');
  for (const node of scenario.nodes) {
    if (node.demandLps < 0) problems.push(`negative demand at ${node.id}`);
  }

  const linkIds = new Set<string>();
  const adjacency = new Set<string>();
  for (const link of [...scenario.pipes, ...scenario.pumps]) {
    if (linkIds.has(link.id)) problems.push(`duplicate link id ${link.id}`);
    linkIds.add(link.id);
    for (const end of [link.from, link.to]) {
      if (!nodeIds.has(end)) problems.push(`${link.id} references unknown node ${end}`);
    }
    adjacency.add(`${link.from}>${link.to}`);
    adjacency.add(`${link.to}>${link.from}`);
  }
  for (const pipe of scenario.pipes) {
    if (pipe.length <= 0) problems.push(`${pipe.id} has non-positive length`);
    if (!COMMERCIAL_DNS.includes(pipe.initialDN)) {
      problems.push(`${pipe.id} initial DN ${pipe.initialDN} is not in the catalog`);
    }
    const reference = scenario.reference.diameters[pipe.id];
    if (reference === undefined) problems.push(`${pipe.id} has no reference diameter`);
    else if (!COMMERCIAL_DNS.includes(reference)) {
      problems.push(`${pipe.id} reference DN ${reference} is not in the catalog`);
    } else if (pipe.fixed && reference !== pipe.initialDN) {
      problems.push(`${pipe.id} is fixed but its reference DN differs from the initial DN`);
    }
  }

  const pipeIds = new Set(scenario.pipes.map((p) => p.id));
  for (const loop of scenario.loops ?? []) {
    for (const entry of loop.pipes) {
      if (!pipeIds.has(entry.pipeId)) {
        problems.push(`loop ${loop.id} references unknown pipe ${entry.pipeId}`);
      }
    }
  }

  scenario.profilePath.forEach((id, index) => {
    if (!nodeIds.has(id)) problems.push(`profile path references unknown node ${id}`);
    const next = scenario.profilePath[index + 1];
    if (next !== undefined && !adjacency.has(`${id}>${next}`)) {
      problems.push(`profile path step ${id} → ${next} is not a link`);
    }
  });

  if (scenario.budget !== null && scenario.budget < scenario.reference.cost) {
    problems.push('budget is below the reference cost');
  }
  for (const text of [
    scenario.title,
    scenario.summary,
    ...scenario.briefing,
    ...scenario.objectives,
  ]) {
    if (!text.pt.trim() || !text.en.trim()) problems.push('missing pt or en text');
  }
  return problems;
}
