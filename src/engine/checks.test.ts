import { DEFAULT_CHECK_SETTINGS, runChecks, staticPressures } from './checks';
import { NBR_12218, NBR_CHECK_LIMITS } from './config/nbr12218';
import type { CheckSettings, Network, Pipe, SolveResult } from './types';
import { pipeArea } from './units';

const pipe = (id: string, from: string, to: string, diameter = 0.1, length = 100): Pipe => ({
  id,
  from,
  to,
  length,
  diameter,
  hazenWilliamsC: 140,
  roughness: 0.0000015,
});

/** Reservoir at 50 m feeding three junctions in series. */
const network: Network = {
  junctions: [
    { id: 'N1', elevation: 20, demand: 0 },
    { id: 'N2', elevation: 25, demand: 0.004 },
    { id: 'N3', elevation: 30, demand: 0.004 },
  ],
  reservoirs: [{ id: 'R1', head: 50 }],
  pipes: [pipe('T1', 'R1', 'N1'), pipe('T2', 'N1', 'N2'), pipe('T3', 'N2', 'N3')],
  pumps: [],
};

/**
 * Hand-made solver result: heads by node id and flows by pipe id. Velocity follows from the
 * flow and the diameter; the head loss is not used by the checks.
 */
function makeResult(
  net: Network,
  heads: Record<string, number>,
  flows: Record<string, number>,
  overrides: Partial<SolveResult> = {},
): SolveResult {
  const nodes: SolveResult['nodes'] = {};
  for (const j of net.junctions) {
    const head = heads[j.id];
    if (head === undefined) continue;
    nodes[j.id] = {
      id: j.id,
      head,
      elevation: j.elevation,
      pressure: head - j.elevation,
      demand: j.demand,
    };
  }
  for (const r of net.reservoirs) {
    nodes[r.id] = { id: r.id, head: r.head, elevation: r.head, pressure: 0, demand: 0 };
  }
  const pipes: SolveResult['pipes'] = {};
  for (const p of net.pipes) {
    const flow = flows[p.id];
    if (flow === undefined) continue;
    pipes[p.id] = {
      id: p.id,
      flow,
      velocity: flow / pipeArea(p.diameter),
      headLoss: 0,
      unitHeadLoss: 0,
    };
  }
  return {
    converged: true,
    iterations: 5,
    residual: 1e-12,
    formula: 'hazen-williams',
    nodes,
    pipes,
    pumps: {},
    ...overrides,
  };
}

// Area of a 100 mm pipe: π·0.1²/4 = 0.0078540 m². 8 L/s → 1.019 m/s.
const goodHeads = { N1: 49, N2: 48, N3: 47 };
const goodFlows = { T1: 0.008, T2: 0.008, T3: 0.008 };

