import type { Scenario } from './types';

/** All stages in play order. */
export const SCENARIOS: readonly Scenario[] = [];

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
