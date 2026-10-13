// Pure, testable logic for the Zap-N games.

import { Fraction, F } from "@/lib/fraction";
import type { Rng } from "@/lib/rng";

// ---------- Balloon ----------

/** Pop point is uniform on 1..max: the balloon pops when the pump count reaches it. */
export function balloonPopPoint(r: Rng, max: number): number {
  return r.int(1, max);
}

/** Expected banked value when you stop after k pumps: k·v·P(pop point > k). */
export function balloonEV(k: number, max: number, value: number): number {
  return k * value * Math.max(0, (max - k) / max);
}

export function balloonOptimalStop(max: number): { k: number; ev: number } {
  let best = { k: 0, ev: 0 };
  for (let k = 0; k <= max; k++) {
    const ev = balloonEV(k, max, 1);
    if (ev > best.ev + 1e-12) best = { k, ev };
  }
  return best;
}

// ---------- Pincode ----------

export function pinDigits(r: Rng, len: number): string {
  let s = String(r.int(1, 9));
  while (s.length < len) s += String(r.int(0, 9));
  return s;
}

export function pinNextLength(len: number, correct: boolean, min: number): number {
  return correct ? len + 1 : Math.max(min, len - 1);
}

// ---------- CodeCompare ----------

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
const LOOKALIKE: Record<string, string> = { "0": "O", O: "0", "1": "I", I: "1", "5": "S", S: "5", "8": "B", B: "8", "2": "Z", Z: "2", E: "F", F: "E", M: "N", N: "M", U: "V", V: "U" };

export function codePair(r: Rng, len: number, diffProb: number): { a: string; b: string; same: boolean } {
  const a = Array.from({ length: len }, () => r.pick(ALPHABET.split(""))).join("");
  if (!r.chance(diffProb)) return { a, b: a, same: true };
  const chars = a.split("");
  const i = r.int(0, len - 1);
  const c = chars[i];
  let rep = LOOKALIKE[c] && r.chance(0.7) ? LOOKALIKE[c] : r.pick(ALPHABET.split(""));
  while (rep === c) rep = r.pick(ALPHABET.split(""));
  chars[i] = rep;
  if (r.chance(0.2) && len > 3) {
    // occasionally a transposition instead
    const j = Math.min(len - 1, i + 1);
    const t = a.split("");
    [t[i], t[j]] = [t[j], t[i]];
    if (t.join("") !== a) return { a, b: t.join(""), same: false };
  }
  return { a, b: chars.join(""), same: false };
}

export function nextWindow(ms: number, correct: boolean, p: { minWindowMs: number; startWindowMs: number; shrink: number; grow: number }): number {
  return correct ? Math.max(p.minWindowMs, ms * p.shrink) : Math.min(p.startWindowMs, ms * p.grow);
}

// ---------- The Switch ----------

export interface SwitchTrial {
  rule: "number" | "arrow";
  n: number;
  arrow: "left" | "right";
  switched: boolean;
}

export function switchTrials(r: Rng, n: number, random: boolean, pSwitch: number): SwitchTrial[] {
  const out: SwitchTrial[] = [];
  let rule: "number" | "arrow" = r.chance(0.5) ? "number" : "arrow";
  for (let i = 0; i < n; i++) {
    const switched = i > 0 && (random ? r.chance(pSwitch) : i % 2 === 0);
    if (switched) rule = rule === "number" ? "arrow" : "number";
    out.push({ rule, n: r.int(1, 9), arrow: r.chance(0.5) ? "left" : "right", switched });
  }
  return out;
}

export function switchAnswer(t: SwitchTrial): "left" | "right" {
  if (t.rule === "arrow") return t.arrow;
  return t.n % 2 === 1 ? "left" : "right";
}

export function switchCost(trials: SwitchTrial[], results: { correct: boolean; rt: number }[]): { switchRt: number; repeatRt: number; cost: number } {
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const sw: number[] = [];
  const rep: number[] = [];
  results.forEach((res, i) => {
    if (!res.correct || i === 0) return;
    (trials[i].switched ? sw : rep).push(res.rt);
  });
  return { switchRt: avg(sw), repeatRt: avg(rep), cost: avg(sw) - avg(rep) };
}