describe('staticPressures', () => {
  it('is the reservoir head minus the ground elevation', () => {
    expect(staticPressures(network)).toEqual({ N1: 30, N2: 25, N3: 20 });
  });

  it('uses the highest reservoir connected to the junction', () => {
    const twoReservoirs: Network = {
      ...network,
      reservoirs: [
        { id: 'R1', head: 50 },
        { id: 'R2', head: 62 },
      ],
      pipes: [...network.pipes, pipe('T4', 'N3', 'R2')],
    };
    expect(staticPressures(twoReservoirs)).toEqual({ N1: 42, N2: 37, N3: 32 });
  });

  it('adds the shutoff head of a pump in the from → to direction only', () => {
    // R1 (10 m) → pump (shutoff 45 m) → N1 → N2; N0 sits on the suction side.
    const pumped: Network = {
      junctions: [
        { id: 'N0', elevation: 5, demand: 0 },
        { id: 'N1', elevation: 20, demand: 0 },
        { id: 'N2', elevation: 30, demand: 0.004 },
      ],
      reservoirs: [{ id: 'R1', head: 10 }],
      pipes: [pipe('T0', 'R1', 'N0'), pipe('T1', 'N1', 'N2')],
      pumps: [{ id: 'B1', from: 'N0', to: 'N1', curve: { a: 45, b: 2000, c: 2 } }],
    };
    // Discharge side: 10 + 45 = 55 m of head. Suction side keeps the reservoir level.
    expect(staticPressures(pumped)).toEqual({ N0: 5, N1: 35, N2: 25 });
  });

  it('does not carry head backwards through a pump', () => {
    const reversed: Network = {
      junctions: [{ id: 'N1', elevation: 0, demand: 0 }],
      reservoirs: [{ id: 'R1', head: 10 }],
      pipes: [],
      pumps: [{ id: 'B1', from: 'N1', to: 'R1', curve: { a: 45, b: 2000, c: 2 } }],
    };
    expect(staticPressures(reversed)).toEqual({});
  });

  it('leaves out junctions that no reservoir reaches', () => {
    const isolated: Network = {
      ...network,
      junctions: [...network.junctions, { id: 'N9', elevation: 0, demand: 0 }],
    };
    expect(staticPressures(isolated)).toEqual({ N1: 30, N2: 25, N3: 20 });
  });

  it('stops when a pump sits inside a loop', () => {
    const looped: Network = {
      junctions: [
        { id: 'N1', elevation: 0, demand: 0 },
        { id: 'N2', elevation: 0, demand: 0 },
      ],
      reservoirs: [{ id: 'R1', head: 10 }],
      pipes: [pipe('T1', 'R1', 'N1'), pipe('T2', 'N1', 'N2')],
      pumps: [{ id: 'B1', from: 'N1', to: 'N2', curve: { a: 20, b: 1000, c: 2 } }],
    };
    const pressures = staticPressures(looped);
    expect(Number.isFinite(pressures.N1)).toBe(true);
    expect(pressures.N2).toBeGreaterThanOrEqual(30);
  });
});

