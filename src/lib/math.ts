import { Fraction, F } from "./fraction";

// ---------- combinatorics (exact) ----------

const factCache: bigint[] = [1n];
export function factorial(n: number): bigint {
  if (n < 0) throw new RangeError("factorial of negative");
  for (let i = factCache.length; i <= n; i++) factCache[i] = factCache[i - 1] * BigInt(i);
  return factCache[n];
}

export function binom(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n;
  k = Math.min(k, n - k);
  let r = 1n;
  for (let i = 1; i <= k; i++) r = (r * BigInt(n - k + i)) / BigInt(i);
  return r;
}

/** falling factorial n (n-1) ... (n-k+1) */
export function perm(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n;
  let r = 1n;
  for (let i = 0; i < k; i++) r *= BigInt(n - i);
  return r;
}

export function binomPmf(n: number, k: number, p: Fraction): Fraction {
  if (k < 0 || k > n) return Fraction.ZERO;
  return F(binom(n, k)).mul(p.pow(k)).mul(p.comp().pow(n - k));
}

export function harmonic(n: number): Fraction {
  let s = Fraction.ZERO;
  for (let i = 1; i <= n; i++) s = s.add(F(1, i));
  return s;
}

/** Distribution of the sum of `n` fair `sides`-sided dice, as exact probabilities indexed by sum. */
export function diceSumDist(n: number, sides: number): Fraction[] {
  let counts: bigint[] = [1n];
  for (let i = 0; i < n; i++) {
    const next: bigint[] = new Array(counts.length + sides).fill(0n);
    for (let s = 0; s < counts.length; s++) {
      if (counts[s] === 0n) continue;
      for (let f = 1; f <= sides; f++) next[s + f] += counts[s];
    }
    counts = next;
  }
  const total = BigInt(sides) ** BigInt(n);
  return counts.map((c) => F(c, total));
}

// ---------- exact linear algebra ----------

/**
 * Solve A x = b over the rationals by Gauss-Jordan elimination.
 * Throws if the system is singular.
 */
export function solveLinear(A: Fraction[][], b: Fraction[]): Fraction[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = -1;
    for (let r = col; r < n; r++) {
      if (!M[r][col].isZero()) {
        piv = r;
        break;
      }
    }
    if (piv < 0) throw new Error("solveLinear: singular matrix");
    [M[col], M[piv]] = [M[piv], M[col]];
    const pv = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] = M[col][c].div(pv);
    for (let r = 0; r < n; r++) {
      if (r === col || M[r][col].isZero()) continue;
      const f = M[r][col];
      for (let c = col; c <= n; c++) M[r][c] = M[r][c].sub(f.mul(M[col][c]));
    }
  }
  return M.map((row) => row[n]);
}

/**
 * Absorbing / hitting-time solver for a finite Markov chain.
 * P[i] is a sparse map of transitions from state i. `targets` are absorbing.
 * Returns h[i] = E[steps to hit a target from i] (Infinity-free: caller must guarantee absorption).
 */
export function expectedHittingTimes(P: Map<number, Fraction>[], targets: Set<number>): Fraction[] {
  const n = P.length;
  const idx: number[] = [];
  const pos = new Map<number, number>();
  for (let i = 0; i < n; i++) if (!targets.has(i)) {
    pos.set(i, idx.length);
    idx.push(i);
  }
  const m = idx.length;
  const A: Fraction[][] = Array.from({ length: m }, () => new Array(m).fill(Fraction.ZERO));
  const b: Fraction[] = new Array(m).fill(Fraction.ONE);
  for (let r = 0; r < m; r++) {
    const i = idx[r];
    A[r][r] = A[r][r].add(1);
    for (const [j, p] of P[i]) {
      const c = pos.get(j);
      if (c !== undefined) A[r][c] = A[r][c].sub(p);
    }
  }
  const x = m ? solveLinear(A, b) : [];
  return Array.from({ length: n }, (_, i) => (targets.has(i) ? Fraction.ZERO : x[pos.get(i)!]));
}

/** Probability of being absorbed in `win` (subset of absorbing states) from each state. */
export function absorptionProbabilities(P: Map<number, Fraction>[], absorbing: Set<number>, win: Set<number>): Fraction[] {
  const n = P.length;
  const idx: number[] = [];
  const pos = new Map<number, number>();
  for (let i = 0; i < n; i++) if (!absorbing.has(i)) {
    pos.set(i, idx.length);
    idx.push(i);
  }
  const m = idx.length;
  const A: Fraction[][] = Array.from({ length: m }, () => new Array(m).fill(Fraction.ZERO));
  const b: Fraction[] = new Array(m).fill(Fraction.ZERO);
  for (let r = 0; r < m; r++) {
    const i = idx[r];
    A[r][r] = A[r][r].add(1);
    for (const [j, p] of P[i]) {
      const c = pos.get(j);
      if (c !== undefined) A[r][c] = A[r][c].sub(p);
      else if (win.has(j)) b[r] = b[r].add(p);
    }
  }
  const x = m ? solveLinear(A, b) : [];
  return Array.from({ length: n }, (_, i) => (absorbing.has(i) ? (win.has(i) ? Fraction.ONE : Fraction.ZERO) : x[pos.get(i)!]));
}

