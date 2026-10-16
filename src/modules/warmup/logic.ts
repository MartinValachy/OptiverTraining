// Mental math in the style of Optiver's "80 in 8": +, −, ×, ÷ on integers, decimals and fractions,
// including missing-number forms ("66 × ? = 138.6"). Also the classic Zetamac default ranges.
// Every answer is exact (Fraction); nothing produces a negative number, so answers can be typed on
// a phone's decimal keypad.

import { Fraction, F } from "@/lib/fraction";
import { itemRng, makeRng, seedFor, type Rng } from "@/lib/rng";
import type { Difficulty, FamilyInfo, ItemKey } from "@/modules/types";

export const WARMUP_FAMILIES: FamilyInfo[] = [
  { id: "add", name: "Addition", blurb: "integers and decimals" },
  { id: "sub", name: "Subtraction", blurb: "integers and decimals" },
  { id: "mul", name: "Multiplication", blurb: "2-digit × 2-digit, decimals" },
  { id: "div", name: "Division", blurb: "exact, including by decimals" },
  { id: "frac", name: "Fractions", blurb: "of a number, + and ×" },
  { id: "missing", name: "Missing number", blurb: "66 × ? = 138.6" },
];

/** Share of each family in an 80-in-8 style mix. */
export const EIGHTY_WEIGHTS: Record<string, number> = { add: 15, sub: 15, mul: 25, div: 15, frac: 15, missing: 15 };

export interface WarmupItem {
  family: string;
  difficulty: Difficulty;
  seed: number;
  /** e.g. "37 × 13", "66 × ? = 138.6", "7/8 of 312" */
  prompt: string;
  /** exact answer as a fraction string */
  answer: string;
  /** answer as it is displayed (decimal or a/b) */
  display: string;
  /** answer is a non-negative terminating decimal with ≤ 3 dp (typeable on a decimal keypad) */
  typeable: boolean;
  /** four multiple-choice labels and their exact values */
  options: string[];
  optionValues: string[];
  correctIndex: number;
  /** one-line method for the worked solution */
  method: string;
}

// ---------- formatting ----------

function decimals(f: Fraction): number | null {
  let d = f.d;
  let k = 0;
  let twos = 0;
  let fives = 0;
  while (d % 2n === 0n) {
    d /= 2n;
    twos++;
  }
  while (d % 5n === 0n) {
    d /= 5n;
    fives++;
  }
  if (d !== 1n) return null;
  k = Math.max(twos, fives);
  return k;
}

/** Decimal string when terminating, otherwise a/b (improper). */
export function fmt(f: Fraction): string {
  const dp = decimals(f);
  if (dp === null) return `${f.n}/${f.d}`;
  if (dp === 0) return f.n.toString();
  const neg = f.n < 0n;
  const scaled = (neg ? -f.n : f.n) * 10n ** BigInt(dp) / f.d;
  const s = scaled.toString().padStart(dp + 1, "0");
  return `${neg ? "-" : ""}${s.slice(0, -dp)}.${s.slice(-dp)}`;
}

const dec = (n: number, dp: number) => F(n, 10 ** dp);

/** a/b in lowest terms (integers stay integers). */
export function fracStr(f: Fraction): string {
  return f.isInteger() ? f.n.toString() : `${f.n}/${f.d}`;
}

// ---------- families ----------

type Gen = { prompt: string; ans: Fraction; method: string; mistakes: Fraction[]; fractionForm?: boolean };

function genAdd(r: Rng, d: Difficulty): Gen {
  if (d === 1 || r.chance(0.5)) {
    const a = r.int(d === 1 ? 20 : 100, d === 3 ? 9999 : 999);
    const b = r.int(10, d === 1 ? 99 : 999);
    const ans = F(a + b);
    return { prompt: `${a} + ${b}`, ans, method: `${a} + ${b} = ${a + b}`, mistakes: [ans.sub(10), ans.add(10), ans.sub(100)] };
  }
  const dpA = r.int(1, 2);
  const dpB = r.int(1, 2);
  const a = dec(r.int(10, d === 3 ? 99999 : 9999), dpA);
  const b = dec(r.int(10, 9999), dpB);
  const ans = a.add(b);
  return { prompt: `${fmt(a)} + ${fmt(b)}`, ans, method: "Line up the decimal points.", mistakes: [a.add(b.mul(10)), a.mul(10).add(b), ans.add(1)] };
}

