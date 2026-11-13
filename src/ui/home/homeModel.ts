import type { StageProgress } from '../../game/types';
import type { Scenario } from '../../scenarios/types';

export type Progress = Record<string, StageProgress>;

/** What the main button of the title screen does. */
export type HomeAction =
  /** Nothing saved yet: go to the stage map. */
  | { kind: 'play' }
  /** Open the first stage that is not completed. */
  | { kind: 'continue'; stage: Scenario }
  /** Every stage is completed: go to the stage map. `stage` is the last one. */
  | { kind: 'done'; stage: Scenario };

const inOrder = (scenarios: readonly Scenario[]) =>
  [...scenarios].sort((a, b) => a.order - b.order);

/**
 * Decides the main action from the saved progress. Stages unlock in order, so the first stage
 * that is not completed is always unlocked.
 */
export function homeAction(scenarios: readonly Scenario[], progress: Progress): HomeAction {
  const stages = inOrder(scenarios);
  if (!stages.some((stage) => progress[stage.id])) return { kind: 'play' };
  const next = stages.find((stage) => progress[stage.id]?.completed !== true);
  if (next) return { kind: 'continue', stage: next };
  return { kind: 'done', stage: stages[stages.length - 1]! };
}

export interface ProgressSummary {
  /** True when any stage is completed or has a saved design. */
  hasProgress: boolean;
  stars: number;
  /** Three stars per stage. */
  maxStars: number;
  completed: number;
  total: number;
  /** Sum of the best cost of the completed stages, R$; null when none has a cost. */
  bestCostTotal: number | null;
  /** Number of stages added up in `bestCostTotal`. */
  costStages: number;
}

/** Totals shown on the title screen and on the stage map. */
export function summarizeProgress(
  scenarios: readonly Scenario[],
  progress: Progress,
): ProgressSummary {
  const summary: ProgressSummary = {
    hasProgress: false,
    stars: 0,
    maxStars: 3 * scenarios.length,
    completed: 0,
    total: scenarios.length,
    bestCostTotal: null,
    costStages: 0,
  };
  for (const stage of scenarios) {
    const saved = progress[stage.id];
    if (!saved) continue;
    summary.hasProgress = true;
    if (!saved.completed) continue;
    summary.completed += 1;
    summary.stars += saved.stars;
    if (saved.bestCost !== null) {
      summary.bestCostTotal = (summary.bestCostTotal ?? 0) + saved.bestCost;
      summary.costStages += 1;
    }
  }
  return summary;
}