/** Stationary distribution of an irreducible chain given as dense rows. */
export function stationary(P: Fraction[][]): Fraction[] {
  const n = P.length;
  // pi (P - I) = 0, sum pi = 1  => replace last equation with normalisation
  const A: Fraction[][] = Array.from({ length: n }, () => new Array(n).fill(Fraction.ZERO));
  const b: Fraction[] = new Array(n).fill(Fraction.ZERO);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      A[j][i] = P[i][j].sub(i === j ? 1 : 0);
    }
  }
  for (let i = 0; i < n; i++) A[n - 1][i] = Fraction.ONE;
  b[n - 1] = Fraction.ONE;
  return solveLinear(A, b);
}

// ---------- numeric statistics ----------

export function erf(x: number): number {
  // High-precision erf via series / continued fraction (|err| < 1e-14).
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  if (ax < 2.5) {
    let sum = ax;
    let term = ax;
    const x2 = ax * ax;
    for (let n = 1; n < 200; n++) {
      term *= -x2 / n;
      const add = term / (2 * n + 1);
      sum += add;
      if (Math.abs(add) < 1e-17 * Math.abs(sum)) break;
    }
    return sign * (2 / Math.sqrt(Math.PI)) * sum;
  }
  // erfc continued fraction (Lentz)
  const tiny = 1e-300;
  let f = ax;
  let C = ax;
  let D = 0;
  for (let n = 1; n < 300; n++) {
    const an = n / 2;
    D = ax + an * D;
    D = Math.abs(D) < tiny ? tiny : D;
    C = ax + an / C;
    C = Math.abs(C) < tiny ? tiny : C;
    D = 1 / D;
    const delta = C * D;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  const erfc = Math.exp(-ax * ax) / (f * Math.sqrt(Math.PI));
  return sign * (1 - erfc);
}

export function normCdf(x: number, mu = 0, sigma = 1): number {
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));
}

export function normPdf(x: number, mu = 0, sigma = 1): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

/** Composite Simpson integration. */
export function integrate(f: (x: number) => number, a: number, b: number, n = 4000): number {
  if (n % 2) n++;
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

export function mean(xs: readonly number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function variance(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
}

export function sd(xs: readonly number[]): number {
  return Math.sqrt(variance(xs));
}

export function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n % 2 === 0) return n === 2;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
}

export function primes(count: number): number[] {
  const out: number[] = [];
  for (let k = 2; out.length < count; k++) if (isPrime(k)) out.push(k);
  return out;
}

export function digitSum(n: number): number {
  return String(Math.abs(n)).split("").reduce((a, c) => a + Number(c), 0);
}

export function digitProduct(n: number): number {
  return String(Math.abs(n)).split("").reduce((a, c) => a * Number(c), 1);
}

export function reverseDigits(n: number): number {
  return Number(String(Math.abs(n)).split("").reverse().join("")) * Math.sign(n || 1);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export function range(n: number, start = 0): number[] {
  return Array.from({ length: n }, (_, i) => start + i);
}

/** Cartesian product iterator over `n` coordinates each in [0, base). */
export function* cartesian(n: number, base: number): Generator<number[]> {
  const cur = new Array(n).fill(0);
  if (n === 0) {
    yield [];
    return;
  }
  while (true) {
    yield cur.slice();
    let i = n - 1;
    while (i >= 0 && ++cur[i] === base) {
      cur[i] = 0;
      i--;
    }
    if (i < 0) return;
  }
}

export function* permutations<T>(xs: readonly T[]): Generator<T[]> {
  const a = xs.slice();
  const n = a.length;
  const c = new Array(n).fill(0);
  yield a.slice();
  let i = 0;
  while (i < n) {
    if (c[i] < i) {
      if (i % 2 === 0) [a[0], a[i]] = [a[i], a[0]];
      else [a[c[i]], a[i]] = [a[i], a[c[i]]];
      yield a.slice();
      c[i]++;
      i = 0;
    } else {
      c[i] = 0;
      i++;
    }
  }
}

export function* combinations<T>(xs: readonly T[], k: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length === k) {
    yield acc.slice();
    return;
  }
  for (let i = start; i <= xs.length - (k - acc.length); i++) {
    acc.push(xs[i]);
    yield* combinations(xs, k, i + 1, acc);
    acc.pop();
  }
}
