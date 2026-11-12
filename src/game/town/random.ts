/** 32-bit FNV-1a hash of a string. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface Rng {
  /** Uniform in [0, 1). */
  next: () => number;
  /** Uniform in [min, max). */
  range: (min: number, max: number) => number;
  /** Integer in [0, count). */
  int: (count: number) => number;
  /** Shuffles in place (Fisher-Yates) and returns the array. */
  shuffle: <T>(items: T[]) => T[];
}

/** Seeded generator (mulberry32). The same seed always gives the same sequence. */
export function createRng(seed: string): Rng {
  let state = hashString(seed);
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (count: number) => Math.floor(next() * count);
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int,
    shuffle: (items) => {
      for (let i = items.length - 1; i > 0; i--) {
        const j = int(i + 1);
        const held = items[i]!;
        items[i] = items[j]!;
        items[j] = held;
      }
      return items;
    },
  };
}
