import type { HeadLossFormula } from '../engine/types';
import type { StageEvaluation } from '../game/types';
import type { Diameters } from '../scenarios/types';

export interface EvaluateRequest {
  requestId: number;
  scenarioId: string;
  diameters: Diameters;
  formula: HeadLossFormula;
}

export type EvaluateResponse =
  | { requestId: number; ok: true; evaluation: StageEvaluation }
  | { requestId: number; ok: false; error: string };