function genSub(r: Rng, d: Difficulty): Gen {
  if (d === 1 || r.chance(0.45)) {
    const a = r.int(d === 1 ? 50 : 200, d === 3 ? 9999 : 1000);
    const b = r.int(10, a - 5);
    const ans = F(a - b);
    return { prompt: `${a} − ${b}`, ans, method: `${a} − ${b} = ${a - b}`, mistakes: [ans.add(10), ans.sub(10), ans.add(2)] };
  }
  const a = r.chance(0.4) ? F(r.pick([100, 500, 1000, 250])) : dec(r.int(1000, d === 3 ? 99999 : 9999), r.int(1, 2));
  const b = dec(r.int(10, Math.floor(a.toNumber() * 95)), 2);
  if (!b.lt(a)) return genSub(r, d);
  const ans = a.sub(b);
  return { prompt: `${fmt(a)} − ${fmt(b)}`, ans, method: "Count up from the smaller number, or borrow carefully across the decimal point.", mistakes: [ans.add(1), ans.sub(dec(1, 2)).abs(), ans.add(dec(1, 1))] };
}

function genMul(r: Rng, d: Difficulty): Gen {
  const kind = d === 1 ? r.pick(["int", "friendly"]) : r.pick(["int", "friendly", "dec", "dec"]);
  if (kind === "int") {
    const a = r.int(11, d === 3 ? 99 : 49);
    const b = r.int(11, d === 1 ? 19 : 99);
    const ans = F(a * b);
    return { prompt: `${a} × ${b}`, ans, method: `${a} × ${b} = ${a} × ${b - (b % 10)} + ${a} × ${b % 10}`, mistakes: [F(a * (b + 1)), F(a * (b - 1)), F((a + 1) * b)] };
  }
  if (kind === "friendly") {
    const f = r.pick([25, 50, 125, 15, 75]);
    const a = r.int(4, d === 3 ? 96 : 48) * (f === 125 ? 1 : 2);
    const ans = F(a * f);
    return {
      prompt: `${a} × ${f}`,
      ans,
      method: f === 25 ? `× 25 = × 100 ÷ 4` : f === 125 ? `× 125 = × 1000 ÷ 8` : f === 50 ? `× 50 = × 100 ÷ 2` : `${a} × ${f} = ${a} × ${f - 5} + ${a} × 5`,
      mistakes: [ans.add(f), ans.sub(f), ans.mul(10)],
    };
  }
  // decimal × number with a tidy product, like 0.35 × 480 or 2.5 × 3.6
  const NICE_2DP = ["0.05", "0.15", "0.25", "0.35", "0.45", "0.75", "0.125", "0.12", "0.24", "0.65"];
  const NICE_1DP = ["0.2", "0.4", "0.6", "0.8", "1.2", "1.5", "2.5", "3.5", "4.5", "0.3"];
  const twoDp = r.chance(0.5);
  const a = Fraction.parse(r.pick(twoDp ? NICE_2DP : NICE_1DP));
  const b = twoDp ? F(r.int(2, d === 3 ? 99 : 49) * r.pick([4, 8, 10, 20])) : dec(r.int(12, d === 3 ? 96 : 48), 1);
  const ans = a.mul(b);
  if ((decimals(ans) ?? 9) > 2 || ans.toNumber() >= 10000) return genMul(r, d);
  return { prompt: `${fmt(a)} × ${fmt(b)}`, ans, method: `Multiply as integers, then place the decimal point (${(decimals(a) ?? 0) + (decimals(b) ?? 0)} places).`, mistakes: [ans.mul(10), ans.div(10), ans.add(a)] };
}

