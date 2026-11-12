import { solveCholesky } from './linalg';

describe('solveCholesky', () => {
  it('solves a 1×1 system', () => {
    expect(solveCholesky([[4]], [2])).toEqual([0.5]);
  });

  it('returns an empty solution for an empty system', () => {
    expect(solveCholesky([], [])).toEqual([]);
  });

  // A = [[4, 12, −16], [12, 37, −43], [−16, −43, 98]] has the factor
  // L = [[2, 0, 0], [6, 1, 0], [−8, 5, 3]]. With x = (1, 2, 3):
  //   b = (4 + 24 − 48, 12 + 74 − 129, −16 − 86 + 294) = (−20, −43, 192)
  it('solves the textbook 3×3 system', () => {
    const a = [
      [4, 12, -16],
      [12, 37, -43],
      [-16, -43, 98],
    ];
    const x = solveCholesky(a, [-20, -43, 192]);
    expect(x[0]).toBeCloseTo(1, 10);
    expect(x[1]).toBeCloseTo(2, 10);
    expect(x[2]).toBeCloseTo(3, 10);
  });

  it('does not modify its arguments', () => {
    const a = [
      [2, -1],
      [-1, 2],
    ];
    const b = [1, 0];
    const x = solveCholesky(a, b);
    expect(a).toEqual([
      [2, -1],
      [-1, 2],
    ]);
    expect(b).toEqual([1, 0]);
    expect(x[0]).toBeCloseTo(2 / 3, 12);
    expect(x[1]).toBeCloseTo(1 / 3, 12);
  });

  it('gives a small residual on a larger diagonally dominant system', () => {
    const n = 30;
    const a = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? n : 1 / (1 + Math.abs(i - j)))),
    );
    const b = Array.from({ length: n }, (_, i) => Math.sin(i + 1));
    const x = solveCholesky(a, b);
    for (let i = 0; i < n; i++) {
      const ax = a[i]!.reduce((sum, value, j) => sum + value * x[j]!, 0);
      expect(ax).toBeCloseTo(b[i]!, 12);
    }
  });

  it('rejects a matrix that is not positive definite', () => {
    expect(() =>
      solveCholesky(
        [
          [1, 2],
          [2, 1],
        ],
        [1, 1],
      ),
    ).toThrow(/positive definite/);
    expect(() => solveCholesky([[0]], [1])).toThrow(/positive definite/);
    expect(() => solveCholesky([[Number.NaN]], [1])).toThrow(/positive definite/);
  });

  it('rejects mismatched dimensions', () => {
    expect(() => solveCholesky([[1, 0]], [1])).toThrow(/square/);
    expect(() => solveCholesky([[1]], [1, 2])).toThrow(/square/);
  });
});