describe('runChecks', () => {
  it('passes a network inside every limit', () => {
    const report = runChecks(network, makeResult(network, goodHeads, goodFlows));
    expect(report.passed).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.staticPressure).toEqual({ N1: 30, N2: 25, N3: 20 });
  });

  it('does not report values that sit exactly on a limit', () => {
    // N3 at 30 m + 10 mca; v = 0.6 m/s in T3; DN 50 in T1 with 3.5 m/s.
    const net: Network = {
      ...network,
      pipes: [pipe('T1', 'R1', 'N1', 0.05), ...network.pipes.slice(1)],
    };
    const flows = {
      T1: NBR_CHECK_LIMITS.maxVelocity * pipeArea(0.05),
      T2: 0.008,
      T3: NBR_CHECK_LIMITS.minVelocity * pipeArea(0.1),
    };
    const report = runChecks(net, makeResult(net, { N1: 49, N2: 48, N3: 40 }, flows));
    expect(report.issues).toEqual([]);
  });

  it('reports low dynamic pressure with value, limit and hint in both languages', () => {
    const report = runChecks(
      network,
      makeResult(network, { N1: 49, N2: 48, N3: 37.42 }, goodFlows),
    );
    expect(report.passed).toBe(false);
    expect(report.issues).toHaveLength(1);
    const issue = report.issues[0]!;
    expect(issue).toMatchObject({
      check: 'minDynamicPressure',
      severity: 'error',
      elementType: 'node',
      elementId: 'N3',
      limit: NBR_CHECK_LIMITS.minDynamicPressure,
    });
    expect(issue.value).toBeCloseTo(7.42, 10);
    expect(issue.explanation.pt).toBe(
      'Nó N3: pressão dinâmica de 7,42 mca, abaixo do mínimo de 10 mca (ABNT NBR 12218:2017). ' +
        'Aumente o diâmetro dos trechos a montante para reduzir a perda de carga.',
    );
    expect(issue.explanation.en).toBe(
      'Node N3: dynamic pressure of 7.42 m H2O, below the minimum of 10 m H2O ' +
        '(ABNT NBR 12218:2017). Increase the diameter of the upstream pipes to reduce the head loss.',
    );
  });

  it('checks junctions without demand too', () => {
    const report = runChecks(network, makeResult(network, { N1: 25, N2: 48, N3: 47 }, goodFlows));
    expect(report.issues.map((i) => i.elementId)).toEqual(['N1']);
  });

  it('gives a different hint when even the static pressure is below the minimum', () => {
    const high: Network = {
      ...network,
      junctions: [...network.junctions.slice(0, 2), { id: 'N3', elevation: 44, demand: 0.004 }],
    };
    const report = runChecks(high, makeResult(high, { N1: 49, N2: 48, N3: 47 }, goodFlows));
    const issue = report.issues[0]!;
    expect(issue.check).toBe('minDynamicPressure');
    expect(issue.value).toBeCloseTo(3, 10);
    expect(issue.explanation.pt).toContain('pressão dinâmica de 3,00 mca');
    expect(issue.explanation.pt).toContain(
      'Mesmo sem escoamento a pressão seria de apenas 6,00 mca',
    );
    expect(issue.explanation.pt).toContain('reservatório mais alto ou bomba');
    expect(issue.explanation.en).toContain(
      'Even with no flow the pressure would be only 6.00 m H2O',
    );
    expect(issue.explanation.pt).not.toContain('Aumente o diâmetro');
  });

  it('formats negative pressures', () => {
    const report = runChecks(network, makeResult(network, { N1: 49, N2: 48, N3: 28.5 }, goodFlows));
    expect(report.issues[0]!.explanation.pt).toContain('pressão dinâmica de -1,50 mca');
    expect(report.issues[0]!.explanation.en).toContain('dynamic pressure of -1.50 m H2O');
  });

  it('reports high static pressure', () => {
    const low: Network = {
      ...network,
      junctions: [{ id: 'N1', elevation: 5.5, demand: 0 }, ...network.junctions.slice(1)],
    };
    const report = runChecks(low, makeResult(low, goodHeads, goodFlows));
    expect(report.passed).toBe(false);
    expect(report.issues).toHaveLength(1);
    const issue = report.issues[0]!;
    expect(issue).toMatchObject({
      check: 'maxStaticPressure',
      severity: 'error',
      elementType: 'node',
      elementId: 'N1',
      value: 44.5,
      limit: NBR_CHECK_LIMITS.maxStaticPressure,
    });
    expect(issue.explanation.pt).toContain(
      'Nó N1: pressão estática de 44,50 mca, acima do máximo de 40 mca (ABNT NBR 12218:2017).',
    );
    expect(issue.explanation.pt).toContain('válvula redutora de pressão');
    expect(issue.explanation.en).toContain(
      'Node N1: static pressure of 44.50 m H2O, above the maximum of 40 m H2O',
    );
    expect(issue.explanation.en).toContain('pressure reducing valve');
  });

  it('reports low velocity as a warning that does not block', () => {
    // 2 L/s in 100 mm: 0.002 / 0.0078540 = 0.2546 m/s
    const report = runChecks(
      network,
      makeResult(network, goodHeads, { T1: 0.008, T2: 0.008, T3: -0.002 }),
    );
    expect(report.passed).toBe(true);
    expect(report.issues).toHaveLength(1);
    const issue = report.issues[0]!;
    expect(issue).toMatchObject({
      check: 'minVelocity',
      severity: 'warning',
      elementType: 'pipe',
      elementId: 'T3',
      limit: NBR_CHECK_LIMITS.minVelocity,
    });
    expect(issue.value).toBeCloseTo(0.2546, 4);
    expect(issue.explanation.pt).toBe(
      'Trecho T3: velocidade de 0,25 m/s (vazão de 2,00 L/s no diâmetro de 100 mm), abaixo do ' +
        'mínimo de 0,6 m/s (ABNT NBR 12218:2017). Reduza o diâmetro do trecho para aumentar a ' +
        'velocidade.',
    );
    expect(issue.explanation.en).toBe(
      'Pipe T3: velocity of 0.25 m/s (flow of 2.00 L/s in a 100 mm diameter), below the ' +
        'minimum of 0.6 m/s (ABNT NBR 12218:2017). Reduce the diameter of the pipe to increase ' +
        'the velocity.',
    );
  });

  it('does not suggest a smaller pipe when the pipe has the minimum diameter', () => {
    const net: Network = {
      ...network,
      pipes: [...network.pipes.slice(0, 2), pipe('T3', 'N2', 'N3', 0.05)],
    };
    // 0.5 L/s in 50 mm: 0.0005 / 0.0019635 = 0.2546 m/s
    const report = runChecks(net, makeResult(net, goodHeads, { T1: 0.008, T2: 0.008, T3: 0.0005 }));
    const issue = report.issues[0]!;
    expect(issue.check).toBe('minVelocity');
    expect(issue.explanation.pt).toContain('O trecho já está no diâmetro mínimo');
    expect(issue.explanation.pt).not.toContain('Reduza o diâmetro');
    expect(issue.explanation.en).toContain('already has the minimum diameter');
  });

  it('reports high velocity using the absolute value', () => {
    // 30 L/s in 100 mm: 0.030 / 0.0078540 = 3.8197 m/s, flowing against the pipe direction
    const report = runChecks(
      network,
      makeResult(network, goodHeads, { T1: -0.03, T2: 0.008, T3: 0.008 }),
    );
    expect(report.passed).toBe(false);
    expect(report.issues).toHaveLength(1);
    const issue = report.issues[0]!;
    expect(issue).toMatchObject({
      check: 'maxVelocity',
      severity: 'error',
      elementType: 'pipe',
      elementId: 'T1',
      limit: NBR_CHECK_LIMITS.maxVelocity,
    });
    expect(issue.value).toBeCloseTo(3.8197, 4);
    expect(issue.explanation.pt).toContain(
      'Trecho T1: velocidade de 3,82 m/s (vazão de 30,00 L/s no diâmetro de 100 mm), acima do máximo de 3,5 m/s',
    );
    expect(issue.explanation.pt).toContain('Aumente o diâmetro do trecho');
    expect(issue.explanation.en).toContain('Pipe T1: velocity of 3.82 m/s');
    expect(issue.explanation.en).toContain('above the maximum of 3.5 m/s');
  });

  it('reports a diameter below the minimum', () => {
    const net: Network = {
      ...network,
      pipes: [...network.pipes.slice(0, 2), pipe('T3', 'N2', 'N3', 0.04)],
    };
    // 1.5 L/s in 40 mm: 1.19 m/s, inside the velocity limits
    const report = runChecks(net, makeResult(net, goodHeads, { T1: 0.008, T2: 0.008, T3: 0.0015 }));
    expect(report.passed).toBe(false);
    expect(report.issues).toHaveLength(1);
    const issue = report.issues[0]!;
    expect(issue).toMatchObject({
      check: 'minDiameter',
      severity: 'error',
      elementType: 'pipe',
      elementId: 'T3',
      value: 0.04,
      limit: NBR_CHECK_LIMITS.minDiameter,
    });
    expect(issue.explanation.pt).toBe(
      'Trecho T3: diâmetro de 40 mm, abaixo do mínimo de 50 mm (ABNT NBR 12218:2017). ' +
        'Use DN 50 ou maior neste trecho.',
    );
    expect(issue.explanation.en).toBe(
      'Pipe T3: diameter of 40 mm, below the minimum of 50 mm (ABNT NBR 12218:2017). ' +
        'Use DN 50 or larger in this pipe.',
    );
  });

  it('adds a convergence error when the solver did not converge', () => {
    const report = runChecks(
      network,
      makeResult(network, goodHeads, goodFlows, {
        converged: false,
        iterations: 100,
        residual: 0.02,
      }),
    );
    expect(report.passed).toBe(false);
    expect(report.issues).toHaveLength(1);
    const issue = report.issues[0]!;
    expect(issue).toMatchObject({
      check: 'convergence',
      severity: 'error',
      elementType: 'network',
      value: 0.02,
    });
    expect(issue.explanation.pt).toContain('não convergiu em 100 iterações');
    expect(issue.explanation.en).toContain('did not converge in 100 iterations');
  });

  it("skips checks that are 'off' and applies the configured severity", () => {
    const net: Network = {
      ...network,
      junctions: [{ id: 'N1', elevation: 5, demand: 0 }, ...network.junctions.slice(1)],
      pipes: [pipe('T1', 'R1', 'N1', 0.04), ...network.pipes.slice(1)],
    };
    // N1: static 45 mca (too high); N3: 7 mca (too low); T1: DN 40 with 6.37 m/s; T3: 0.25 m/s
    const result = makeResult(net, { N1: 49, N2: 48, N3: 37 }, { T1: 0.008, T2: 0.008, T3: 0.002 });

    const all = runChecks(net, result);
    expect(all.issues.map((i) => `${i.check}:${i.elementId}:${i.severity}`)).toEqual([
      'minDynamicPressure:N3:error',
      'maxStaticPressure:N1:error',
      'minVelocity:T3:warning',
      'maxVelocity:T1:error',
      'minDiameter:T1:error',
    ]);
    expect(all.passed).toBe(false);

    const off: CheckSettings = {
      minDynamicPressure: 'off',
      maxStaticPressure: 'off',
      minVelocity: 'off',
      maxVelocity: 'off',
      minDiameter: 'off',
    };
    const none = runChecks(net, result, off);
    expect(none.issues).toEqual([]);
    expect(none.passed).toBe(true);
    expect(none.staticPressure.N1).toBe(45);

    const lenient: CheckSettings = {
      minDynamicPressure: 'warning',
      maxStaticPressure: 'warning',
      minVelocity: 'error',
      maxVelocity: 'warning',
      minDiameter: 'warning',
    };
    const warned = runChecks(net, result, lenient);
    expect(warned.issues.map((i) => `${i.check}:${i.severity}`)).toEqual([
      'minDynamicPressure:warning',
      'maxStaticPressure:warning',
      'minVelocity:error',
      'maxVelocity:warning',
      'minDiameter:warning',
    ]);
    expect(warned.passed).toBe(false);
    expect(runChecks(net, result, { ...lenient, minVelocity: 'warning' }).passed).toBe(true);
  });

  it('orders issues by check and then by element order, convergence first', () => {
    const result = makeResult(
      network,
      { N1: 25, N2: 30, N3: 35 },
      { T1: 0.001, T2: 0.001, T3: 0.04 },
      { converged: false },
    );
    const report = runChecks(network, result);
    expect(report.issues.map((i) => `${i.check}:${i.elementId}`)).toEqual([
      'convergence:network',
      'minDynamicPressure:N1',
      'minDynamicPressure:N2',
      'minDynamicPressure:N3',
      'minVelocity:T1',
      'minVelocity:T2',
      'maxVelocity:T3',
    ]);
  });

  it('uses custom limits and drops the standard reference for them', () => {
    const limits = { ...NBR_CHECK_LIMITS, minDynamicPressure: 15.5, maxVelocity: 1 };
    const report = runChecks(
      network,
      makeResult(network, { N1: 49, N2: 48, N3: 42 }, goodFlows),
      DEFAULT_CHECK_SETTINGS,
      limits,
    );
    expect(report.issues.map((i) => `${i.check}:${i.elementId}:${i.limit}`)).toEqual([
      'minDynamicPressure:N3:15.5',
      'maxVelocity:T1:1',
      'maxVelocity:T2:1',
      'maxVelocity:T3:1',
    ]);
    expect(report.issues[0]!.explanation.pt).toContain('abaixo do mínimo de 15,5 mca. Aumente');
    expect(report.issues[0]!.explanation.en).toContain('below the minimum of 15.5 m H2O. Increase');
    expect(report.issues[0]!.explanation.pt).not.toContain(NBR_12218.reference);
  });

  it('skips elements that are missing from the result', () => {
    const report = runChecks(network, makeResult(network, { N1: 49 }, { T1: 0.008 }));
    expect(report.issues).toEqual([]);
  });

  it('returns plain JSON data', () => {
    const report = runChecks(
      network,
      makeResult(network, { N1: 49, N2: 48, N3: 37.42 }, goodFlows),
    );
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });

  it('formats a value that rounds to zero without a minus sign', () => {
    const report = runChecks(
      network,
      makeResult(network, { N1: 49, N2: 48, N3: 29.999 }, goodFlows),
    );
    expect(report.issues[0]!.explanation.pt).toContain('pressão dinâmica de 0,00 mca');
  });
});