function genDiv(r: Rng, d: Difficulty): Gen {
  if (d === 1 || r.chance(0.5)) {
    let b = r.int(d === 1 ? 3 : 6, d === 3 ? 48 : 25);
    if (b % 10 === 0) b += 1 + r.int(0, 2); // ÷10 and ÷20 are too easy
    const q = r.int(d === 1 ? 11 : 12, d === 3 ? 250 : 150);
    const ans = F(q);
    return { prompt: `${b * q} ÷ ${b}`, ans, method: `${b} × ${q} = ${b * q}`, mistakes: [F(q + 1), F(q - 1), F(q + 10)] };
  }
  // division by a decimal: 14.4 ÷ 0.6 = 24
  const b = r.chance(0.5) ? dec(r.int(2, 9), 1) : dec(r.int(12, 45), 1);
  const q = r.chance(0.6) ? F(r.int(6, 80)) : dec(r.int(12, 95), 1);
  const a = b.mul(q);
  if ((decimals(a) ?? 9) > 3) return genDiv(r, d);
  return { prompt: `${fmt(a)} ÷ ${fmt(b)}`, ans: q, method: `Scale both by 10: ${fmt(a.mul(10))} ÷ ${fmt(b.mul(10))}.`, mistakes: [q.mul(10), q.div(10), q.add(1)] };
}

function genFrac(r: Rng, d: Difficulty): Gen {
  const kind = d === 1 ? "of" : r.pick(["of", "of", "add", "mul"]);
  if (kind === "of") {
    const b = r.pick([3, 4, 5, 6, 8, 12, 16, 20]);
    let a = r.int(1, b - 1);
    while (F(a, b).d !== BigInt(b)) a = r.int(1, b - 1);
    const n = b * r.int(d === 1 ? 3 : 6, d === 3 ? 60 : 30);
    const ans = F(a * n, b);
    return { prompt: `${a}/${b} of ${n}`, ans, method: `${n} ÷ ${b} = ${n / b}, × ${a} = ${fmt(ans)}`, mistakes: [F(n, b), F(n - n / b), ans.add(n / b)] };
  }
  const dens = [2, 3, 4, 5, 6, 8, 10, 12];
  const b = r.pick(dens);
  const e = r.pick(dens);
  const coprime = (den: number) => {
    let x = r.int(1, den - 1);
    while (F(x, den).d !== BigInt(den)) x = r.int(1, den - 1);
    return x;
  };
  const a = coprime(b);
  const c = coprime(e);
  const x = F(a, b);
  const y = F(c, e);
  if (kind === "add") {
    const ans = x.add(y);
    return { prompt: `${a}/${b} + ${c}/${e}`, ans, fractionForm: true, method: `Common denominator ${ans.d}: ${fracStr(ans)}`, mistakes: [F(a + c, b + e), F(a * e + c * b, b * e * 2), ans.add(F(1, Number(ans.d)))] };
  }
  const ans = x.mul(y);
  return { prompt: `${a}/${b} × ${c}/${e}`, ans, fractionForm: true, method: `Multiply tops and bottoms, then simplify: ${fracStr(ans)}`, mistakes: [F(a * e, b * c), x.add(y), ans.add(F(1, Number(ans.d)))] };
}

