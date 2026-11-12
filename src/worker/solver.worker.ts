/// <reference lib="webworker" />
import { evaluateStage } from '../game/evaluate';
import { getScenario } from '../scenarios';
import type { EvaluateRequest, EvaluateResponse } from './protocol';

self.onmessage = (event: MessageEvent<EvaluateRequest>) => {
  const { requestId, scenarioId, diameters, formula } = event.data;
  let response: EvaluateResponse;
  try {
    const scenario = getScenario(scenarioId);
    if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`);
    response = { requestId, ok: true, evaluation: evaluateStage(scenario, diameters, formula) };
  } catch (error) {
    response = {
      requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  self.postMessage(response);
};
