import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, nextInt, pick, seedFromString } from '../src/core/rng.ts';

describe('seeded rng', () => {
  it('same seed → same sequence', () => {
    const a = createRng(42);
    const b = createRng(42);
    const xs = Array.from({ length: 50 }, () => nextFloat(a));
    const ys = Array.from({ length: 50 }, () => nextFloat(b));
    expect(xs).toEqual(ys);
  });

  it('different seeds diverge', () => {
    expect(nextFloat(createRng(1))).not.toBe(nextFloat(createRng(2)));
  });

  it('state round-trips through JSON (saves can resume a sequence)', () => {
    const a = createRng(7);
    nextFloat(a);
    const b = JSON.parse(JSON.stringify(a));
    expect(nextFloat(a)).toBe(nextFloat(b));
  });

  it('nextInt stays within bounds and hits both ends', () => {
    const r = createRng(seedFromString('bounds'));
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const n = nextInt(r, 3, 6);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
      seen.add(n);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('pick is deterministic', () => {
    expect(pick(createRng(9), ['a', 'b', 'c'])).toBe(pick(createRng(9), ['a', 'b', 'c']));
  });
});