function genMissing(r: Rng, d: Difficulty): Gen {
  const kind = r.pick(d === 1 ? ["mul", "add"] : ["mul", "mul", "div", "add", "sub"]);
  if (kind === "mul") {
    // 66 × ? = 138.6
    const a = r.int(d === 1 ? 3 : 12, d === 3 ? 99 : 66);
    const x = d === 1 ? F(r.int(3, 25)) : dec(r.int(11, 99), 1);
    const c = x.mul(a);
    return { prompt: `${a} × ? = ${fmt(c)}`, ans: x, method: `? = ${fmt(c)} ÷ ${a}`, mistakes: [x.mul(10), x.add(dec(1, 1)), c.sub(a).abs()] };
  }
  if (kind === "div") {
    // ? ÷ 12 = 17.5
    const b = r.int(4, 25);
    const q = dec(r.int(21, 299), 1);
    const x = q.mul(b);
    if ((decimals(x) ?? 9) > 2) return genMissing(r, d);
    return { prompt: `? ÷ ${b} = ${fmt(q)}`, ans: x, method: `? = ${fmt(q)} × ${b}`, mistakes: [q.div(b), x.add(b), x.mul(10)] };
  }
  if (kind === "add") {
    const b = d === 1 ? F(r.int(10, 99)) : dec(r.int(100, 9999), 1);
    const c = b.add(d === 1 ? F(r.int(10, 200)) : dec(r.int(50, 9999), r.int(1, 2)));
    const x = c.sub(b);
    return { prompt: `? + ${fmt(b)} = ${fmt(c)}`, ans: x, method: `? = ${fmt(c)} − ${fmt(b)}`, mistakes: [c.add(b), x.add(1), x.sub(dec(1, 1)).abs()] };
  }
  // 250 − ? = 87.5
  const a = F(r.pick([100, 200, 250, 500, 1000]));
  const c = dec(r.int(10, Math.floor(a.toNumber() * 10) - 10), 1);
  const x = a.sub(c);
  return { prompt: `${fmt(a)} − ? = ${fmt(c)}`, ans: x, method: `? = ${fmt(a)} − ${fmt(c)}`, mistakes: [a.add(c), x.add(1), x.sub(dec(1, 1)).abs()] };
}

const GENS: Record<string, (r: Rng, d: Difficulty) => Gen> = { add: genAdd, sub: genSub, mul: genMul, div: genDiv, frac: genFrac, missing: genMissing };

// ---------- multiple-choice options ----------

/** Unit of the last significant digit shown, e.g. 481 → 1, 613.75 → 0.01, 1200 → 100. */
function lastUnit(f: Fraction): Fraction {
  const dp = decimals(f);
  if (dp === null) return F(1, Number(f.d));
  if (dp > 0) return F(1, 10 ** dp);
  let n = f.n < 0n ? -f.n : f.n;
  let u = 1n;
  while (n !== 0n && n % 10n === 0n) {
    n /= 10n;
    u *= 10n;
  }
  return F(u);
}

/** Correct answer plus three distractors: plausible slips first, then digit/place errors. */
export function buildOptions(ans: Fraction, mistakes: Fraction[], r: Rng, fractionForm = false): { values: Fraction[]; correct: number } {
  const u = fractionForm ? F(1, Number(ans.d)) : lastUnit(ans);
  const near = [ans.add(u), ans.sub(u), ans.add(u.mul(10)), ans.sub(u.mul(10)), ans.add(u.mul(2)), ans.sub(u.mul(2))];
  const place = [ans.mul(10), ans.div(10)];
  const pool = [...r.shuffle(mistakes), ...r.shuffle(near), ...(r.chance(0.3) ? place : []), ...place];
  const chosen: Fraction[] = [];
  for (const c of pool) {
    if (chosen.length >= 3) break;
    if (c.sign() <= 0 || c.eq(ans) || chosen.some((x) => x.eq(c))) continue;
    // keep distractors in the same "shape" (terminating decimals stay terminating)
    if (!fractionForm && decimals(ans) !== null && decimals(c) === null) continue;
    if ((decimals(c) ?? 0) > Math.max(3, decimals(ans) ?? 0)) continue;
    chosen.push(c);
  }
  const values = r.shuffle([ans, ...chosen]);
  return { values, correct: values.findIndex((v) => v.eq(ans)) };
}

function finish(family: string, difficulty: Difficulty, seed: number, g: Gen, r: Rng): WarmupItem {
  const { values, correct } = buildOptions(g.ans, g.mistakes, r, !!g.fractionForm);
  const dp = decimals(g.ans);
  const show = g.fractionForm ? fracStr : fmt;
  return {
    family,
    difficulty,
    seed,
    prompt: g.prompt,
    answer: g.ans.toString(),
    display: show(g.ans),
    typeable: g.ans.sign() > 0 && dp !== null && dp <= 3,
    options: values.map(show),
    optionValues: values.map((v) => v.toString()),
    correctIndex: correct,
    method: g.method,
  };
}

