// NumberLogic rule library. Every fitter looks at the visible terms and returns the rules (with a
// complexity score) that explain ALL of them, plus the next term each rule predicts. The generator
// uses this library to reject sequences that have a different, comparably simple continuation.

import { Fraction, F } from "@/lib/fraction";
import { digitProduct, digitSum, primes } from "@/lib/math";

export interface Fit {
  kind: string;
  rule: string;
  complexity: number;
  next: Fraction;
  explain: string[];
}

const fstr = (x: Fraction) => x.toString();
const seqStr = (xs: Fraction[]) => xs.map(fstr).join(", ");

export function diffs(xs: Fraction[]): Fraction[] {
  return xs.slice(1).map((x, i) => x.sub(xs[i]));
}
export function ratios(xs: Fraction[]): Fraction[] | null {
  if (xs.slice(0, -1).some((x) => x.isZero())) return null;
  return xs.slice(1).map((x, i) => x.div(xs[i]));
}
const allEq = (xs: Fraction[]) => xs.length > 0 && xs.every((x) => x.eq(xs[0]));
const nice = (x: Fraction, maxDen = 2n, maxAbs = 1000) => x.d <= maxDen && Math.abs(x.toNumber()) <= maxAbs;

// ---------- basic fitters ----------

export function fitArith(xs: Fraction[]): Fit[] {
  if (xs.length < 3) return [];
  const d = diffs(xs);
  if (!allEq(d) || d[0].isZero()) return [];
  return [{ kind: "arith", rule: `add ${fstr(d[0])} each step`, complexity: 1, next: xs[xs.length - 1].add(d[0]), explain: [`Differences: ${seqStr(d)} (constant ${fstr(d[0])}).`] }];
}

export function fitGeom(xs: Fraction[]): Fit[] {
  if (xs.length < 3) return [];
  const r = ratios(xs);
  if (!r || !allEq(r) || r[0].eq(1) || r[0].isZero()) return [];
  return [{ kind: "geom", rule: `multiply by ${fstr(r[0])} each step`, complexity: 1, next: xs[xs.length - 1].mul(r[0]), explain: [`Ratios: ${seqStr(r)} (constant ${fstr(r[0])}).`] }];
}

export function fitPoly(xs: Fraction[], deg: number): Fit[] {
  if (xs.length < deg + 2) return [];
  const table: Fraction[][] = [xs];
  for (let k = 0; k < deg; k++) table.push(diffs(table[table.length - 1]));
  const top = table[deg];
  if (!allEq(top) || top[0].isZero()) return [];
  if (allEq(table[deg - 1])) return []; // lower degree
  let next = top[0];
  for (let k = deg - 1; k >= 0; k--) next = table[k][table[k].length - 1].add(next);
  const names = ["", "1st", "2nd", "3rd"];
  return [
    {
      kind: "poly",
      rule: `${names[deg]} differences constant (${deg === 2 ? "quadratic" : "cubic"})`,
      complexity: deg,
      next,
      explain: table.slice(1).map((row, i) => `${names[i + 1]} differences: ${seqStr(row)}`),
    },
  ];
}

export function fitAffine(xs: Fraction[]): Fit[] {
  if (xs.length < 4 || xs[1].eq(xs[0])) return [];
  const r = xs[2].sub(xs[1]).div(xs[1].sub(xs[0]));
  const c = xs[1].sub(r.mul(xs[0]));
  if (r.eq(1) || r.isZero() || c.isZero()) return [];
  if (!nice(r, 2n, 6) || !nice(c, 2n, 1000)) return [];
  for (let i = 1; i < xs.length; i++) if (!xs[i].eq(r.mul(xs[i - 1]).add(c))) return [];
  return [
    {
      kind: "affine",
      rule: `multiply by ${fstr(r)} then ${c.sign() > 0 ? "add" : "subtract"} ${fstr(c.abs())}`,
      complexity: 2,
      next: r.mul(xs[xs.length - 1]).add(c),
      explain: [`Each term = ${fstr(r)} × previous ${c.sign() > 0 ? "+" : "−"} ${fstr(c.abs())}.`],
    },
  ];
}

