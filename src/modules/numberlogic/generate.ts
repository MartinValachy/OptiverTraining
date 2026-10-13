import { Fraction, F } from "@/lib/fraction";
import { digitProduct, digitSum } from "@/lib/math";
import { itemRng, type Rng } from "@/lib/rng";
import type { Difficulty, FamilyInfo } from "@/modules/types";
import { applyOp, conflicts, diffs, fitAll, opStr, SPECIAL, type Fit } from "./rules";

export const NL_FAMILIES: FamilyInfo[] = [
  { id: "op_cycle", name: "Operation cycles", blurb: "e.g. −1, +2, ×3, ÷4 repeating" },
  { id: "interleave", name: "Interleaved sequences", blurb: "two sub-sequences alternate" },
  { id: "rec2", name: "Second-order recurrences", blurb: "a(n) = p·a(n−1) + q·a(n−2)" },
  { id: "products", name: "Products of previous terms", blurb: "×, ÷ of earlier terms, ratio patterns" },
  { id: "diff_ladder", name: "Difference ladders", blurb: "1st / 2nd / 3rd differences" },
  { id: "special", name: "Squares, cubes, primes…", blurb: "special sequences with offsets" },
  { id: "digits", name: "Digit rules", blurb: "digit sums and products" },
  { id: "fraction", name: "Fraction sequences", blurb: "numerator and denominator follow separate rules" },
  { id: "alt_sign", name: "Alternating signs", blurb: "sign patterns on top of a simple rule" },
];

export interface NLOption {
  label: string;
  value: string;
}

export interface NLItem {
  family: string;
  difficulty: Difficulty;
  seed: number;
  terms: string[];
  values: string[];
  answer: string;
  answerLabel: string;
  options: NLOption[];
  correctIndex: number;
  rule: string;
  complexity: number;
  derivation: string[];
  hint: string;
}

interface Draft {
  xs: Fraction[];
  next: Fraction;
  complexity: number;
  pairs?: [Fraction, Fraction][];
  nextPair?: [Fraction, Fraction];
  hint: string;
  /** family-specific near-miss predictions */
  near: Fraction[];
}

const Fi = (n: number) => F(n);
const okInts = (xs: Fraction[], max = 5000) => xs.every((x) => x.isInteger() && Math.abs(x.toNumber()) <= max);

function genOpCycle(r: Rng, d: Difficulty): Draft | null {
  const L = d + 1;
  const ops: { kind: "add" | "mul"; v: Fraction }[] = [];
  for (let i = 0; i < L; i++) {
    const t = r.int(0, d === 1 ? 2 : 3);
    if (t <= 1) ops.push({ kind: "add", v: Fi(r.int(1, 9) * (r.chance(0.5) ? 1 : -1)) });
    else if (t === 2) ops.push({ kind: "mul", v: Fi(r.pick([2, 3, -2])) });
    else ops.push({ kind: "mul", v: F(1, r.pick([2, 3, 4])) });
  }
  const n = 2 * L + 1 + (d === 1 ? 1 : 0);
  const xs = [Fi(r.int(2, 30))];
  for (let i = 1; i <= n; i++) xs.push(applyOp(xs[i - 1], ops[(i - 1) % L]));
  if (!okInts(xs, 3000)) return null;
  const shown = xs.slice(0, n);
  const next = xs[n];
  const last = shown[n - 1];
  return {
    xs: shown,
    next,
    complexity: L,
    hint: `Look at the operation between consecutive terms; it repeats every ${L} steps.`,
    near: ops.filter((_, i) => i !== (n - 1) % L).map((o) => applyOp(last, o)),
  };
}

type Sub = { xs: (n: number) => Fraction; name: string; c: number };
function simpleSub(r: Rng, kind: "arith" | "geom" | "poly2"): Sub {
  if (kind === "arith") {
    const a = r.int(1, 30);
    const dd = r.int(2, 9) * (r.chance(0.3) ? -1 : 1);
    return { xs: (n) => Fi(a + n * dd), name: "arith", c: 1 };
  }
  if (kind === "geom") {
    const a = r.int(1, 5);
    const q = r.pick([2, 3]);
    return { xs: (n) => Fi(a * q ** n), name: "geom", c: 1 };
  }
  const a = r.int(1, 9);
  const b = r.int(1, 5);
  const c = r.int(1, 3);
  return { xs: (n) => Fi(a + b * n + c * n * n), name: "poly2", c: 2 };
}