export function generateWarmup(family: string, difficulty: Difficulty, seed: number): WarmupItem {
  const gen = GENS[family];
  if (!gen) throw new Error(`unknown warm-up family ${family}`);
  const r = itemRng("warmup", family, difficulty, seed);
  for (let i = 0; i < 50; i++) {
    const g = gen(r, difficulty);
    if (g.ans.sign() <= 0) continue;
    const it = finish(family, difficulty, seed, g, r);
    if (it.options.length === 4) return it;
  }
  throw new Error(`warm-up ${family}/${difficulty}/${seed}: no item`);
}

// ---------- Zetamac classic (default ranges) ----------

/** Zetamac defaults: (2–100) + (2–100), the reverse subtractions, (2–12) × (2–100), the reverse divisions. */
export function zetamacItem(seed: number): WarmupItem {
  const r = makeRng(seedFor("zetamac", seed));
  const op = r.int(0, 3);
  const a = op < 2 ? r.int(2, 100) : r.int(2, 12);
  const b = r.int(2, 100);
  const [prompt, ans] =
    op === 0 ? [`${a} + ${b}`, a + b] : op === 1 ? [`${a + b} − ${a}`, b] : op === 2 ? [`${a} × ${b}`, a * b] : [`${a * b} ÷ ${a}`, b];
  const g: Gen = { prompt, ans: F(ans), method: prompt, mistakes: [] };
  return finish(["add", "sub", "mul", "div"][op], 1, seed, g, r);
}

// ---------- plans ----------

/** 80-in-8 mix: families by weight, difficulty mostly 2. Reproducible from the master seed. */
export function planEighty(count: number, seed: number): ItemKey[] {
  const r = makeRng(seedFor("warmup", "eighty", seed));
  const fams = Object.keys(EIGHTY_WEIGHTS);
  const w = fams.map((f) => EIGHTY_WEIGHTS[f]);
  return Array.from({ length: count }, () => ({
    module: "warmup" as const,
    family: r.weighted(fams, w),
    difficulty: r.weighted([1, 2, 3] as Difficulty[], [3, 5, 2]),
    seed: Math.floor(r.next() * 2 ** 32),
  }));
}

/** i-th sprint problem (typeable answers only), reproducible from the seed. */
export function sprintItem(set: "eighty" | "zetamac", seed: number, i: number): WarmupItem {
  if (set === "zetamac") return zetamacItem(seedFor(seed, i));
  for (let k = 0; ; k++) {
    const key = planEighty(1, seedFor(seed, i, k))[0];
    const it = generateWarmup(key.family, key.difficulty, key.seed);
    if (it.typeable) return it;
  }
}

// ---------- checking ----------

export function parseUserNumber(s: string): Fraction | null {
  const t = s.replace(/\s+/g, "").replace(/,/g, ".").replace(/−/g, "-").replace(/%$/, "");
  if (!t || t === "." || t === "-") return null;
  try {
    return Fraction.parse(t);
  } catch {
    return null;
  }
}

/** Typed answer check: any equal value counts (0.50, .5 and 1/2 all match 1/2). */
export function checkWarmup(item: Pick<WarmupItem, "answer">, input: string | null): boolean | null {
  if (input === null || input.trim() === "") return null;
  const u = parseUserNumber(input);
  if (!u) return false;
  return u.eq(Fraction.parse(item.answer));
}

/** 80 in 8 scoring: +1 correct, −1 wrong (no skipping in the real test). */
export function scoreEighty(item: Pick<WarmupItem, "correctIndex">, choice: number | null): { correct: boolean | null; score: number } {
  if (choice === null) return { correct: null, score: 0 };
  return choice === item.correctIndex ? { correct: true, score: 1 } : { correct: false, score: -1 };
}