// ---------- NumberBox (24-style) ----------

type Ex = { v: Fraction; s: string; used: number };

/** Find an expression using every number exactly once that equals target, or null. */
export function solveNumbers(nums: number[], target: number): string | null {
  const start: Ex[] = nums.map((n, i) => ({ v: F(n), s: String(n), used: 1 << i }));
  const seen = new Set<string>();
  const rec = (xs: Ex[]): string | null => {
    if (xs.length === 1) return xs[0].v.eq(target) ? xs[0].s : null;
    const key = xs.map((x) => x.v.toString()).sort().join("|");
    if (seen.has(key)) return null;
    seen.add(key);
    for (let i = 0; i < xs.length; i++)
      for (let j = 0; j < xs.length; j++) {
        if (i === j) continue;
        const a = xs[i];
        const b = xs[j];
        const rest = xs.filter((_, k) => k !== i && k !== j);
        const cands: Ex[] = [];
        if (i < j) {
          cands.push({ v: a.v.add(b.v), s: `(${a.s} + ${b.s})`, used: a.used | b.used });
          cands.push({ v: a.v.mul(b.v), s: `${wrap(a.s)} × ${wrap(b.s)}`, used: a.used | b.used });
        }
        cands.push({ v: a.v.sub(b.v), s: `(${a.s} − ${b.s})`, used: a.used | b.used });
        if (!b.v.isZero()) cands.push({ v: a.v.div(b.v), s: `${wrap(a.s)} ÷ ${wrap(b.s)}`, used: a.used | b.used });
        for (const c of cands) {
          const r = rec([...rest, c]);
          if (r) return r;
        }
      }
    return null;
  };
  const s = rec(start);
  return s ? stripOuter(s) : null;
}

function wrap(s: string) {
  return /^\d+$/.test(s) || (s.startsWith("(") && s.endsWith(")") && balanced(s.slice(1, -1))) ? s : `(${s})`;
}
function balanced(s: string) {
  let d = 0;
  for (const c of s) {
    if (c === "(") d++;
    if (c === ")") d--;
    if (d < 0) return false;
  }
  return d === 0;
}
function stripOuter(s: string) {
  return s.startsWith("(") && s.endsWith(")") && balanced(s.slice(1, -1)) ? s.slice(1, -1) : s;
}

export function numberPuzzle(r: Rng, targets: number[], minN: number, maxN: number): { nums: number[]; target: number; solution: string } {
  for (;;) {
    const target = r.pick(targets);
    const nums = Array.from({ length: 4 }, () => r.int(minN, maxN));
    const sol = solveNumbers(nums, target);
    if (sol) return { nums, target, solution: sol };
  }
}

/** Tokenise and evaluate a user expression with exact fractions. Returns null if malformed. */
export function evalExpression(expr: string): { value: Fraction; numbers: number[] } | null {
  const toks = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").match(/\d+|[-+*/()]/g);
  if (!toks || toks.join("") !== expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/\s+/g, "")) return null;
  let pos = 0;
  const numbers: number[] = [];
  const peek = () => toks[pos];
  const parseExpr = (): Fraction | null => {
    let v = parseTerm();
    if (!v) return null;
    while (peek() === "+" || peek() === "-") {
      const op = toks[pos++];
      const w = parseTerm();
      if (!w) return null;
      v = op === "+" ? v.add(w) : v.sub(w);
    }
    return v;
  };
  const parseTerm = (): Fraction | null => {
    let v = parseFactor();
    if (!v) return null;
    while (peek() === "*" || peek() === "/") {
      const op = toks[pos++];
      const w = parseFactor();
      if (!w) return null;
      if (op === "/" && w.isZero()) return null;
      v = op === "*" ? v.mul(w) : v.div(w);
    }
    return v;
  };
  const parseFactor = (): Fraction | null => {
    const t = toks[pos++];
    if (t === undefined) return null;
    if (t === "(") {
      const v = parseExpr();
      if (toks[pos++] !== ")") return null;
      return v;
    }
    if (/^\d+$/.test(t)) {
      numbers.push(Number(t));
      return F(Number(t));
    }
    return null;
  };
  const v = parseExpr();
  if (!v || pos !== toks.length) return null;
  return { value: v, numbers };
}

