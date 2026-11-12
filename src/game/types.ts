import type {
  CheckReport,
  HardyCrossResult,
  Loop,
  Network,
  PumpCurve,
  SolveResult,
} from '../engine/types';

export type Stars = 0 | 1 | 2 | 3;

export interface PumpChartPoint {
  /** m³/s */
  flow: number;
  /** Head supplied by the pump at this flow, m. */
  pumpHead: number;
  /**
   * Head the pump must supply for every node to keep the minimum dynamic pressure when all
   * demands are scaled so the total equals `flow`, m.
   */
  systemHead: number;
}

export interface PumpChartData {
  pumpId: string;
  curve: PumpCurve;
  points: PumpChartPoint[];
  /** Operating point of the solved network (flow through the pump and head it adds). */
  operating: { flow: number; head: number };
  /** System head at the operating flow, m. */
  requiredHead: number;
}

export interface HardyCrossData {
  loops: Loop[];
  result: HardyCrossResult;
}

/** Everything the UI needs after "Calcular / Verificar". Plain data: it crosses the worker. */
export interface StageEvaluation {
  scenarioId: string;
  /** DN in mm by pipe id that was evaluated. */
  diameters: Record<string, number>;
  network: Network;
  result: SolveResult;
  report: CheckReport;
  /** R$ */
  cost: number;
  /** True when there is no budget or cost <= budget. */
  withinBudget: boolean;
  /** Checks passed and within budget. */
  passed: boolean;
  stars: Stars;
  hardyCross?: HardyCrossData;
  pumpChart?: PumpChartData;
}

export interface StageProgress {
  stageId: string;
  completed: boolean;
  stars: Stars;
  /** Lowest cost among passing designs, R$. */
  bestCost: number | null;
  /** Last design the player worked on: DN in mm by pipe id. */
  diameters: Record<string, number>;
  updatedAt: number;
}
