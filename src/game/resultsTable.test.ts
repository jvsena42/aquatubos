import { getScenario } from '../scenarios';
import type { Scenario } from '../scenarios/types';
import { initialDiameters } from './buildNetwork';
import { evaluateStage } from './evaluate';
import {
  CSV_BOM,
  csvField,
  csvFileName,
  csvNumber,
  nodeTableRows,
  PIPE_COLUMNS,
  pipeTableCsv,
  pipeTableRows,
} from './resultsTable';

function stage(id: string): Scenario {
  const scenario = getScenario(id);
  if (!scenario) throw new Error(`missing ${id}`);
  return scenario;
}

/** Stage 4 with a large lower main, so the water climbs T11 from N8 to N4. */
const REVERSED_T11 = {
  T1: 150,
  T2: 50,
  T3: 50,
  T4: 50,
  T5: 150,
  T6: 150,
  T7: 150,
  T8: 150,
  T9: 50,
  T10: 50,
  T11: 100,
};

describe('pipeTableRows', () => {
  it('has one row per pipe in scenario order with the solver values in display units', () => {
    const scenario = stage('stage2');
    const evaluation = evaluateStage(scenario, scenario.reference.diameters);
    const rows = pipeTableRows(scenario, evaluation);

    expect(rows.map((r) => r.id)).toEqual(scenario.pipes.map((p) => p.id));
    for (const row of rows) {
      const pipe = scenario.pipes.find((p) => p.id === row.id)!;
      const result = evaluation.result.pipes[row.id]!;
      const up = evaluation.result.nodes[pipe.from]!;
      const down = evaluation.result.nodes[pipe.to]!;
      expect(row.reversed).toBe(false);
      expect(row.upstream).toBe(pipe.from);
      expect(row.downstream).toBe(pipe.to);
      expect(row.length).toBe(pipe.length);
      expect(row.dn).toBe(scenario.reference.diameters[row.id]);
      expect(row.flow).toBeCloseTo(result.flow * 1000, 12);
      expect(row.velocity).toBeCloseTo(result.velocity, 12);
      expect(row.unitHeadLoss).toBeCloseTo(result.unitHeadLoss * 1000, 12);
      expect(row.headLoss).toBeCloseTo(result.headLoss, 12);
      expect(row.headUp).toBe(up.head);
      expect(row.headDown).toBe(down.head);
      expect(row.elevationDown).toBe(down.elevation);
      expect(row.pressureDown).toBe(down.pressure);
      // The table is consistent with itself: grade falls by the head loss along the flow.
      expect(row.headUp - row.headDown).toBeCloseTo(row.headLoss, 6);
      expect(row.pressureDown).toBeCloseTo(row.headDown - row.elevationDown, 9);
    }
  });

  it('uses the ground elevation of the scenario at a reservoir', () => {
    const scenario = stage('stage2');
    const evaluation = evaluateStage(scenario, scenario.reference.diameters);
    const first = pipeTableRows(scenario, evaluation)[0]!;
    expect(first.upstream).toBe('R1');
    expect(first.headUp).toBe(150);
    expect(first.elevationUp).toBe(146);
    expect(first.pressureUp).toBe(4);
  });

  it('swaps upstream and downstream and keeps values positive when the flow is negative', () => {
    const scenario = stage('stage4');
    const evaluation = evaluateStage(scenario, REVERSED_T11);
    const result = evaluation.result.pipes.T11!;
    expect(result.flow).toBeLessThan(0);

    const row = pipeTableRows(scenario, evaluation).find((r) => r.id === 'T11')!;
    expect(row.reversed).toBe(true);
    expect(row.upstream).toBe('N8');
    expect(row.downstream).toBe('N4');
    expect(row.flow).toBeCloseTo(-result.flow * 1000, 12);
    expect(row.velocity).toBeCloseTo(-result.velocity, 12);
    expect(row.headLoss).toBeCloseTo(-result.headLoss, 12);
    expect(row.headUp).toBe(evaluation.result.nodes.N8!.head);
    expect(row.headDown).toBe(evaluation.result.nodes.N4!.head);
    expect(row.headUp).toBeGreaterThan(row.headDown);
    expect(row.elevationUp).toBe(98);
    expect(row.elevationDown).toBe(101);
  });

  it('flags the values the stage checks reject', () => {
    const scenario = stage('stage2');
    const evaluation = evaluateStage(scenario, initialDiameters(scenario));
    const rows = pipeTableRows(scenario, evaluation);
    const issues = evaluation.report.issues;

    for (const row of rows) {
      const lowPressure = issues.some(
        (i) => i.check === 'minDynamicPressure' && i.elementId === row.downstream,
      );
      expect(row.pressureDownFlag !== null).toBe(lowPressure);
      const velocity = issues.find(
        (i) => i.elementType === 'pipe' && i.elementId === row.id && /Velocity/.test(i.check),
      );
      expect(row.velocityFlag?.severity).toBe(velocity?.severity);
    }
    expect(rows.find((r) => r.id === 'T3')!.pressureDownFlag).toEqual({
      kind: 'low',
      severity: 'error',
      limit: 10,
    });
    expect(rows.some((r) => r.velocityFlag?.kind === 'high')).toBe(true);

    const passing = evaluateStage(scenario, scenario.reference.diameters);
    expect(pipeTableRows(scenario, passing).every((r) => r.pressureDownFlag === null)).toBe(true);
  });
});

