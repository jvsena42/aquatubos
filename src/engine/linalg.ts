/**
 * Solves A·x = b for a symmetric positive definite matrix by Cholesky factorisation (A = L·Lᵀ).
 * Only the lower triangle of `a` is read. Neither argument is modified.
 * Throws an Error when the matrix is not positive definite.
 */
export function solveCholesky(a: readonly (readonly number[])[], b: readonly number[]): number[] {
  const n = b.length;
  if (a.length !== n || a.some((row) => row.length !== n)) {
    throw new Error('Linear solve: the matrix must be square and match the right-hand side.');
  }
  const l: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row = new Array<number>(i + 1).fill(0);
    for (let j = 0; j <= i; j++) {
      let sum = a[i]![j]!;
      const other = j < i ? l[j]! : row;
      for (let k = 0; k < j; k++) sum -= row[k]! * other[k]!;
      if (j < i) {
        row[j] = sum / other[j]!;
      } else {
        if (!(sum > 0)) {
          throw new Error('Linear solve: the matrix is not positive definite.');
        }
        row[j] = Math.sqrt(sum);
      }
    }
    l.push(row);
  }
  // Forward substitution L·y = b, then back substitution Lᵀ·x = y.
  const x = b.slice();
  for (let i = 0; i < n; i++) {
    const row = l[i]!;
    let sum = x[i]!;
    for (let k = 0; k < i; k++) sum -= row[k]! * x[k]!;
    x[i] = sum / row[i]!;
  }
  for (let i = n - 1; i >= 0; i--) {
    let sum = x[i]!;
    for (let k = i + 1; k < n; k++) sum -= l[k]![i]! * x[k]!;
    x[i] = sum / l[i]![i]!;
  }
  return x;
}
