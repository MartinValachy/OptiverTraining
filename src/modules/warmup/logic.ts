// Mental-math warm-up: integer ops, decimals, fractions <-> decimals, percentages.
import { Fraction, F } from "@/lib/fraction";
import { itemRng, type Rng } from "@/lib/rng";
import type { Difficulty, FamilyInfo } from "@/modules/types";

export const WARMUP_FAMILIES: FamilyInfo[] = [
  { id: "int", name: "Integer ops" },
  { id: "dec", name: "Decimals" },
  { id: "frac", name: "Fractions ↔ decimals" },
  { id: "pct", name: "Percentages" },
];

export interface WarmupItem {
  family: string;
  difficulty: Difficulty;
  seed: number;
  prompt: string;
  /** exact answer as a fraction string */
  answer: string;
  /** accepted absolute tolerance (for rounded answers), 0 = exact */
  tol: number;
  /** expected input format */
  format: "number" | "fraction";
  display: string;
}

function dec(f: Fraction, dp = 4): string {
  return Number(f.toNumber().toFixed(dp)).toString();
}

function terminating(f: Fraction): boolean {
  let d = f.d;
  while (d % 2n === 0n) d /= 2n;
  while (d % 5n === 0n) d /= 5n;
  return d === 1n;
}

function intItem(r: Rng, d: Difficulty): [string, Fraction] {
  const op = r.pick(["+", "−", "×", "÷"]);
  const lim = d === 1 ? [10, 99] : d === 2 ? [100, 999] : [100, 9999];
  if (op === "+" || op === "−") {
    const a = r.int(lim[0], lim[1]);
    const b = r.int(lim[0], lim[1]);
    return op === "+" ? [`${a} + ${b}`, F(a + b)] : [`${Math.max(a, b)} − ${Math.min(a, b)}`, F(Math.abs(a - b))];
  }
  if (op === "×") {
    const a = d === 1 ? r.int(3, 9) : d === 2 ? r.int(11, 49) : r.int(12, 99);
    const b = d === 1 ? r.int(11, 99) : d === 2 ? r.int(11, 49) : r.int(101, 499);
    return [`${a} × ${b}`, F(a * b)];
  }
  const b = d === 1 ? r.int(3, 9) : d === 2 ? r.int(6, 19) : r.int(12, 49);
  const q = d === 1 ? r.int(11, 40) : d === 2 ? r.int(12, 60) : r.int(21, 99);
  return [`${b * q} ÷ ${b}`, F(q)];
}

function decItem(r: Rng, d: Difficulty): [string, Fraction] {
  const op = r.pick(["+", "−", "×", "÷"]);
  const mk = (lo: number, hi: number, dp: number) => F(r.int(lo, hi), 10 ** dp);
  if (op === "+" || op === "−") {
    const a = mk(10, d === 1 ? 999 : 9999, d === 1 ? 1 : 2);
    const b = mk(10, d === 1 ? 999 : 9999, d === 3 ? 3 : 2);
    const [x, y] = a.gt(b) ? [a, b] : [b, a];
    return op === "+" ? [`${dec(x)} + ${dec(y)}`, x.add(y)] : [`${dec(x)} − ${dec(y)}`, x.sub(y)];
  }
  if (op === "×") {
    const a = mk(2, d === 1 ? 9 : 99, 1);
    const b = d === 1 ? F(r.int(2, 12)) : mk(2, d === 2 ? 99 : 999, d === 2 ? 1 : 2);
    return [`${dec(a)} × ${dec(b)}`, a.mul(b)];
  }
  const b = mk(2, d === 1 ? 9 : 49, 1);
  const q = d === 3 ? mk(11, 999, 1) : F(r.int(2, d === 1 ? 12 : 40));
  return [`${dec(b.mul(q))} ÷ ${dec(b)}`, q];
}