function genInterleave(r: Rng, d: Difficulty): Draft | null {
  const kinds: ("arith" | "geom" | "poly2")[][] = d === 1 ? [["arith", "arith"]] : d === 2 ? [["arith", "geom"], ["geom", "arith"], ["arith", "arith"]] : [["poly2", "arith"], ["geom", "poly2"], ["arith", "poly2"]];
  const [k1, k2] = r.pick(kinds);
  const A = simpleSub(r, k1);
  const B = simpleSub(r, k2);
  const n = r.pick([7, 8]);
  const all = Array.from({ length: n + 2 }, (_, i) => (i % 2 === 0 ? A.xs(i / 2) : B.xs((i - 1) / 2)));
  if (!okInts(all, 3000)) return null;
  const xs = all.slice(0, n);
  return {
    xs,
    next: all[n],
    complexity: 1 + Math.max(A.c, B.c),
    hint: "Split the sequence into odd and even positions.",
    near: [all[n + 1], xs[n - 1].add(xs[n - 1].sub(xs[n - 2]))],
  };
}

function genRec2(r: Rng, d: Difficulty): Draft | null {
  const pq = d === 1 ? [[1, 1]] : d === 2 ? [[1, 2], [2, 1], [1, 1]] : [[2, 1], [1, 2], [3, -1], [1, -2], [2, 2], [3, 1]];
  const [p, q] = r.pick(pq);
  const xs = [Fi(r.int(1, 6)), Fi(r.int(1, 8))];
  for (let i = 2; i < 8; i++) xs.push(Fi(p).mul(xs[i - 1]).add(Fi(q).mul(xs[i - 2])));
  const n = 6;
  if (!okInts(xs, 5000) || xs.slice(0, n).some((x) => x.isZero())) return null;
  const shown = xs.slice(0, n);
  const L = shown[n - 1];
  const P = shown[n - 2];
  return {
    xs: shown,
    next: xs[n],
    complexity: 2,
    hint: "Each term depends on the previous two terms.",
    near: [L.add(P).add(p === 1 && q === 1 ? 1 : 0), Fi(p).mul(L).add(Fi(q).mul(P)).add(L.sub(P)), Fi(q).mul(L).add(Fi(p).mul(P)), L.add(L.sub(P))],
  };
}

function genProducts(r: Rng, d: Difficulty): Draft | null {
  if (d === 1) {
    const [a, b] = r.pick([
      [1, 2],
      [2, 1],
      [1, 3],
      [2, 3],
      [3, 1],
    ]);
    const xs = [Fi(a), Fi(b)];
    for (let i = 2; i < 7; i++) xs.push(xs[i - 1].mul(xs[i - 2]));
    if (!okInts(xs, 100000)) return null;
    const n = 6;
    return { xs: xs.slice(0, n), next: xs[n], complexity: 2, hint: "Combine the previous two terms.", near: [xs[n - 1].mul(2), xs[n - 1].add(xs[n - 2]), xs[n - 1].mul(xs[n - 1])] };
  }
  if (d === 2) {
    const [a, b] = r.pick([
      [2, 3],
      [3, 6],
      [4, 2],
      [2, 5],
      [6, 3],
      [3, 4],
    ]);
    const xs = [Fi(a), Fi(b)];
    for (let i = 2; i < 8; i++) xs.push(xs[i - 1].div(xs[i - 2]));
    const n = r.pick([5, 6]);
    return { xs: xs.slice(0, n), next: xs[n], complexity: 2, hint: "Divide neighbouring terms.", near: [xs[n - 2].div(xs[n - 1]), xs[n - 1].mul(xs[n - 2]), xs[n - 1].inv()] };
  }
  // ratios follow an arithmetic sequence (factorial-like) or products with fractions
  if (r.chance(0.5)) {
    const start = r.int(1, 3);
    const k0 = r.int(1, 3);
    const step = r.pick([1, 2]);
    const xs = [Fi(start)];
    for (let i = 1; i < 7; i++) xs.push(xs[i - 1].mul(k0 + (i - 1) * step));
    if (!okInts(xs, 200000)) return null;
    const n = 6;
    const lastRatio = k0 + (n - 2) * step;
    return { xs: xs.slice(0, n), next: xs[n], complexity: 2, hint: "Look at the ratio between consecutive terms.", near: [xs[n - 1].mul(lastRatio), xs[n - 1].mul(lastRatio + 2 * step), xs[n - 1].add(xs[n - 1].sub(xs[n - 2]))] };
  }
  const [a, b] = r.pick([
    [F(1, 2), F(2)],
    [F(2), F(1, 2)],
    [F(1, 3), F(3)],
    [F(3, 2), F(2)],
    [F(2, 3), F(3)],
  ]);
  const xs = [a, b];
  for (let i = 2; i < 8; i++) xs.push(xs[i - 1].mul(xs[i - 2]));
  const n = 6;
  if (xs.some((x) => x.n > 5000n || x.d > 5000n)) return null;
  return { xs: xs.slice(0, n), next: xs[n], complexity: 2, hint: "Combine the previous two terms.", near: [xs[n - 1].mul(2), xs[n - 1].div(xs[n - 2]), xs[n - 1].add(xs[n - 2])] };
}

