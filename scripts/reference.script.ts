/**
 * Computes the reference solution of every stage and prints it next to the values stored in the
 * scenario files. With WRITE=1 the scenario files are updated (reference diameters, cost and
 * method; the budget of stages that have one is set to BUDGET_FACTOR × reference cost, rounded
 * up to the next R$ 1000).
 *
 *   npm run reference            # print only
 *   WRITE=1 npm run reference    # update src/scenarios/stages/*.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { evaluateStage } from '../src/game/evaluate';
import { initialDiameters } from '../src/game/buildNetwork';
import { findReferenceDesign } from '../src/game/referenceSearch';
import { SCENARIOS } from '../src/scenarios';

const BUDGET_FACTOR = 1.15;
const write = process.env.WRITE === '1';

const METHOD_TEXT = {
  exhaustive: 'Exhaustive search over all commercial diameters (cheapest passing design).',
  'branch-and-bound':
    'Branch and bound over all commercial diameters with cost pruning (cheapest passing design).',
  'greedy+pairs':
    'Heuristic search: greedy reduction from the largest diameters followed by pair moves. Good design, not a proven optimum.',
} as const;

describe('reference solutions', () => {
  for (const scenario of SCENARIOS) {
    it(scenario.id, () => {
      const reference = findReferenceDesign(scenario);
      if (!reference) throw new Error(`${scenario.id}: no passing design exists`);
      const initial = evaluateStage(scenario, initialDiameters(scenario));
      const solved = evaluateStage(scenario, reference.diameters);
      const pressures = Object.values(solved.result.nodes)
        .filter((n) => scenario.nodes.some((s) => s.id === n.id))
        .map((n) => `${n.id}=${n.pressure.toFixed(2)}`);
      const velocities = Object.values(solved.result.pipes).map(
        (p) => `${p.id}=${Math.abs(p.velocity).toFixed(2)}`,
      );
      const budget =
        scenario.budget === null ? null : Math.ceil((reference.cost * BUDGET_FACTOR) / 1000) * 1000;
      process.stdout.write(
        [
          `${scenario.id} (${reference.method}, ${reference.evaluated} designs solved)`,
          `  reference DN: ${JSON.stringify(reference.diameters)}`,
          `  reference cost: R$ ${reference.cost.toFixed(2)}  stored: R$ ${scenario.reference.cost.toFixed(2)}`,
          `  budget: ${budget}  stored: ${scenario.budget}`,
          `  pressures (mca): ${pressures.join(' ')}`,
          `  velocities (m/s): ${velocities.join(' ')}`,
          `  warnings with reference: ${solved.report.issues.map((i) => `${i.check}:${i.elementId}`).join(' ') || 'none'}`,
          `  initial design fails: ${
            initial.report.issues
              .filter((i) => i.severity === 'error')
              .map((i) => `${i.check}:${i.elementId}`)
              .join(' ') || 'NOTHING (stage must start failing)'
          }`,
          `  initial cost: R$ ${initial.cost.toFixed(2)}`,
        ].join('\n') + '\n',
      );

      if (write) {
        const path = fileURLToPath(
          new URL(`../src/scenarios/stages/${scenario.id}.json`, import.meta.url),
        );
        const json = JSON.parse(readFileSync(path, 'utf8'));
        json.reference = {
          diameters: reference.diameters,
          cost: reference.cost,
          method: METHOD_TEXT[reference.method],
        };
        if (budget !== null) json.budget = budget;
        writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
        execFileSync('npx', ['prettier', '--write', path]);
      }
    });
  }
});
