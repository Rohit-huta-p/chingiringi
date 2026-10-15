/**
 * Deterministic shuffle: the same (array, seed) always produces the same order.
 *
 * Used for the live feed so the order is randomized per visit but STABLE across
 * the 30s react-query refetch — the screen holds one seed for its lifetime, so
 * polling never reorders cards under the user. A fresh mount picks a new seed.
 *
 * Fisher–Yates driven by a mulberry32 PRNG (tiny, no deps, good-enough spread).
 */
export function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const a = arr.slice();
  let s = (seed >>> 0) || 1; // avoid a zero state
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A fresh random seed — call once per screen mount (e.g. in a useState initializer). */
export function makeShuffleSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
}