export function checkNumberBox(expr: string, nums: number[], target: number): { ok: boolean; reason?: string; value?: Fraction } {
  const e = evalExpression(expr);
  if (!e) return { ok: false, reason: "Incomplete or malformed expression." };
  const a = [...e.numbers].sort((x, y) => x - y).join(",");
  const b = [...nums].sort((x, y) => x - y).join(",");
  if (a !== b) return { ok: false, reason: "Use each of the four numbers exactly once.", value: e.value };
  if (!e.value.eq(target)) return { ok: false, reason: `That makes ${e.value.toString()}, not ${target}.`, value: e.value };
  return { ok: true, value: e.value };
}

// ---------- Tower (Skyscraper) ----------

export type Pegs = number[][]; // bottom → top, block sizes

export function heights(p: Pegs): number[] {
  return p.map((s) => s.reduce((a, b) => a + b, 0));
}

const keyOf = (p: Pegs) => p.map((s) => s.join(".")).join("|");

/** BFS: optimal move sequence [from, to][] reaching the target heights. */
export function towerSolve(start: Pegs, target: number[], maxDepth = 14): [number, number][] | null {
  const done = (p: Pegs) => heights(p).every((h, i) => h === target[i]);
  if (done(start)) return [];
  const prev = new Map<string, { key: string; move: [number, number] } | null>();
  const states = new Map<string, Pegs>();
  const k0 = keyOf(start);
  prev.set(k0, null);
  states.set(k0, start);
  let frontier = [start];
  for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
    const next: Pegs[] = [];
    for (const p of frontier) {
      for (let a = 0; a < p.length; a++) {
        if (!p[a].length) continue;
        for (let b = 0; b < p.length; b++) {
          if (a === b) continue;
          const q = p.map((s) => s.slice());
          q[b].push(q[a].pop()!);
          const k = keyOf(q);
          if (prev.has(k)) continue;
          prev.set(k, { key: keyOf(p), move: [a, b] });
          states.set(k, q);
          if (done(q)) {
            const path: [number, number][] = [];
            let cur: string | null = k;
            while (cur) {
              const e = prev.get(cur);
              if (!e) break;
              path.unshift(e.move);
              cur = e.key;
            }
            return path;
          }
          next.push(q);
        }
      }
    }
    frontier = next;
  }
  return null;
}

export function towerLevel(r: Rng, blocks: number): { start: Pegs; target: number[]; optimal: [number, number][] } {
  for (;;) {
    const sizes = Array.from({ length: blocks }, () => r.int(1, 3));
    const start: Pegs = [[], [], []];
    for (const s of sizes) start[r.int(0, 2)].push(s);
    // target: heights of a random reachable configuration
    const end: Pegs = [[], [], []];
    for (const s of r.shuffle(sizes)) end[r.int(0, 2)].push(s);
    const target = heights(end);
    if (target.every((h, i) => h === heights(start)[i])) continue;
    const optimal = towerSolve(start, target);
    if (optimal && optimal.length >= Math.min(2, blocks - 1)) return { start, target, optimal };
  }
}

// ---------- Shapeshift ----------

export const SHAPES = ["circle", "square", "triangle", "star", "diamond"] as const;
export type ShapeName = (typeof SHAPES)[number];

export function shapeSequence(r: Rng, n: number, pSame: number): ShapeName[] {
  const out: ShapeName[] = [r.pick(SHAPES)];
  for (let i = 1; i < n; i++) out.push(r.chance(pSame) ? out[i - 1] : r.pick(SHAPES.filter((s) => s !== out[i - 1])));
  return out;
}

