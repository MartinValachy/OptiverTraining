// Seeded RNG (mulberry32) plus helpers. Every generator takes an Rng so any item can be
// reproduced from (module, family, difficulty, seed).

export type Rng = {
  /** uniform in [0, 1) */
  next(): number;
  /** integer in [lo, hi] inclusive */
  int(lo: number, hi: number): number;
  pick<T>(xs: readonly T[]): T;
  shuffle<T>(xs: readonly T[]): T[];
  chance(p: number): boolean;
  /** standard normal */
  normal(): number;
  weighted<T>(xs: readonly T[], weights: readonly number[]): T;
  /** k distinct elements */
  sample<T>(xs: readonly T[], k: number): T[];
};

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit hash of a string. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function seedFor(...parts: (string | number)[]): number {
  return hashString(parts.join("|"));
}

export function makeRng(seed: number): Rng {
  const u = mulberry32(seed);
  let spare: number | null = null;
  const rng: Rng = {
    next: u,
    int(lo, hi) {
      return lo + Math.floor(u() * (hi - lo + 1));
    },
    pick(xs) {
      if (xs.length === 0) throw new Error("pick from empty");
      return xs[Math.floor(u() * xs.length)];
    },
    shuffle(xs) {
      const a = xs.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(u() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    chance(p) {
      return u() < p;
    },
    normal() {
      if (spare !== null) {
        const s = spare;
        spare = null;
        return s;
      }
      let x = 0;
      let y = 0;
      let r = 0;
      do {
        x = u() * 2 - 1;
        y = u() * 2 - 1;
        r = x * x + y * y;
      } while (r === 0 || r >= 1);
      const f = Math.sqrt((-2 * Math.log(r)) / r);
      spare = y * f;
      return x * f;
    },
    weighted(xs, weights) {
      const total = weights.reduce((a, b) => a + b, 0);
      let r = u() * total;
      for (let i = 0; i < xs.length; i++) {
        r -= weights[i];
        if (r < 0) return xs[i];
      }
      return xs[xs.length - 1];
    },
    sample(xs, k) {
      return rng.shuffle(xs).slice(0, k);
    },
  };
  return rng;
}

/** Rng for a specific item: reproducible from its identity tuple. */
export function itemRng(module: string, family: string, difficulty: number, seed: number): Rng {
  return makeRng(seedFor(module, family, difficulty, seed));
}

export function randomSeed(): number {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 2 ** 32);
}