function genDiffLadder(r: Rng, d: Difficulty): Draft | null {
  const n = d === 1 ? 5 : 6;
  let xs: Fraction[];
  let complexity: number;
  let hint: string;
  const mode = d === 1 ? "poly2" : d === 2 ? r.pick(["poly2", "diffgeom", "poly3"]) : r.pick(["poly3", "diffspecial", "diffgeom"]);
  if (mode === "poly2" || mode === "poly3") {
    const a = r.int(-5, 20);
    const b = r.int(-4, 6);
    const c = r.int(1, 4) * (r.chance(0.3) ? -1 : 1);
    const e = mode === "poly3" ? r.int(1, 2) : 0;
    xs = Array.from({ length: n + 1 }, (_, i) => Fi(a + b * i + c * i * i + e * i * i * i));
    complexity = mode === "poly2" ? 2 : 3;
    hint = mode === "poly2" ? "Take differences, then differences of differences." : "Keep taking differences until they are constant (it may take three levels).";
  } else if (mode === "diffgeom") {
    const a = r.int(1, 20);
    const d0 = r.int(1, 4);
    const q = r.pick([2, 3]);
    xs = [Fi(a)];
    for (let i = 0; i < n; i++) xs.push(xs[i].add(d0 * q ** i));
    complexity = 2;
    hint = "Look at the differences: they grow by a constant factor.";
  } else {
    const sp = r.pick(SPECIAL.filter((s) => ["sq", "prime", "fib", "tri"].includes(s.id)));
    const s0 = r.int(1, 3);
    xs = [Fi(r.int(1, 20))];
    for (let i = 0; i < n; i++) xs.push(xs[i].add(sp.f(s0 + i)));
    complexity = 3;
    hint = `The differences form a well-known sequence.`;
  }
  if (!okInts(xs, 5000)) return null;
  const shown = xs.slice(0, n);
  const dd = diffs(shown);
  const last = shown[n - 1];
  return {
    xs: shown,
    next: xs[n],
    complexity,
    hint,
    near: [last.add(dd[dd.length - 1]), last.add(dd[dd.length - 1]).add(dd[dd.length - 1].sub(dd[dd.length - 2])).add(1), last.add(dd[dd.length - 1].mul(2))],
  };
}

function genSpecial(r: Rng, d: Difficulty): Draft | null {
  const pool = d === 1 ? ["sq", "tri"] : d === 2 ? ["sq", "cube", "prime", "tri"] : ["cube", "prime", "fib", "fact", "pow2"];
  const spId = r.pick(pool);
  const sp = SPECIAL.find((s) => s.id === spId)!;
  const s0 = r.int(1, d === 1 ? 3 : 5);
  const k = d === 3 ? r.pick([1, 2, 3, -1]) : d === 2 ? r.pick([1, 1, 2]) : 1;
  const c = d === 1 ? r.pick([0, 0, 1, -1, 2]) : r.int(-6, 6);
  const n = 5;
  const raw = Array.from({ length: n + 2 }, (_, i) => k * sp.f(s0 + i) + c);
  if (!raw.every((x) => Number.isSafeInteger(x) && Math.abs(x) <= 5000)) return null;
  const xs = raw.map(Fi);
  return {
    xs: xs.slice(0, n),
    next: xs[n],
    complexity: 2,
    hint: "Compare the terms with squares, cubes, primes or triangular numbers.",
    near: [xs[n + 1], Fi(k * sp.f(s0 + n) + c + 1), xs[n - 1].add(xs[n - 1].sub(xs[n - 2]))],
  };
}