// ---------- Grill Master ----------

export interface GrillSlot {
  item: number | null;
  start: number;
  flipped: boolean;
  flippedAt: number;
}

export interface GrillParams {
  items: { name: string; cookMs: number }[];
  windowMs: number;
}

/** Status of a slot at time t: flip and serve windows centred on half / full cook time. */
export function grillStatus(s: GrillSlot, t: number, p: GrillParams): "empty" | "cooking" | "flip" | "serve" | "burnt" {
  if (s.item === null) return "empty";
  const cook = p.items[s.item].cookMs;
  const age = t - s.start;
  if (!s.flipped) {
    if (age > cook / 2 + p.windowMs) return "burnt";
    if (age >= cook / 2 - p.windowMs) return "flip";
    return "cooking";
  }
  if (age > cook + p.windowMs) return "burnt";
  if (age >= cook - p.windowMs) return "serve";
  return "cooking";
}

/** Apply a tap on a slot. Returns the new slot and what happened. */
export function grillTap(s: GrillSlot, t: number, p: GrillParams, nextOrder: number | null): { slot: GrillSlot; event: "placed" | "flipped" | "served" | "early" | "burnt" | "none" } {
  const st = grillStatus(s, t, p);
  if (st === "empty") return nextOrder === null ? { slot: s, event: "none" } : { slot: { item: nextOrder, start: t, flipped: false, flippedAt: 0 }, event: "placed" };
  if (st === "flip") return { slot: { ...s, flipped: true, flippedAt: t }, event: "flipped" };
  if (st === "serve") return { slot: { item: null, start: 0, flipped: false, flippedAt: 0 }, event: "served" };
  if (st === "burnt") return { slot: { item: null, start: 0, flipped: false, flippedAt: 0 }, event: "burnt" };
  return { slot: s, event: "early" };
}

// ---------- Pattern Guess (Mastermind) ----------

export function mmFeedback(code: number[], guess: number[]): { exact: number; partial: number } {
  let exact = 0;
  const cc: Record<number, number> = {};
  const gc: Record<number, number> = {};
  for (let i = 0; i < code.length; i++) {
    if (code[i] === guess[i]) exact++;
    else {
      cc[code[i]] = (cc[code[i]] ?? 0) + 1;
      gc[guess[i]] = (gc[guess[i]] ?? 0) + 1;
    }
  }
  let partial = 0;
  for (const k of Object.keys(gc)) partial += Math.min(gc[Number(k)], cc[Number(k)] ?? 0);
  return { exact, partial };
}

export function allCodes(len: number, symbols: number): number[][] {
  const out: number[][] = [];
  const rec = (acc: number[]) => {
    if (acc.length === len) {
      out.push(acc.slice());
      return;
    }
    for (let s = 0; s < symbols; s++) {
      acc.push(s);
      rec(acc);
      acc.pop();
    }
  };
  rec([]);
  return out;
}

export function consistentCount(history: { guess: number[]; exact: number; partial: number }[], len: number, symbols: number): number {
  return allCodes(len, symbols).filter((c) => history.every((h) => {
    const f = mmFeedback(c, h.guess);
    return f.exact === h.exact && f.partial === h.partial;
  })).length;
}

// ---------- Dial ----------

/** Smallest signed angular difference a − b in degrees, in (−180, 180]. */
export function angleDiff(a: number, b: number): number {
  let d = ((a - b) % 360 + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

export function dialHit(needle: number, zoneCenter: number, zoneDeg: number): { hit: boolean; error: number } {
  const e = angleDiff(needle, zoneCenter);
  return { hit: Math.abs(e) <= zoneDeg / 2, error: e };
}

// ---------- stats ----------

export function rtStats(rts: number[]): { mean: number; sd: number; median: number; n: number } {
  const n = rts.length;
  if (!n) return { mean: 0, sd: 0, median: 0, n };
  const mean = rts.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(rts.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const s = [...rts].sort((a, b) => a - b);
  const median = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  return { mean, sd, median, n };
}