export function fitRec2(xs: Fraction[]): Fit[] {
  if (xs.length < 5) return [];
  const [x0, x1, x2, x3] = xs;
  const det = x1.mul(x1).sub(x0.mul(x2));
  if (det.isZero()) return [];
  const p = x2.mul(x1).sub(x0.mul(x3)).div(det);
  const q = x1.mul(x3).sub(x2.mul(x2)).div(det);
  if (!p.isInteger() || !q.isInteger() || q.isZero()) return [];
  if (Math.abs(p.toNumber()) > 3 || Math.abs(q.toNumber()) > 3) return [];
  for (let i = 2; i < xs.length; i++) if (!xs[i].eq(p.mul(xs[i - 1]).add(q.mul(xs[i - 2])))) return [];
  const n = xs.length;
  const term = (c: Fraction, s: string) => (c.eq(1) ? s : c.eq(-1) ? `−${s}` : `${fstr(c)}·${s}`);
  return [
    {
      kind: "rec2",
      rule: `a(n) = ${term(p, "a(n−1)")} ${q.sign() > 0 ? "+" : "−"} ${term(q.abs(), "a(n−2)")}`,
      complexity: 2,
      next: p.mul(xs[n - 1]).add(q.mul(xs[n - 2])),
      explain: [`Check: ${fstr(xs[2])} = ${fstr(p)}·${fstr(x1)} + ${fstr(q)}·${fstr(x0)}, and so on.`],
    },
  ];
}

export function fitProducts(xs: Fraction[]): Fit[] {
  if (xs.length < 4) return [];
  const out: Fit[] = [];
  const n = xs.length;
  let ok = true;
  for (let i = 2; i < n; i++) if (!xs[i].eq(xs[i - 1].mul(xs[i - 2]))) ok = false;
  if (ok && !xs.slice(0, 2).every((x) => x.eq(1) || x.isZero()))
    out.push({ kind: "products", rule: "each term is the product of the previous two", complexity: 2, next: xs[n - 1].mul(xs[n - 2]), explain: [`${fstr(xs[2])} = ${fstr(xs[1])} × ${fstr(xs[0])}, …`] });
  ok = xs.slice(0, -1).every((x) => !x.isZero());
  if (ok) for (let i = 2; i < n; i++) if (!xs[i].eq(xs[i - 1].div(xs[i - 2]))) ok = false;
  if (ok && !xs[n - 2].isZero())
    out.push({ kind: "products", rule: "each term is the previous divided by the one before it", complexity: 2, next: xs[n - 1].div(xs[n - 2]), explain: [`${fstr(xs[2])} = ${fstr(xs[1])} ÷ ${fstr(xs[0])}, …`] });
  return out;
}

// ---------- special sequences ----------

const PR = primes(40);
const FIB = [1, 1];
while (FIB.length < 40) FIB.push(FIB[FIB.length - 1] + FIB[FIB.length - 2]);
export const SPECIAL: { id: string; name: string; f: (n: number) => number }[] = [
  { id: "sq", name: "n²", f: (n) => n * n },
  { id: "cube", name: "n³", f: (n) => n * n * n },
  { id: "tri", name: "triangular numbers n(n+1)/2", f: (n) => (n * (n + 1)) / 2 },
  { id: "prime", name: "the primes", f: (n) => PR[n - 1] },
  { id: "pow2", name: "2ⁿ", f: (n) => 2 ** n },
  { id: "fact", name: "n!", f: (n) => Array.from({ length: n }, (_, i) => i + 1).reduce((a, b) => a * b, 1) },
  { id: "fib", name: "the Fibonacci numbers", f: (n) => FIB[n - 1] },
];

export function fitSpecial(xs: Fraction[], minComplexity = 2): Fit[] {
  if (xs.length < 4) return [];
  const out: Fit[] = [];
  for (const sp of SPECIAL) {
    for (let s = 1; s <= 6; s++) {
      const fv = (i: number) => sp.f(s + i);
      if (!Number.isSafeInteger(fv(xs.length))) continue;
      let j = 1;
      while (j < xs.length && fv(j) === fv(0)) j++;
      if (j >= xs.length) continue;
      const k = xs[j].sub(xs[0]).div(fv(j) - fv(0));
      const c = xs[0].sub(k.mul(fv(0)));
      if (k.isZero() || !k.isInteger() || Math.abs(k.toNumber()) > 6 || !c.isInteger()) continue;
      let ok = true;
      for (let i = 0; i < xs.length; i++) if (!xs[i].eq(k.mul(fv(i)).add(c))) ok = false;
      if (!ok) continue;
      const kk = k.eq(1) ? "" : k.eq(-1) ? "−" : `${fstr(k)}×`;
      const cc = c.isZero() ? "" : c.sign() > 0 ? ` + ${fstr(c)}` : ` − ${fstr(c.abs())}`;
      out.push({
        kind: "special",
        rule: `${kk}(${sp.name}, starting at n = ${s})${cc}`,
        complexity: minComplexity,
        next: k.mul(fv(xs.length)).add(c),
        explain: [`Terms = ${kk}f(n)${cc} with f = ${sp.name}: f(${s}..${s + xs.length - 1}) = ${xs.map((_, i) => fv(i)).join(", ")}.`],
      });
    }
  }
  return out;
}

