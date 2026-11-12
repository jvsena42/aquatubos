import { NBR_12218 } from './config/nbr12218';
import {
  DEFAULT_K1,
  DEFAULT_K2,
  designFlow,
  distributeDemandByLength,
  linearFlow,
  type DemandPipe,
} from './demand';

describe('designFlow', () => {
  it('uses the NBR 12218 coefficients by default', () => {
    expect(DEFAULT_K1).toBe(NBR_12218.k1);
    expect(DEFAULT_K2).toBe(NBR_12218.k2);
  });

  it('computes Q = P·q·K1·K2 / 86400 in m³/s', () => {
    // 10 000 hab × 200 L/(hab·dia) = 2 000 000 L/dia
    // × 1.2 × 1.5 = 3 600 000 L/dia
    // / 86 400 s/dia = 41.6667 L/s = 0.0416667 m³/s
    expect(designFlow({ population: 10000, perCapita: 200 })).toBeCloseTo(0.0416667, 7);
  });

  it('accepts explicit coefficients', () => {
    // 4 320 hab × 150 L/(hab·dia) × 1.0 × 2.0 = 1 296 000 L/dia = 15 L/s = 0.015 m³/s
    expect(designFlow({ population: 4320, perCapita: 150, k1: 1, k2: 2 })).toBeCloseTo(0.015, 12);
    // Mean flow, without peak coefficients: 8 640 hab × 100 L/(hab·dia) = 10 L/s
    expect(designFlow({ population: 8640, perCapita: 100, k1: 1, k2: 1 })).toBeCloseTo(0.01, 12);
  });

  it('returns zero for an empty population', () => {
    expect(designFlow({ population: 0, perCapita: 200 })).toBe(0);
  });

  it('rejects negative or non-finite inputs', () => {
    expect(() => designFlow({ population: -1, perCapita: 200 })).toThrow(RangeError);
    expect(() => designFlow({ population: 100, perCapita: Number.NaN })).toThrow(RangeError);
    expect(() => designFlow({ population: 100, perCapita: 200, k1: -1 })).toThrow(RangeError);
    expect(() => designFlow({ population: 100, perCapita: 200, k2: Infinity })).toThrow(RangeError);
  });
});

const pipes: DemandPipe[] = [
  { id: 'T1', from: 'R', to: 'A', length: 100 },
  { id: 'T2', from: 'A', to: 'B', length: 200 },
  { id: 'T3', from: 'B', to: 'C', length: 300 },
];

describe('linearFlow', () => {
  it('divides the total flow by the total length', () => {
    // 0.012 m³/s / (100 + 200 + 300) m = 0.00002 m³/s per m (0.02 L/s per m)
    expect(linearFlow(0.012, pipes)).toBeCloseTo(0.00002, 12);
  });

  it('throws when there is no length to distribute over', () => {
    expect(() => linearFlow(0.01, [])).toThrow(RangeError);
    expect(() => linearFlow(0.01, [{ id: 'T', from: 'A', to: 'B', length: 0 }])).toThrow(
      RangeError,
    );
    expect(() => linearFlow(0.01, [{ id: 'T', from: 'A', to: 'B', length: -5 }])).toThrow(
      RangeError,
    );
  });
});

const sum = (record: Record<string, number>): number =>
  Object.values(record).reduce((a, b) => a + b, 0);

describe('distributeDemandByLength', () => {
  it('gives half of q·L to each end of every pipe', () => {
    // q = 0.012 / 600 = 0.00002 m³/s per m
    // T1: 0.002, T2: 0.004, T3: 0.006 m³/s
    // R = 0.001; A = 0.001 + 0.002 = 0.003; B = 0.002 + 0.003 = 0.005; C = 0.003
    const demand = distributeDemandByLength(0.012, pipes);
    expect(Object.keys(demand)).toEqual(['R', 'A', 'B', 'C']);
    expect(demand.R).toBeCloseTo(0.001, 12);
    expect(demand.A).toBeCloseTo(0.003, 12);
    expect(demand.B).toBeCloseTo(0.005, 12);
    expect(demand.C).toBeCloseTo(0.003, 12);
    expect(sum(demand)).toBeCloseTo(0.012, 12);
  });

  it('moves the share of an excluded end to the other end', () => {
    // Same q. T1 gives its whole 0.002 to A because R is a reservoir.
    // A = 0.002 + 0.002 = 0.004; B = 0.005; C = 0.003
    const demand = distributeDemandByLength(0.012, pipes, ['R']);
    expect(Object.keys(demand)).toEqual(['A', 'B', 'C']);
    expect(demand.A).toBeCloseTo(0.004, 12);
    expect(demand.B).toBeCloseTo(0.005, 12);
    expect(demand.C).toBeCloseTo(0.003, 12);
    expect(sum(demand)).toBeCloseTo(0.012, 12);
  });

  it('handles an excluded node at the `to` end', () => {
    const demand = distributeDemandByLength(
      0.006,
      [{ id: 'T', from: 'A', to: 'R', length: 50 }],
      ['R'],
    );
    expect(demand).toEqual({ A: 0.006 });
  });

  it('leaves out pipes that join two excluded nodes', () => {
    // The 400 m pipe between the two reservoirs serves nobody: q = 0.006 / 300.
    const demand = distributeDemandByLength(
      0.006,
      [
        { id: 'T0', from: 'R1', to: 'R2', length: 400 },
        { id: 'T1', from: 'R1', to: 'A', length: 100 },
        { id: 'T2', from: 'A', to: 'B', length: 200 },
      ],
      ['R1', 'R2'],
    );
    // T1: 0.002 all to A; T2: 0.004, half each → A = 0.004, B = 0.002
    expect(Object.keys(demand)).toEqual(['A', 'B']);
    expect(demand.A).toBeCloseTo(0.004, 12);
    expect(demand.B).toBeCloseTo(0.002, 12);
  });

  it('gives the whole share to the node of a pipe that starts and ends at it', () => {
    const demand = distributeDemandByLength(0.003, [{ id: 'T', from: 'A', to: 'A', length: 10 }]);
    expect(demand.A).toBeCloseTo(0.003, 12);
  });

  it('throws when every pipe is excluded', () => {
    expect(() =>
      distributeDemandByLength(0.01, [{ id: 'T', from: 'R1', to: 'R2', length: 10 }], ['R1', 'R2']),
    ).toThrow(RangeError);
  });
});