function genDigits(r: Rng, d: Difficulty): Draft | null {
  const prod = d === 3 && r.chance(0.6);
  const xs = [Fi(r.int(d === 1 ? 10 : 12, d === 1 ? 50 : 99))];
  for (let i = 1; i < 7; i++) {
    const v = Number(xs[i - 1].n);
    xs.push(Fi(v + (prod ? digitProduct(v) : digitSum(v))));
  }
  const n = d === 1 ? 5 : 6;
  // must be strictly increasing (a zero digit would freeze a digit-product sequence)
  if (!xs.slice(0, n + 1).every((x, i) => i === 0 || x.gt(xs[i - 1]))) return null;
  const last = Number(xs[n - 1].n);
  return {
    xs: xs.slice(0, n),
    next: xs[n],
    complexity: 2,
    hint: "Look at the digits of each term.",
    near: [Fi(last + (prod ? digitSum(last) : digitProduct(last))), xs[n - 1].add(xs[n - 1].sub(xs[n - 2])), Fi(last + (prod ? digitProduct(last) : digitSum(last)) + 1)],
  };
}

function genFraction(r: Rng, d: Difficulty): Draft | null {
  const mk = (kind: string) => {
    if (kind === "arith") {
      const a = r.int(1, 9);
      const s = r.int(1, 5);
      return (i: number) => a + s * i;
    }
    if (kind === "geom") {
      const a = r.int(1, 4);
      const q = r.pick([2, 3]);
      return (i: number) => a * q ** i;
    }
    if (kind === "sq") {
      const s = r.int(1, 3);
      return (i: number) => (i + s) * (i + s);
    }
    const s = r.int(1, 3);
    return (i: number) => ((i + s) * (i + s + 1)) / 2;
  };
  const [kn, kd] = d === 1 ? ["arith", "arith"] : d === 2 ? r.pick([["arith", "geom"], ["geom", "arith"]]) : r.pick([["sq", "arith"], ["arith", "sq"], ["tri", "geom"], ["geom", "sq"]]);
  const fn = mk(kn);
  const fd = mk(kd);
  const n = 5;
  const pairs: [Fraction, Fraction][] = Array.from({ length: n + 1 }, (_, i) => [Fi(fn(i)), Fi(fd(i))]);
  if (pairs.some(([a, b]) => a.toNumber() > 999 || b.toNumber() > 999 || a.eq(b))) return null;
  const xs = pairs.map(([a, b]) => a.div(b));
  const [nn, nd] = pairs[n];
  const [pn, pd] = pairs[n - 1];
  return {
    xs: xs.slice(0, n),
    next: xs[n],
    complexity: 3,
    pairs: pairs.slice(0, n),
    nextPair: pairs[n],
    hint: "Treat numerators and denominators as two separate sequences.",
    near: [nn.div(pd), pn.div(nd), nd.div(nn), nn.add(nn.sub(pn)).div(nd)],
  };
}

function genAltSign(r: Rng, d: Difficulty): Draft | null {
  const n = d === 1 ? 6 : 7;
  let g: (i: number) => number;
  if (d === 1) {
    const a = r.int(1, 9);
    const s = r.int(2, 7);
    g = (i) => a + s * i;
  } else if (d === 2) {
    if (r.chance(0.5)) {
      const s = r.int(1, 4);
      g = (i) => (i + s) * (i + s);
    } else {
      const a = r.int(1, 5);
      const c = r.int(1, 6);
      g = (i) => a * 2 ** i + c;
    }
  } else {
    const a = r.int(1, 5);
    const b = r.int(1, 4);
    const c = r.int(1, 3);
    g = (i) => a + b * i + c * i * i;
  }
  const s0 = r.chance(0.5) ? 1 : -1;
  const xs = Array.from({ length: n + 1 }, (_, i) => Fi(g(i) * s0 * (i % 2 === 0 ? 1 : -1)));
  if (!okInts(xs, 5000) || xs.some((x) => x.isZero())) return null;
  return {
    xs: xs.slice(0, n),
    next: xs[n],
    complexity: d === 1 ? 2 : 3,
    hint: "Ignore the signs first: what do the absolute values do?",
    near: [xs[n].neg(), xs[n - 1].neg().add(xs[n - 1].sign() > 0 ? -1 : 1), Fi(g(n + 1) * s0 * (n % 2 === 0 ? 1 : -1))],
  };
}

const GENS: Record<string, (r: Rng, d: Difficulty) => Draft | null> = {
  op_cycle: genOpCycle,
  interleave: genInterleave,
  rec2: genRec2,
  products: genProducts,
  diff_ladder: genDiffLadder,
  special: genSpecial,
  digits: genDigits,
  fraction: genFraction,
  alt_sign: genAltSign,
};

function label(x: Fraction): string {
  return x.isInteger() ? x.n.toString() : `${x.n}/${x.d}`;
}

