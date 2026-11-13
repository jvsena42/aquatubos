import { createRng, hashString } from './random';

describe('seeded random numbers', () => {
  it('hashes strings to stable unsigned integers', () => {
    // FNV-1a of the empty string is the offset basis.
    expect(hashString('')).toBe(0x811c9dc5);
    expect(hashString('stage1')).toBe(hashString('stage1'));
    expect(hashString('stage1')).not.toBe(hashString('stage2'));
  });

  it('repeats the sequence of a seed and differs between seeds', () => {
    const a = createRng('seed');
    const b = createRng('seed');
    const c = createRng('other');
    const first = Array.from({ length: 20 }, () => a.next());
    expect(Array.from({ length: 20 }, () => b.next())).toEqual(first);
    expect(Array.from({ length: 20 }, () => c.next())).not.toEqual(first);
    for (const value of first) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('draws ranges and integers inside their limits', () => {
    const rng = createRng('limits');
    for (let i = 0; i < 200; i++) {
      const value = rng.range(5, 8);
      expect(value).toBeGreaterThanOrEqual(5);
      expect(value).toBeLessThan(8);
      const index = rng.int(3);
      expect([0, 1, 2]).toContain(index);
    }
  });

  it('shuffles without losing items', () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    const shuffled = createRng('shuffle').shuffle([...items]);
    expect(shuffled).not.toEqual(items);
    expect([...shuffled].sort((p, q) => p - q)).toEqual(items);
    expect(createRng('shuffle').shuffle([...items])).toEqual(shuffled);
  });
});
