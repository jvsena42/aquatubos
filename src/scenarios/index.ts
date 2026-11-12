import stage1 from './stages/stage1.json';
import stage2 from './stages/stage2.json';
import stage3 from './stages/stage3.json';
import stage4 from './stages/stage4.json';
import stage5 from './stages/stage5.json';
import type { Scenario } from './types';

// JSON imports are typed structurally (string instead of the literal unions), so they are cast
// here. `validateScenario` and the stage tests check the content.
const files = [stage1, stage2, stage3, stage4, stage5] as unknown as Scenario[];

/** All stages in play order. */
export const SCENARIOS: readonly Scenario[] = [...files].sort((a, b) => a.order - b.order);

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
