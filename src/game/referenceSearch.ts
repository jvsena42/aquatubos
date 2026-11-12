import { runChecks } from '../engine/checks';
import { COMMERCIAL_DNS, pipeCost } from '../engine/cost';
import { solveNetwork } from '../engine/solver';
import type { Diameters, Scenario } from '../scenarios/types';
import { buildNetwork } from './buildNetwork';
import { designCost } from './evaluate';

export interface ReferenceDesign {
  diameters: Diameters;
  cost: number;
  method: 'exhaustive' | 'branch-and-bound' | 'greedy+pairs';
  /** Number of designs that were solved. */
  evaluated: number;
}

/** True when the design passes every check with severity `error` (budget is not considered). */
export function designPasses(scenario: Scenario, diameters: Diameters): boolean {
  const network = buildNetwork(scenario, diameters);
  const result = solveNetwork(network, { formula: scenario.formula });
  return runChecks(network, result, scenario.checks).passed;
}

/** Above this number of combinations the plain exhaustive search is not used. */
export const EXHAUSTIVE_LIMIT = 150_000;

/** Maximum number of designs the branch-and-bound step may solve before giving up. */
export const BRANCH_AND_BOUND_LIMIT = 20_000_000;

/**
 * Finds a low-cost design that passes the checks, used to produce the reference solution stored
 * in each scenario file.
 *
 * Small stages are searched exhaustively. Larger ones first get an upper bound from a heuristic
 * (start with the largest diameter everywhere, repeatedly shrink the pipe that saves the most
 * money while the design still passes, then try pair moves) and are then searched by branch
 * and bound with cost pruning. Both give the cheapest passing design. Only when branch and
 * bound exceeds its limit is the heuristic result returned, and it is labelled as such.
 *
 * Returns null when even the largest diameters fail.
 */
export function findReferenceDesign(
  scenario: Scenario,
  dns: readonly number[] = COMMERCIAL_DNS,
  limits: { exhaustive?: number; branchAndBound?: number } = {},
): ReferenceDesign | null {
  const exhaustiveLimit = limits.exhaustive ?? EXHAUSTIVE_LIMIT;
  const branchAndBoundLimit = limits.branchAndBound ?? BRANCH_AND_BOUND_LIMIT;
  const free = scenario.pipes.filter((p) => !p.fixed);
  const base: Diameters = Object.fromEntries(scenario.pipes.map((p) => [p.id, p.initialDN]));
  const largest = dns[dns.length - 1];
  if (largest === undefined) return null;
  let evaluated = 0;
  const passes = (d: Diameters): boolean => {
    evaluated++;
    return designPasses(scenario, d);
  };

  const start: Diameters = { ...base };
  for (const p of free) start[p.id] = largest;
  if (!passes(start)) return null;

  const combinations = Math.pow(dns.length, free.length);
  if (combinations <= exhaustiveLimit) {
    let best = start;
    let bestCost = designCost(scenario, start);
    const current: Diameters = { ...base };
    const visit = (index: number): void => {
      const pipe = free[index];
      if (!pipe) {
        const cost = designCost(scenario, current);
        if (cost < bestCost && passes(current)) {
          best = { ...current };
          bestCost = cost;
        }
        return;
      }
      for (const dn of dns) {
        current[pipe.id] = dn;
        visit(index + 1);
      }
    };
    visit(0);
    return { diameters: best, cost: bestCost, method: 'exhaustive', evaluated };
  }

  const step = (dn: number, delta: number): number | undefined => dns[dns.indexOf(dn) + delta];
  let design = start;
  let cost = designCost(scenario, design);

  // Greedy descent.
  for (;;) {
    let bestMove: Diameters | null = null;
    let bestMoveCost = cost;
    for (const p of free) {
      const smaller = step(design[p.id] ?? largest, -1);
      if (smaller === undefined) continue;
      const candidate = { ...design, [p.id]: smaller };
      const candidateCost = designCost(scenario, candidate);
      if (candidateCost < bestMoveCost && passes(candidate)) {
        bestMove = candidate;
        bestMoveCost = candidateCost;
      }
    }
    if (!bestMove) break;
    design = bestMove;
    cost = bestMoveCost;
  }

  // Pair moves.
  for (let improved = true; improved;) {
    improved = false;
    for (const up of free) {
      const larger = step(design[up.id] ?? largest, 1);
      if (larger === undefined) continue;
      for (const down of free) {
        if (down.id === up.id) continue;
        for (const delta of [-1, -2]) {
          const smaller = step(design[down.id] ?? largest, delta);
          if (smaller === undefined) continue;
          const candidate = { ...design, [up.id]: larger, [down.id]: smaller };
          const candidateCost = designCost(scenario, candidate);
          if (candidateCost < cost && passes(candidate)) {
            design = candidate;
            cost = candidateCost;
            improved = true;
          }
        }
      }
    }
  }

  // Branch and bound over the whole catalog, pruning by cost only: a partial assignment is
  // abandoned when its cost plus the cheapest diameter on every remaining pipe already reaches
  // the best known cost. No hydraulic assumption is made, so when the search finishes within
  // the limit the result is the cheapest passing design.
  const cheapest = dns[0];
  if (cheapest === undefined) return { diameters: design, cost, method: 'greedy+pairs', evaluated };
  const price = (dn: number, length: number): number => pipeCost(dn, length);
  const fixedCost = scenario.pipes
    .filter((p) => p.fixed)
    .reduce((sum, p) => sum + price(p.initialDN, p.length), 0);
  // Longest pipes first: their cost prunes the most.
  const ordered = [...free].sort((a, b) => b.length - a.length);
  const minRemaining: number[] = new Array<number>(ordered.length + 1).fill(0);
  for (let i = ordered.length - 1; i >= 0; i--) {
    minRemaining[i] = (minRemaining[i + 1] ?? 0) + price(cheapest, ordered[i]?.length ?? 0);
  }
  const current: Diameters = { ...design };
  const limit = evaluated + branchAndBoundLimit;
  let complete = true;
  const EPS = 1e-6;
  const visit = (index: number, partial: number): void => {
    if (!complete) return;
    const pipe = ordered[index];
    if (!pipe) {
      if (partial < cost - EPS) {
        if (evaluated >= limit) {
          complete = false;
          return;
        }
        if (passes(current)) {
          design = { ...current };
          cost = designCost(scenario, design);
        }
      }
      return;
    }
    for (const dn of dns) {
      const next = partial + price(dn, pipe.length);
      if (next + (minRemaining[index + 1] ?? 0) >= cost - EPS) break; // larger DN cost more
      current[pipe.id] = dn;
      visit(index + 1, next);
    }
  };
  visit(0, fixedCost);

  return {
    diameters: design,
    cost,
    method: complete ? 'branch-and-bound' : 'greedy+pairs',
    evaluated,
  };
}
