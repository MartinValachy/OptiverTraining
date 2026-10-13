// Beat The Odds core: exact answer values, option formatting and the option builder.

import { Fraction } from "@/lib/fraction";
import type { Rng } from "@/lib/rng";
import type { Difficulty } from "@/modules/types";

export type Value = { kind: "frac"; v: Fraction } | { kind: "inf" };
export type Unit = "prob" | "num";

export const fr = (v: Fraction): Value => ({ kind: "frac", v });
export const INF: Value = { kind: "inf" };

export interface Distractor {
  value: Value;
  why: string;
}

export interface Scenario {
  sub: string;
  text: string;
  unit: Unit;
  answer: Value;
  distractors: Distractor[];
  solution: string[];
  hint: string;
  /** parameters for independent verification in tests */
  params: Record<string, unknown>;
}

export interface BtoFamily {
  id: string;
  name: string;
  blurb: string;
  generate(rng: Rng, difficulty: Difficulty): Scenario;
}

export interface BtoOption {
  label: string;
  /** numeric value of the label (probabilities as 0..1), Infinity for "infinite" */
  value: number;
  why: string | null;
}

export interface BtoItem {
  family: string;
  difficulty: Difficulty;
  seed: number;
  sub: string;
  text: string;
  unit: Unit;
  options: BtoOption[];
  correctIndex: number;
  /** exact answer as fraction string or "inf" */
  exact: string;
  exactLabel: string;
  exactIncluded: boolean;
  solution: string[];
  hint: string;
  params: Record<string, unknown>;
}

export function valueNum(v: Value): number {
  return v.kind === "inf" ? Infinity : v.v.toNumber();
}

/** Round to what the option label shows; returns label and its numeric value. */
export function formatValue(x: number, unit: Unit): { label: string; value: number } {
  if (!Number.isFinite(x)) return { label: "∞ (infinite)", value: Infinity };
  if (unit === "prob") {
    const p = x * 100;
    let s: string;
    if (Math.abs(p) < 1e-12) s = "0";
    else if (Math.abs(p - 100) < 1e-12) s = "100";
    else if (p >= 10) s = p.toFixed(1);
    else if (p >= 1) s = p.toFixed(2);
    else if (p >= 0.1) s = p.toFixed(3);
    else s = p.toPrecision(3);
    const label = `${s}%`;
    return { label, value: Number(s) / 100 };
  }
  const a = Math.abs(x);
  let s: string;
  if (Number.isInteger(x)) s = String(x);
  else if (a >= 1000) s = x.toFixed(0);
  else if (a >= 100) s = x.toFixed(1);
  else if (a >= 10) s = x.toFixed(2);
  else s = x.toFixed(3);
  // trim trailing zeros after the decimal point
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  if (s === "-0") s = "0";
  return { label: s, value: Number(s) };
}

export function exactLabel(v: Value, unit: Unit): string {
  if (v.kind === "inf") return "∞ (the expectation diverges)";
  const f = v.v;
  const dec = formatValue(f.toNumber(), unit).label;
  return f.isInteger() ? dec : `${f.toString()} ≈ ${dec}`;
}

/** Options at least 3% apart (relative), as required. */
export function distinctEnough(a: number, b: number): boolean {
  if (a === Infinity || b === Infinity) return a !== b;
  const m = Math.max(Math.abs(a), Math.abs(b));
  if (m === 0) return false;
  return Math.abs(a - b) >= 0.03 * m - 1e-15;
}

function validFor(unit: Unit, x: number, allowNegative: boolean): boolean {
  if (Number.isNaN(x)) return false;
  if (x === Infinity) return true;
  if (!Number.isFinite(x)) return false;
  if (unit === "prob") return x >= 0 && x <= 1;
  return allowNegative || x >= 0;
}

