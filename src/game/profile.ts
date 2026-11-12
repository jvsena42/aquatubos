import { pressureCheckedJunctions } from '../engine/checks';
import type { Scenario } from '../scenarios/types';
import type { StageEvaluation } from './types';

/** Same tolerance the checks use when comparing with a limit. */
const COMPARISON_TOLERANCE = 1e-6;

interface Link {
  kind: 'pipe' | 'pump';
  id: string;
  from: string;
  to: string;
  /** m. A pump has no length. */
  length: number;
}

function links(scenario: Scenario): Link[] {
  return [
    ...scenario.pipes.map((p): Link => ({
      kind: 'pipe',
      id: p.id,
      from: p.from,
      to: p.to,
      length: p.length,
    })),
    ...scenario.pumps.map((p): Link => ({
      kind: 'pump',
      id: p.id,
      from: p.from,
      to: p.to,
      length: 0,
    })),
  ];
}

/** Reservoir the profile starts from: the first node of `profilePath` or the first reservoir. */
export function profileSource(scenario: Scenario): string | undefined {
  const first = scenario.profilePath[0];
  if (first !== undefined && scenario.reservoirs.some((r) => r.id === first)) return first;
  return scenario.reservoirs[0]?.id;
}

/**
 * Path with the fewest links from the source reservoir to `endId`, as node ids, found by
 * breadth-first search over pipes and pumps in either direction. Null when `endId` cannot be
 * reached. Among paths with the same number of links, the one that uses the links listed
 * first in the scenario wins.
 */
export function findProfilePath(scenario: Scenario, endId: string): string[] | null {
  const source = profileSource(scenario);
  if (source === undefined) return null;
  if (endId === source) return [source];

  const neighbours = new Map<string, string[]>();
  const connect = (a: string, b: string) => {
    const list = neighbours.get(a);
    if (list) list.push(b);
    else neighbours.set(a, [b]);
  };
  for (const link of links(scenario)) {
    connect(link.from, link.to);
    connect(link.to, link.from);
  }

  const previous = new Map<string, string>();
  const visited = new Set([source]);
  const queue = [source];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]!;
    if (current === endId) break;
    for (const next of neighbours.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      previous.set(next, current);
      queue.push(next);
    }
  }
  if (!visited.has(endId)) return null;

  const path = [endId];
  for (let node = previous.get(endId); node !== undefined; node = previous.get(node)) {
    path.push(node);
  }
  return path.reverse();
}

/**
 * Path the profile shows for an end node: the scenario's own `profilePath` when it ends there,
 * otherwise the shortest path from the source.
 */
export function profilePathTo(scenario: Scenario, endId: string): string[] | null {
  const preset = scenario.profilePath;
  if (preset.length > 1 && preset[preset.length - 1] === endId) return [...preset];
  return findProfilePath(scenario, endId);
}

export interface ProfilePoint {
  id: string;
  kind: 'node' | 'reservoir';
  /** Accumulated pipe length from the start of the path, m. */
  distance: number;
  /** Ground elevation, m. */
  elevation: number;
  /** Hydraulic grade, m. */
  head: number;
  /** head − elevation, m. */
  pressure: number;
  /** Hydraulic grade with no consumption, m. Null when no reservoir reaches the node. */
  staticHead: number | null;
  /** elevation + minimum dynamic pressure, m. Null where the limit does not apply. */
  minHead: number | null;
  /** True when the pressure is below the minimum at a node where the limit applies. */
  belowMin: boolean;
}

export interface ProfileSegment {
  kind: 'pipe' | 'pump';
  id: string;
  from: string;
  to: string;
  /** m (0 for a pump). */
  length: number;
  /** Change of the hydraulic grade along the segment, m: negative in a pipe, positive in a pump. */
  headChange: number;
}

export interface ProfileData {
  points: ProfilePoint[];
  /** One per pair of consecutive points. */
  segments: ProfileSegment[];
  /** Length of the path, m. */
  totalLength: number;
  /** Minimum dynamic pressure used, m. */
  minPressure: number;
}

/**
 * Longitudinal profile along `path` (node ids). A pump has no length, so its two ends share
 * the same distance and the hydraulic grade jumps there. Returns null when the path is not a
 * chain of links of the scenario or a node has no result.
 */
export function buildProfile(
  scenario: Scenario,
  evaluation: StageEvaluation,
  path: readonly string[],
  minPressure: number,
): ProfileData | null {
  if (path.length === 0) return null;
  const all = links(scenario);
  const checked = new Set(pressureCheckedJunctions(evaluation.network).map((j) => j.id));

  const points: ProfilePoint[] = [];
  const segments: ProfileSegment[] = [];
  let distance = 0;

  for (let i = 0; i < path.length; i++) {
    const id = path[i]!;
    if (i > 0) {
      const before = path[i - 1]!;
      const link = all.find(
        (l) => (l.from === before && l.to === id) || (l.from === id && l.to === before),
      );
      if (!link) return null;
      distance += link.length;
      segments.push({
        kind: link.kind,
        id: link.id,
        from: before,
        to: id,
        length: link.length,
        headChange: 0,
      });
    }

    const result = evaluation.result.nodes[id];
    if (!result) return null;
    const reservoir = scenario.reservoirs.find((r) => r.id === id);
    if (reservoir) {
      points.push({
        id,
        kind: 'reservoir',
        distance,
        elevation: reservoir.elevation,
        head: result.head,
        pressure: result.head - reservoir.elevation,
        staticHead: result.head,
        minHead: null,
        belowMin: false,
      });
      continue;
    }
    const atRest = evaluation.report.staticPressure[id];
    const limited = checked.has(id);
    points.push({
      id,
      kind: 'node',
      distance,
      elevation: result.elevation,
      head: result.head,
      pressure: result.pressure,
      staticHead: atRest === undefined ? null : result.elevation + atRest,
      minHead: limited ? result.elevation + minPressure : null,
      belowMin: limited && result.pressure < minPressure - COMPARISON_TOLERANCE,
    });
  }

  segments.forEach((segment, index) => {
    segment.headChange = points[index + 1]!.head - points[index]!.head;
  });

  return { points, segments, totalLength: distance, minPressure };
}