export function fitDigits(xs: Fraction[]): Fit[] {
  if (xs.length < 4 || !xs.every((x) => x.isInteger() && x.sign() > 0)) return [];
  const v = xs.map((x) => Number(x.n));
  const out: Fit[] = [];
  const last = v[v.length - 1];
  if (v.slice(1).every((x, i) => x === v[i] + digitSum(v[i])))
    out.push({ kind: "digits", rule: "add the digit sum of the previous term", complexity: 2, next: F(last + digitSum(last)), explain: v.slice(0, 3).map((x) => `${x} + (${String(x).split("").join("+")}) = ${x + digitSum(x)}`) });
  if (v.slice(1).every((x, i) => x === v[i] + digitProduct(v[i])) && v.some((x) => digitProduct(x) > 1))
    out.push({ kind: "digits", rule: "add the product of the digits of the previous term", complexity: 2, next: F(last + digitProduct(last)), explain: v.slice(0, 3).map((x) => `${x} + (${String(x).split("").join("×")}) = ${x + digitProduct(x)}`) });
  if (v.slice(1).every((x, i) => x === Number(String(v[i]).split("").reverse().join("")) + 1) && v.length >= 4)
    out.push({ kind: "digits", rule: "reverse the digits, then add 1", complexity: 3, next: F(Number(String(last).split("").reverse().join("")) + 1), explain: [] });
  return out;
}

// ---------- composite fitters ----------

function baseFits(xs: Fraction[]): Fit[] {
  const out = [...fitArith(xs), ...fitGeom(xs), ...fitPoly(xs, 2)];
  if (xs.length >= 3 && allEq(xs)) out.push({ kind: "const", rule: `constant ${fstr(xs[0])}`, complexity: 0, next: xs[0], explain: [] });
  return out;
}

export function fitInterleave(xs: Fraction[]): Fit[] {
  if (xs.length < 6) return [];
  const ev = xs.filter((_, i) => i % 2 === 0);
  const od = xs.filter((_, i) => i % 2 === 1);
  const fe = baseFits(ev);
  const fo = baseFits(od);
  if (!fe.length || !fo.length) return [];
  const out: Fit[] = [];
  const target = xs.length % 2 === 0 ? fe : fo;
  const other = xs.length % 2 === 0 ? fo : fe;
  for (const t of target)
    for (const o of other) {
      out.push({
        kind: "interleave",
        rule: `two interleaved sequences: positions 1,3,5,… ${(xs.length % 2 === 0 ? t : o).rule}; positions 2,4,6,… ${(xs.length % 2 === 0 ? o : t).rule}`,
        complexity: 1 + Math.max(t.complexity, o.complexity, 1),
        next: t.next,
        explain: [`Odd positions: ${seqStr(ev)}.`, `Even positions: ${seqStr(od)}.`, `Next term continues the ${xs.length % 2 === 0 ? "odd" : "even"}-position sequence.`],
      });
    }
  return out;
}

type Op = { kind: "add" | "mul"; v: Fraction };
export function opStr(op: Op): string {
  if (op.kind === "add") return op.v.sign() >= 0 ? `+${fstr(op.v)}` : `−${fstr(op.v.abs())}`;
  if (op.v.isInteger()) return op.v.sign() >= 0 ? `×${fstr(op.v)}` : `×(${fstr(op.v)})`;
  if (op.v.n === 1n) return `÷${op.v.d}`;
  if (op.v.n === -1n) return `÷(−${op.v.d})`;
  return `×${fstr(op.v)}`;
}
export function applyOp(x: Fraction, op: Op): Fraction {
  return op.kind === "add" ? x.add(op.v) : x.mul(op.v);
}
const opEq = (a: Op, b: Op) => a.kind === b.kind && a.v.eq(b.v);

export function fitOpCycle(xs: Fraction[], L: number): Fit[] {
  const T = xs.length - 1;
  if (T < 2 * L) return [];
  const ops: Op[] = [];
  for (let j = 0; j < L; j++) {
    const pairs: [Fraction, Fraction][] = [];
    for (let t = j; t < T; t += L) pairs.push([xs[t], xs[t + 1]]);
    const ds = pairs.map(([a, b]) => b.sub(a));
    if (allEq(ds)) {
      ops.push({ kind: "add", v: ds[0] });
      continue;
    }
    if (pairs.some(([a]) => a.isZero())) return [];
    const rs = pairs.map(([a, b]) => b.div(a));
    if (allEq(rs)) {
      ops.push({ kind: "mul", v: rs[0] });
      continue;
    }
    return [];
  }
  // must be minimal: not periodic with a smaller period dividing L
  for (let p = 1; p < L; p++) if (L % p === 0 && ops.every((o, i) => opEq(o, ops[i % p]))) return [];
  if (ops.some((o) => (o.kind === "mul" && o.v.eq(1)) || (o.kind === "add" && o.v.isZero()))) return [];
  const nextOp = ops[T % L];
  return [
    {
      kind: "cycle",
      rule: `repeating operations ${ops.map(opStr).join(", ")}`,
      complexity: L,
      next: applyOp(xs[T], nextOp),
      explain: [`Steps: ${xs.slice(1).map((x, i) => opStr(ops[i % L])).join(", ")}.`, `Next step is ${opStr(nextOp)}: ${fstr(xs[T])} → ${fstr(applyOp(xs[T], nextOp))}.`],
    },
  ];
}