/** Deterministic "scale" variants used only if the family's mistake list is too short. */
function fallbacks(x: number, unit: Unit): Distractor[] {
  const f = (v: number, why: string): Distractor => ({ value: { kind: "frac", v: Fraction.parse(v.toPrecision(12)) }, why });
  if (!Number.isFinite(x)) return [f(2, "a typical finite guess"), f(4, "a typical finite guess"), f(8, "a typical finite guess"), f(16, "a typical finite guess")];
  const out: Distractor[] = [];
  if (unit === "prob") {
    out.push(f(1 - x, "complement of the answer"));
    out.push(f(x / 2, "half the answer (a factor-of-two error)"));
    if (2 * x <= 1) out.push(f(2 * x, "double the answer (a factor-of-two error)"));
    out.push(f(x * x, "squaring the probability (treating events as independent twice)"));
    out.push(f(Math.sqrt(x), "square root of the answer"));
    out.push(f((x + 1) / 2, "averaging with certainty"));
    out.push(f(x / 3, "a factor-of-three error"));
  } else {
    out.push(f(x / 2, "half the answer (a factor-of-two error)"));
    out.push(f(2 * x, "double the answer (a factor-of-two error)"));
    out.push(f(x + 1, "off by one"));
    if (x - 1 >= 0) out.push(f(x - 1, "off by one"));
    out.push(f(1.5 * x, "a factor-of-1.5 error"));
    out.push(f(x / 3, "a factor-of-three error"));
    out.push(f(x * x, "squaring instead of multiplying"));
  }
  return out;
}

export const OMIT_EXACT_P: Record<Difficulty, number> = { 1: 0.1, 2: 0.15, 3: 0.25 };

/**
 * Build 5 options: the exact (or deliberately nearest) answer plus mistake-based distractors.
 * Returns null if the scenario cannot produce 5 well-separated options (caller retries).
 */
export function buildOptions(
  sc: Scenario,
  rng: Rng,
  difficulty: Difficulty,
): { options: BtoOption[]; correctIndex: number; exactIncluded: boolean } | null {
  const exact = valueNum(sc.answer);
  const allowNeg = sc.distractors.some((d) => valueNum(d.value) < 0) || exact < 0;
  let includeExact = sc.answer.kind === "inf" || !rng.chance(OMIT_EXACT_P[difficulty]);
  const exactFmt = formatValue(exact, sc.unit);
  let correct = { ...exactFmt, why: null as string | null };
  if (!includeExact) {
    const delta = (0.05 + rng.next() * 0.03) * (rng.chance(0.5) ? 1 : -1);
    let near = exact * (1 + delta);
    if (!validFor(sc.unit, near, allowNeg)) near = exact * (1 - delta);
    const nf = formatValue(near, sc.unit);
    if (exact !== 0 && validFor(sc.unit, nf.value, allowNeg) && nf.label !== exactFmt.label) correct = { ...nf, why: null };
    else includeExact = true;
  }
  const d0 = Math.abs(correct.value - exact) || 0;
  const chosen: BtoOption[] = [correct];
  const candidates = [...sc.distractors, ...fallbacks(exact, sc.unit)];
  for (const d of candidates) {
    if (chosen.length >= 5) break;
    const x = valueNum(d.value);
    if (!validFor(sc.unit, x, allowNeg)) continue;
    const f = formatValue(x, sc.unit);
    if (!validFor(sc.unit, f.value, allowNeg)) continue;
    if (chosen.some((c) => c.label === f.label || !distinctEnough(c.value, f.value))) continue;
    // must be clearly farther from the truth than the keyed option
    if (exact !== Infinity) {
      const dist = Math.abs(f.value - exact);
      if (!(dist >= 2 * d0 && dist - d0 >= 0.01 * Math.abs(exact) && dist > 0)) continue;
    } else if (f.value === Infinity) continue;
    chosen.push({ label: f.label, value: f.value, why: d.why });
  }
  if (chosen.length < 5) return null;
  const options = chosen.slice().sort((a, b) => a.value - b.value);
  const correctIndex = options.indexOf(correct);
  return { options, correctIndex, exactIncluded: includeExact };
}

/** Index of the option closest to the exact answer (the scoring rule). */
export function closestIndex(options: BtoOption[], exact: number): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < options.length; i++) {
    const v = options[i].value;
    const d = exact === Infinity ? (v === Infinity ? 0 : Infinity) : v === Infinity ? Infinity : Math.abs(v - exact);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function scoreBto(item: Pick<BtoItem, "correctIndex">, response: number | null): { correct: boolean | null; score: number } {
  if (response === null || response === undefined) return { correct: null, score: 0 };
  const ok = response === item.correctIndex;
  return { correct: ok, score: ok ? 1 : -1 };
}

// ---------- text helpers ----------

export function pctStr(f: Fraction): string {
  return formatValue(f.toNumber(), "prob").label;
}

export function fs(f: Fraction): string {
  return f.toString();
}

export const ORD = ["zeroth", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"];
export const NUMW = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
export function numw(n: number): string {
  return NUMW[n] ?? String(n);
}