describe('nodeTableRows', () => {
  it('lists the reservoir and every node with demand, grade and both pressures', () => {
    const scenario = stage('stage5');
    const evaluation = evaluateStage(scenario, scenario.reference.diameters);
    const rows = nodeTableRows(scenario, evaluation);

    expect(rows.map((r) => r.id)).toEqual(['R1', 'J1', 'N2', 'N3', 'N4', 'N5', 'N6']);
    expect(rows[0]).toMatchObject({ kind: 'reservoir', demand: null, staticPressure: null });
    const n4 = rows.find((r) => r.id === 'N4')!;
    expect(n4.demand).toBeCloseTo(2, 12);
    expect(n4.elevation).toBe(128);
    expect(n4.head).toBe(evaluation.result.nodes.N4!.head);
    expect(n4.pressure).toBe(evaluation.result.nodes.N4!.pressure);
    expect(n4.staticPressure).toBe(evaluation.report.staticPressure.N4);
    expect(n4.staticPressure).toBeCloseTo(22, 9);
  });
});

describe('CSV', () => {
  it('quotes fields with the separator, quotes or line breaks', () => {
    expect(csvField('T1', ';')).toBe('T1');
    expect(csvField('a;b', ';')).toBe('"a;b"');
    expect(csvField('a;b', ',')).toBe('a;b');
    expect(csvField('1,5', ',')).toBe('"1,5"');
    expect(csvField('say "x"', ',')).toBe('"say ""x"""');
    expect(csvField('two\nlines', ';')).toBe('"two\nlines"');
  });

  it('formats numbers with the decimal mark of the language and no negative zero', () => {
    expect(csvNumber(1234.5678, 2, 'pt')).toBe('1234,57');
    expect(csvNumber(1234.5678, 2, 'en')).toBe('1234.57');
    expect(csvNumber(-0.0001, 2, 'pt')).toBe('0,00');
    expect(csvNumber(75, 0, 'en')).toBe('75');
    expect(csvNumber(Number.NaN, 2, 'en')).toBe('');
  });

  it('writes the pt file with BOM, semicolons, decimal commas and units in the header', () => {
    const scenario = stage('stage2');
    const evaluation = evaluateStage(scenario, scenario.reference.diameters);
    const rows = pipeTableRows(scenario, evaluation);
    const csv = pipeTableCsv(rows, 'pt');

    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines).toHaveLength(rows.length + 1);
    expect(lines[0]).toBe(
      'Trecho;Nó montante;Nó jusante;Extensão (m);Vazão (L/s);DN (mm);Velocidade (m/s);' +
        'Perda de carga unitária J (m/km);Perda de carga no trecho (m);' +
        'Cota piezométrica montante (m);Cota piezométrica jusante (m);' +
        'Cota do terreno montante (m);Cota do terreno jusante (m);' +
        'Pressão disponível montante (mca);Pressão disponível jusante (mca)',
    );
    const cells = lines[1]!.split(';');
    expect(cells).toHaveLength(PIPE_COLUMNS.length);
    expect(cells.slice(0, 6)).toEqual(['T1', 'R1', 'N1', '250,0', '10,500', '100']);
    expect(cells[9]).toBe('150,00');
    expect(cells[11]).toBe('146,00');
    expect(cells[14]).toBe(evaluation.result.nodes.N1!.pressure.toFixed(2).replace('.', ','));
  });

  it('writes the en file with commas and decimal points that parse back to the results', () => {
    const scenario = stage('stage3');
    const evaluation = evaluateStage(scenario, scenario.reference.diameters);
    const rows = pipeTableRows(scenario, evaluation);
    const lines = pipeTableCsv(rows, 'en').slice(1).trimEnd().split('\r\n');

    expect(lines[0]!.split(',')).toEqual([
      'Pipe',
      'Upstream node',
      'Downstream node',
      'Length (m)',
      'Flow (L/s)',
      'DN (mm)',
      'Velocity (m/s)',
      'Unit head loss J (m/km)',
      'Head loss in the pipe (m)',
      'Upstream hydraulic grade (m)',
      'Downstream hydraulic grade (m)',
      'Upstream ground elevation (m)',
      'Downstream ground elevation (m)',
      'Upstream available pressure (mca)',
      'Downstream available pressure (mca)',
    ]);
    lines.slice(1).forEach((line, index) => {
      const cells = line.split(',');
      const pipe = scenario.pipes[index]!;
      const result = evaluation.result.pipes[pipe.id]!;
      expect(cells[0]).toBe(pipe.id);
      expect(Number(cells[4])).toBeCloseTo(Math.abs(result.flow) * 1000, 3);
      expect(Number(cells[6])).toBeCloseTo(Math.abs(result.velocity), 2);
      expect(Number(cells[8])).toBeCloseTo(Math.abs(result.headLoss), 2);
      expect(Number(cells[10])).toBeCloseTo(
        evaluation.result.nodes[rows[index]!.downstream]!.head,
        2,
      );
    });
  });

  it('names the file after the stage', () => {
    expect(csvFileName('stage3')).toBe('aquatubos-stage3.csv');
  });
});
