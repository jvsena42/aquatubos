import type { HeadLossFormula } from '../engine/types';
import { evaluateStage } from '../game/evaluate';
import type { StageEvaluation } from '../game/types';
import { getScenario } from '../scenarios';
import type { Diameters } from '../scenarios/types';
import type { EvaluateRequest, EvaluateResponse } from './protocol';

type Pending = { resolve: (e: StageEvaluation) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (!worker) {
    worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<EvaluateResponse>) => {
      const entry = pending.get(event.data.requestId);
      if (!entry) return;
      pending.delete(event.data.requestId);
      if (event.data.ok) entry.resolve(event.data.evaluation);
      else entry.reject(new Error(event.data.error));
    };
    worker.onerror = (event) => {
      for (const entry of pending.values()) entry.reject(new Error(event.message));
      pending.clear();
    };
  }
  return worker;
}

/**
 * Evaluates a stage in the solver worker. Where Web Workers do not exist (unit tests) the
 * evaluation runs on the calling thread.
 */
export function evaluateInWorker(
  scenarioId: string,
  diameters: Diameters,
  formula: HeadLossFormula,
): Promise<StageEvaluation> {
  const w = getWorker();
  if (!w) {
    return new Promise((resolve, reject) => {
      try {
        const scenario = getScenario(scenarioId);
        if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`);
        resolve(evaluateStage(scenario, diameters, formula));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
  return new Promise((resolve, reject) => {
    const requestId = nextId++;
    pending.set(requestId, { resolve, reject });
    const request: EvaluateRequest = { requestId, scenarioId, diameters, formula };
    w.postMessage(request);
  });
}