export function fitAltSign(xs: Fraction[]): Fit[] {
  if (xs.length < 4 || xs.some((x) => x.isZero())) return [];
  const sg = xs.map((x) => x.sign());
  if (!sg.slice(1).every((s, i) => s === -sg[i])) return [];
  const abs = xs.map((x) => x.abs());
  const inner = [...baseFits(abs), ...fitSpecial(abs, 2)];
  const nextSign = -sg[sg.length - 1];
  return inner
    .filter((f) => f.complexity > 0)
    .map((f) => ({
      kind: "alt",
      rule: `alternating signs on |terms| that ${f.rule}`,
      complexity: f.complexity + 1,
      next: f.next.mul(nextSign),
      explain: [`Signs alternate; absolute values: ${seqStr(abs)}.`, ...f.explain],
    }));
}

export function fitDiffSeq(xs: Fraction[]): Fit[] {
  if (xs.length < 5) return [];
  const d = diffs(xs);
  const last = xs[xs.length - 1];
  const out: Fit[] = [];
  for (const f of [...fitGeom(d), ...fitSpecial(d, 2), ...fitOpCycle(d, 2)]) {
    out.push({ kind: "diff", rule: `differences ${f.rule}`, complexity: f.complexity + 1, next: last.add(f.next), explain: [`Differences: ${seqStr(d)}.`, ...f.explain] });
  }
  return out;
}

export function fitRatioSeq(xs: Fraction[]): Fit[] {
  if (xs.length < 5) return [];
  const r = ratios(xs);
  if (!r) return [];
  const last = xs[xs.length - 1];
  return [...fitArith(r)].map((f) => ({ kind: "ratio", rule: `ratios ${f.rule}`, complexity: 2, next: last.mul(f.next), explain: [`Ratios: ${seqStr(r)}.`, ...f.explain] }));
}

export function fitPairs(pairs: [Fraction, Fraction][]): Fit[] {
  if (pairs.length < 4) return [];
  const nums = pairs.map((p) => p[0]);
  const dens = pairs.map((p) => p[1]);
  const fn = [...baseFits(nums), ...fitSpecial(nums, 2)];
  const fd = [...baseFits(dens), ...fitSpecial(dens, 2)];
  const out: Fit[] = [];
  for (const a of fn)
    for (const b of fd) {
      if (b.next.isZero()) continue;
      out.push({
        kind: "pairs",
        rule: `numerators ${a.rule}; denominators ${b.rule}`,
        complexity: 1 + Math.max(a.complexity, b.complexity, 1),
        next: a.next.div(b.next),
        explain: [`Numerators: ${seqStr(nums)}.`, `Denominators: ${seqStr(dens)}.`, `Next: ${fstr(a.next)}/${fstr(b.next)}.`],
      });
    }
  return out;
}

/** Run the whole library. */
export function fitAll(xs: Fraction[], pairs?: [Fraction, Fraction][]): Fit[] {
  const out = [
    ...fitArith(xs),
    ...fitGeom(xs),
    ...fitPoly(xs, 2),
    ...fitPoly(xs, 3),
    ...fitAffine(xs),
    ...fitRec2(xs),
    ...fitProducts(xs),
    ...fitSpecial(xs),
    ...fitDigits(xs),
    ...fitInterleave(xs),
    ...fitOpCycle(xs, 2),
    ...fitOpCycle(xs, 3),
    ...fitOpCycle(xs, 4),
    ...fitAltSign(xs),
    ...fitDiffSeq(xs),
    ...fitRatioSeq(xs),
  ];
  if (pairs) out.push(...fitPairs(pairs));
  return out;
}

/** Fits whose complexity is comparable to `c` but that predict something other than `answer`. */
export function conflicts(xs: Fraction[], answer: Fraction, c: number, pairs?: [Fraction, Fraction][]): Fit[] {
  return fitAll(xs, pairs).filter((f) => f.complexity <= c + 1 && !f.next.eq(answer));
}