function fracItem(r: Rng, d: Difficulty): [string, Fraction, "number" | "fraction"] {
  const dens = d === 1 ? [2, 4, 5, 8, 10] : d === 2 ? [8, 16, 20, 25, 3, 6] : [12, 7, 9, 11, 32, 40];
  const den = r.pick(dens);
  let num = r.int(1, den - 1);
  while (new Fraction(num, den).d !== BigInt(den) && den > 2) num = r.int(1, den - 1);
  const f = F(num, den);
  if (r.chance(0.35) && terminating(f)) return [`${dec(f)} as a fraction (lowest terms)`, f, "fraction"];
  return [`${num}/${den} as a decimal${terminating(f) ? "" : " (3 dp)"}`, f, "number"];
}

function pctItem(r: Rng, d: Difficulty): [string, Fraction] {
  const kind = r.int(0, d === 1 ? 1 : 3);
  if (kind === 0) {
    const p = d === 1 ? r.pick([5, 10, 20, 25, 50, 75]) : r.pick([12.5, 15, 35, 45, 17.5, 62.5]);
    const x = r.int(2, 40) * (d === 1 ? 10 : 8);
    return [`${p}% of ${x}`, Fraction.of(p).mul(x).div(100)];
  }
  if (kind === 1) {
    const whole = r.pick([40, 80, 120, 160, 200, 240, 250, 400]);
    const pct = r.pick([5, 10, 15, 20, 25, 30, 35, 40, 45, 60, 75]);
    return [`${(whole * pct) / 100} is what % of ${whole}?`, F(pct)];
  }
  if (kind === 2) {
    const a = r.pick([10, 20, 25, 50]);
    const b = r.pick([10, 20, 25, 50]);
    return [`+${a}% then −${b}%: net change in %`, F(100 + a, 100).mul(F(100 - b, 100)).sub(1).mul(100)];
  }
  const x = r.int(20, 90);
  const p = r.pick([4, 6, 8, 12, 15]);
  return [`${x} increased by ${p}%`, F(x).mul(100 + p).div(100)];
}

export function generateWarmup(family: string, difficulty: Difficulty, seed: number): WarmupItem {
  const r = itemRng("warmup", family, difficulty, seed);
  let prompt: string;
  let ans: Fraction;
  let format: "number" | "fraction" = "number";
  switch (family) {
    case "int":
      [prompt, ans] = intItem(r, difficulty);
      break;
    case "dec":
      [prompt, ans] = decItem(r, difficulty);
      break;
    case "frac":
      [prompt, ans, format] = fracItem(r, difficulty);
      break;
    default:
      [prompt, ans] = pctItem(r, difficulty);
  }
  const exact = terminating(ans) || format === "fraction";
  return {
    family,
    difficulty,
    seed,
    prompt,
    answer: ans.toString(),
    tol: exact ? 0 : 0.0005 + 1e-12,
    format,
    display: format === "fraction" ? ans.toString() : exact ? dec(ans, 6) : ans.toNumber().toFixed(3),
  };
}

export function parseUserNumber(s: string): Fraction | null {
  const t = s.replace(/\s+/g, "").replace(/,/g, ".").replace(/−/g, "-").replace(/%$/, "");
  if (!t) return null;
  try {
    return Fraction.parse(t);
  } catch {
    return null;
  }
}

export function checkWarmup(item: WarmupItem, input: string | null): boolean | null {
  if (input === null || input.trim() === "") return null;
  const u = parseUserNumber(input);
  if (!u) return false;
  const a = Fraction.parse(item.answer);
  if (item.format === "fraction") {
    const m = /^(-?\d+)\/(\d+)$/.exec(input.replace(/\s+/g, "").replace(/−/g, "-"));
    return !!m && BigInt(m[1]) === a.n && BigInt(m[2]) === a.d;
  }
  if (item.tol === 0) return u.eq(a);
  return Math.abs(u.toNumber() - a.toNumber()) <= item.tol;
}