/** Simplest fit that predicts the answer (used as the explained rule). */
const PREF: Record<string, number> = { arith: 0, geom: 0, special: 1, alt: 1, products: 1, digits: 1, pairs: 1, ratio: 2, interleave: 2, cycle: 2, diff: 3, poly: 4, affine: 4, rec2: 3 };

export function explainingFit(dr: { xs: Fraction[]; next: Fraction; pairs?: [Fraction, Fraction][] }): Fit | null {
  const fits = fitAll(dr.xs, dr.pairs).filter((f) => f.next.eq(dr.next));
  fits.sort((a, b) => a.complexity - b.complexity || (PREF[a.kind] ?? 5) - (PREF[b.kind] ?? 5));
  return fits[0] ?? null;
}

export function generateNL(family: string, difficulty: Difficulty, seed: number): NLItem {
  const gen = GENS[family];
  if (!gen) throw new Error(`unknown NumberLogic family ${family}`);
  const r = itemRng("numberlogic", family, difficulty, seed);
  for (let attempt = 0; attempt < 400; attempt++) {
    const dr = gen(r, difficulty);
    if (!dr) continue;
    // all visible terms distinct enough to be a sequence (not constant)
    if (dr.xs.every((x) => x.eq(dr.xs[0]))) continue;
    const fit = explainingFit(dr);
    if (!fit) continue; // the library must recognise the generating rule
    if (conflicts(dr.xs, dr.next, Math.max(dr.complexity, fit.complexity), dr.pairs).length) continue;

    // options: answer + near-miss predictions
    const integerSeq = dr.xs.every((x) => x.isInteger()) && dr.next.isInteger();
    const step = (() => {
      const dd = diffs(dr.xs).map((x) => x.abs()).filter((x) => !x.isZero());
      return dd.length ? dd[dd.length - 1] : F(1);
    })();
    const cand: Fraction[] = [...dr.near];
    for (const f of fitAll(dr.xs.slice(-4))) cand.push(f.next);
    cand.push(dr.next.add(step), dr.next.sub(step), dr.next.add(1), dr.next.sub(1), dr.next.neg(), dr.next.mul(2), dr.next.add(step.mul(2)), dr.next.sub(step.mul(2)));
    const chosen: Fraction[] = [dr.next];
    for (const c of cand) {
      if (chosen.length >= 5) break;
      if (integerSeq && !c.isInteger()) continue;
      if (!integerSeq && dr.pairs && (c.n > 5000n || c.d > 5000n)) continue;
      if (chosen.some((x) => x.eq(c))) continue;
      if (dr.xs.length && c.eq(dr.xs[dr.xs.length - 1])) continue;
      chosen.push(c);
    }
    if (chosen.length < 5) continue;
    const order = r.shuffle([0, 1, 2, 3, 4]);
    const opts = order.map((i) => chosen[i]);
    const pairLabel = (x: Fraction) => {
      if (!dr.pairs || !dr.nextPair) return label(x);
      if (x.eq(dr.next)) return `${dr.nextPair[0]}/${dr.nextPair[1]}`;
      // present distractors in the same unreduced style when they share the answer's denominator
      const num = dr.nextPair[1].mul(x);
      if (num.isInteger()) return `${num}/${dr.nextPair[1]}`;
      return label(x);
    };
    const options = opts.map((x) => ({ label: pairLabel(x), value: x.toString() }));
    if (new Set(options.map((o) => o.label)).size < 5) continue;
    const terms = dr.pairs ? dr.pairs.map(([a, b]) => `${a}/${b}`) : dr.xs.map(label);
    return {
      family,
      difficulty,
      seed,
      terms,
      values: dr.xs.map((x) => x.toString()),
      answer: dr.next.toString(),
      answerLabel: pairLabel(dr.next),
      options,
      correctIndex: opts.findIndex((x) => x.eq(dr.next)),
      rule: fit.rule,
      complexity: fit.complexity,
      derivation: [...fit.explain, ...(fit.kind === "poly" || dr.pairs ? [] : [`(1st differences: ${diffs(dr.xs).map((x) => x.toString()).join(", ")})`]), `Next term: ${pairLabel(dr.next)}.`],
      hint: dr.hint,
    };
  }
  throw new Error(`NumberLogic ${family}/${difficulty}/${seed}: no unique sequence found`);
}

export function scoreNL(item: Pick<NLItem, "correctIndex">, r: number | null) {
  if (r === null || r === undefined) return { correct: null, score: 0 };
  return r === item.correctIndex ? { correct: true, score: 1 } : { correct: false, score: -1 };
}

export { opStr };
