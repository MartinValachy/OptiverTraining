import { Fraction, F, fsum } from "@/lib/fraction";
import { binom, cartesian, harmonic } from "@/lib/math";
import { itemRng, type Rng } from "@/lib/rng";
import type { Difficulty, FamilyInfo } from "@/modules/types";
import type { ShapeType, Visual } from "@/modules/visual";

export const IV_FAMILIES: FamilyInfo[] = [
  { id: "exact_prob", name: "Exact probabilities", blurb: "dice and coins" },
  { id: "sampling", name: "Sampling without replacement", blurb: "urns, cards, committees" },
  { id: "expected", name: "Expected values", blurb: "max of dice, waiting times" },
  { id: "ratios", name: "Ratios & percentages", blurb: "compounding, shares, rates" },
  { id: "shape_grid", name: "Shape grids", blurb: "visual estimation of counts and pick probabilities" },
  { id: "density", name: "Dot density", blurb: "share of dots in a region, dot counts" },
  { id: "fermi", name: "Quick estimates", blurb: "computable Fermi-style scenarios" },
];

/** prob: 0–100 probability scale (upper ≤ 100); pct: a percentage that may exceed 100; num: plain number */
export type IvUnit = "prob" | "pct" | "num";

export interface IntervalItem {
  family: string;
  difficulty: Difficulty;
  seed: number;
  sub: string;
  text: string;
  unit: IvUnit;
  /** truth in display units (percent for prob/pct) */
  truth: number;
  /** exact truth as a fraction string when rational */
  truthExact: string | null;
  truthLabel: string;
  visual?: Visual;
  solution: string[];
  hint: string;
  params: Record<string, unknown>;
}

interface Draft {
  sub: string;
  text: string;
  unit: IvUnit;
  exact?: Fraction;
  approx?: number;
  visual?: Visual;
  solution: string[];
  hint: string;
  params: Record<string, unknown>;
}

const P100 = (f: Fraction) => f.mul(100);
function fmtNum(x: number): string {
  if (Number.isInteger(x)) return x.toLocaleString("en-US");
  const a = Math.abs(x);
  return a >= 100 ? x.toFixed(1) : a >= 1 ? x.toFixed(3) : x.toPrecision(4);
}

// ---------- families ----------

function exactProb(r: Rng, d: Difficulty): Draft {
  const sub = r.pick(d === 1 ? ["die_beat", "sum_atleast"] : d === 2 ? ["die_beat", "heads_k", "atleast_one"] : ["max_beat", "heads_k", "sum3"]);
  if (sub === "die_beat") {
    const s = d === 1 ? 6 : r.pick([8, 10, 12]);
    const rel = r.pick(["greater", "atleast", "equal"]);
    let c = 0;
    for (let a = 1; a <= s; a++) for (let b = 1; b <= s; b++) if (rel === "greater" ? a > b : rel === "atleast" ? a >= b : a === b) c++;
    const p = F(c, s * s);
    return {
      sub,
      text: `You and a friend each roll a fair ${s}-sided die. What is the probability (in %) that your friend's roll is ${rel === "greater" ? "strictly higher than" : rel === "atleast" ? "at least as high as" : "equal to"} yours?`,
      unit: "prob",
      exact: P100(p),
      solution: [`${c} of the ${s * s} equally likely pairs qualify (${rel === "equal" ? s + " ties" : `ties: ${s}; by symmetry the rest split evenly`}).`, `P = ${c}/${s * s} = ${p}.`],
      hint: "Ties have probability 1/s; the remaining mass splits evenly by symmetry.",
      params: { sub, s, rel },
    };
  }
  if (sub === "sum_atleast" || sub === "sum3") {
    const n = sub === "sum3" ? 3 : 2;
    const k = r.int(n === 2 ? 6 : 9, n === 2 ? 11 : 15);
    let c = 0;
    let t = 0;
    for (const xs of cartesian(n, 6)) {
      t++;
      if (xs.reduce((a, b) => a + b + 1, 0) >= k) c++;
    }
    const p = F(c, t);
    return {
      sub,
      text: `${n === 2 ? "Two" : "Three"} fair dice are rolled. What is the probability (in %) that the sum is at least ${k}?`,
      unit: "prob",
      exact: P100(p),
      solution: [`Count outcomes with sum ≥ ${k}: ${c} of ${t}.`, `P = ${p}.`],
      hint: "Count the smaller tail and use symmetry around the mean sum.",
      params: { sub, n, k },
    };
  }
  if (sub === "heads_k") {
    const n = r.int(4, d === 2 ? 8 : 12);
    const k = r.int(1, n - 1);
    const p = F(binom(n, k), 2n ** BigInt(n));
    return {
      sub,
      text: `A fair coin is flipped ${n} times. What is the probability (in %) of exactly ${k} heads?`,
      unit: "prob",
      exact: P100(p),
      solution: [`C(${n},${k}) = ${binom(n, k)} sequences out of 2^${n} = ${2 ** n}.`, `P = ${p}.`],
      hint: "C(n,k)/2^n.",
      params: { sub, n, k },
    };
  }
  if (sub === "atleast_one") {
    const n = r.int(3, 12);
    const p = F(5, 6).pow(n).comp();
    return {
      sub,
      text: `A fair die is rolled ${n} times. What is the probability (in %) of at least one six?`,
      unit: "prob",
      exact: P100(p),
      solution: [`1 − (5/6)^${n}.`],
      hint: "Complement: no six at all.",
      params: { sub, n },
    };
  }
  // max_beat: friend rolls two dice and keeps the higher; you roll one
  let c = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let m = 1; m <= 6; m++) if (Math.max(a, b) > m) c++;
  const p = F(c, 216);
  return {
    sub,
    text: "Your friend rolls two fair dice and keeps the higher one; you roll one fair die. What is the probability (in %) that your friend's number is strictly higher?",
    unit: "prob",
    exact: P100(p),
    solution: ["P(max of two = k) = (2k−1)/36.", `Σ_k (2k−1)/36 · (k−1)/6 = ${c}/216 = ${p}.`],
    hint: "Condition on your roll or on the friend's maximum.",
    params: { sub },
  };
}

function sampling(r: Rng, d: Difficulty): Draft {
  const sub = r.pick(d === 1 ? ["all_red", "no_suit"] : d === 2 ? ["atleast_one_red", "committee", "no_suit"] : ["committee", "atleast_one_red", "pair_in_hand"]);
  if (sub === "all_red" || sub === "atleast_one_red") {
    const red = r.int(3, 9);
    const blue = r.int(3, 12);
    const N = red + blue;
    const k = sub === "all_red" ? 2 : r.int(2, 4);
    if (sub === "all_red") {
      const p = F(binom(red, k), binom(N, k));
      return {
        sub,
        text: `An urn holds ${red} red and ${blue} blue balls. You draw ${k} without replacement. Probability (in %) that all are red?`,
        unit: "prob",
        exact: P100(p),
        solution: [`${red}/${N} · ${red - 1}/${N - 1} = ${p}.`],
        hint: "Multiply the shrinking fractions.",
        params: { sub, red, blue, k },
      };
    }
    const p = F(binom(blue, k), binom(N, k)).comp();
    return {
      sub,
      text: `An urn holds ${red} red and ${blue} blue balls. You draw ${k} without replacement. Probability (in %) of at least one red ball?`,
      unit: "prob",
      exact: P100(p),
      solution: [`P(no red) = C(${blue},${k})/C(${N},${k}).`, `P(at least one) = 1 − that = ${p}.`],
      hint: "Complement: all blue.",
      params: { sub, red, blue, k },
    };
  }
  if (sub === "no_suit") {
    const n = r.int(2, d === 1 ? 4 : 6);
    const p = F(binom(39, n), binom(52, n));
    return {
      sub,
      text: `${n} cards are dealt from a shuffled 52-card deck. Probability (in %) that none of them is a heart?`,
      unit: "prob",
      exact: P100(p),
      solution: [`39/52 · 38/51 · … (${n} factors) = C(39,${n})/C(52,${n}) = ${p}.`],
      hint: "Each card must avoid the 13 hearts; the deck shrinks.",
      params: { sub, n },
    };
  }
  if (sub === "committee") {
    const N = r.int(8, 16);
    const w = r.int(3, N - 3);
    const k = r.int(3, Math.min(6, N - 2));
    const j = r.int(Math.max(1, k - (N - w)), Math.min(k - 1, w));
    const p = F(binom(w, j) * binom(N - w, k - j), binom(N, k));
    return {
      sub,
      text: `A committee of ${k} is chosen at random from ${N} people, ${w} of whom are women. Probability (in %) that exactly ${j} women are chosen?`,
      unit: "prob",
      exact: P100(p),
      solution: [`C(${w},${j})·C(${N - w},${k - j}) / C(${N},${k}) = ${p}.`],
      hint: "Hypergeometric.",
      params: { sub, N, w, k, j },
    };
  }
  // pair_in_hand: P(5-card hand contains at least one pair or better by rank repetition)
  const n = r.pick([3, 4, 5]);
  let distinct = Fraction.ONE;
  for (let i = 0; i < n; i++) distinct = distinct.mul(F(52 - 4 * i, 52 - i));
  const p = distinct.comp();
  return {
    sub,
    text: `${n} cards are dealt from a shuffled 52-card deck. Probability (in %) that at least two share a rank?`,
    unit: "prob",
    exact: P100(p),
    solution: [`All ranks different: 1 · 48/51 · 44/50${n > 3 ? " · 40/49" : ""}${n > 4 ? " · 36/48" : ""}.`, `P = 1 − that = ${p}.`],
    hint: "Complement: every new card avoids the ranks seen so far.",
    params: { sub, n },
  };
}

function expected(r: Rng, d: Difficulty): Draft {
  const sub = r.pick(d === 1 ? ["rolls_until", "max2"] : d === 2 ? ["max2", "coupon", "product"] : ["coupon", "max_n", "flips_k"]);
  if (sub === "rolls_until") {
    const ev = r.pick([
      { t: "a six", p: F(1, 6) },
      { t: "a sum of 7 with two dice", p: F(1, 6) },
      { t: "double six with two dice", p: F(1, 36) },
      { t: "a sum of 10 or more with two dice", p: F(1, 6) },
      { t: "a sum of 11 with two dice", p: F(1, 18) },
    ]);
    return {
      sub,
      text: `Expected number of rolls until you get ${ev.t} (including that roll)?`,
      unit: "num",
      exact: ev.p.inv(),
      solution: [`Geometric with p = ${ev.p}: E = 1/p = ${ev.p.inv()}.`],
      hint: "1/p.",
      params: { sub, p: ev.p.toString() },
    };
  }
  if (sub === "max2" || sub === "max_n") {
    const n = sub === "max2" ? 2 : r.int(3, 4);
    const s = sub === "max2" ? r.pick([6, 8, 10]) : 6;
    const e = fsum(Array.from({ length: s }, (_, k) => Fraction.ONE.sub(F(k, s).pow(n))));
    return {
      sub,
      text: `Expected value of the highest of ${n} fair ${s}-sided dice?`,
      unit: "num",
      exact: e,
      solution: [`E[max] = Σ_k P(max ≥ k) = Σ_k (1 − ((k−1)/${s})^${n}) = ${e}.`],
      hint: "Tail-sum formula.",
      params: { sub, n, s },
    };
  }
  if (sub === "coupon") {
    const s = r.pick([4, 6, 8, 10]);
    const e = F(s).mul(harmonic(s));
    return {
      sub,
      text: `Expected number of rolls of a fair ${s}-sided die until every face has appeared?`,
      unit: "num",
      exact: e,
      solution: [`${s}·(1 + 1/2 + … + 1/${s}) = ${e}.`],
      hint: "Coupon collector: s·H_s.",
      params: { sub, s },
    };
  }
  if (sub === "product") {
    const n = r.int(2, 4);
    const e = F(7, 2).pow(n);
    return {
      sub,
      text: `Expected value of the product of ${n} independent fair dice?`,
      unit: "num",
      exact: e,
      solution: [`Independence: 3.5^${n} = ${e}.`],
      hint: "E[XY] = E[X]E[Y] for independent variables.",
      params: { sub, n },
    };
  }
  const k = r.int(2, 6);
  const p = r.pick([F(1, 2), F(1, 3), F(2, 3)]);
  return {
    sub,
    text: `A coin lands heads with probability ${p}. Expected number of flips needed to get ${k} heads?`,
    unit: "num",
    exact: F(k).div(p),
    solution: [`Each head takes 1/p = ${p.inv()} flips on average: ${k}/p = ${F(k).div(p)}.`],
    hint: "k/p.",
    params: { sub, k, p: p.toString() },
  };
}

function ratios(r: Rng, d: Difficulty): Draft {
  const sub = r.pick(d === 1 ? ["share", "pct_change"] : d === 2 ? ["pct_change", "compound", "rate"] : ["compound", "chain_ratio", "rate"]);
  if (sub === "share") {
    const y = r.int(200, 9000);
    const x = r.int(Math.floor(y * 0.05), Math.floor(y * 0.95));
    return {
      sub,
      text: `${x.toLocaleString("en-US")} is what percentage of ${y.toLocaleString("en-US")}?`,
      unit: "pct",
      exact: F(x * 100, y),
      solution: [`${x}/${y} × 100 = ${fmtNum((x * 100) / y)}%.`],
      hint: "Round to friendly numbers first, then adjust.",
      params: { sub, x, y },
    };
  }
  if (sub === "pct_change") {
    const steps = d === 1 ? 2 : 3;
    const ch = Array.from({ length: steps }, () => r.int(3, 30) * (r.chance(0.5) ? 1 : -1));
    const mult = ch.reduce((a, c) => a.mul(F(100 + c, 100)), Fraction.ONE);
    return {
      sub,
      text: `A price changes by ${ch.map((c) => (c > 0 ? `+${c}%` : `${c}%`)).join(", then ")}. The final price is what percentage of the original?`,
      unit: "pct",
      exact: mult.mul(100),
      solution: [`Multiply the factors: ${ch.map((c) => (1 + c / 100).toFixed(2)).join(" × ")} = ${fmtNum(mult.toNumber())}.`, `= ${fmtNum(mult.toNumber() * 100)}% of the original.`],
      hint: "Percent changes multiply; they do not add.",
      params: { sub, ch },
    };
  }
  if (sub === "compound") {
    const rate = r.pick([3, 4, 5, 6, 7, 8, 9, 10, 12, 15]);
    const years = r.int(d === 2 ? 3 : 8, d === 2 ? 8 : 25);
    const mult = F(100 + rate, 100).pow(years);
    return {
      sub,
      text: `An investment grows ${rate}% per year, compounded annually. By what factor has it grown after ${years} years?`,
      unit: "num",
      exact: mult,
      solution: [`(1.${String(rate).padStart(2, "0")})^${years} ≈ ${mult.toNumber().toFixed(4)}.`, `Rule of 72: doubling time ≈ ${(72 / rate).toFixed(1)} years.`],
      hint: "Rule of 72, then adjust.",
      params: { sub, rate, years },
    };
  }
  if (sub === "rate") {
    const km = r.int(40, 900);
    const h = r.int(0, 9);
    const m = r.int(5, 55);
    const speed = F(km * 60, h * 60 + m);
    return {
      sub,
      text: `A car covers ${km} km in ${h} h ${m} min. Average speed in km/h?`,
      unit: "num",
      exact: speed,
      solution: [`${km} km / ${(h + m / 60).toFixed(3)} h = ${fmtNum(speed.toNumber())} km/h.`],
      hint: "Convert minutes to hours: km × 60 / total minutes.",
      params: { sub, km, h, m },
    };
  }
  const a = r.int(2, 9);
  const b = r.int(2, 9);
  const c = r.int(2, 9);
  const e = r.int(2, 9);
  const ratio = F(a, b).mul(F(c, e));
  return {
    sub,
    text: `A : B = ${a} : ${b} and B : C = ${c} : ${e}. What is A / C as a decimal?`,
    unit: "num",
    exact: ratio,
    solution: [`A/C = (A/B)·(B/C) = ${a}/${b} · ${c}/${e} = ${ratio} ≈ ${fmtNum(ratio.toNumber())}.`],
    hint: "Chain the ratios.",
    params: { sub, a, b, c, e },
  };
}

function shapeGrid(r: Rng, d: Difficulty): Draft {
  const N = d === 1 ? r.int(80, 110) : d === 2 ? r.int(110, 160) : r.int(150, 200);
  const cols = 14;
  const rows = Math.ceil((N * 1.15) / cols);
  const cells = r.shuffle(Array.from({ length: cols * rows }, (_, i) => i)).slice(0, N);
  const wts = [r.int(2, 6), r.int(2, 6), r.int(2, 6)];
  const types: ShapeType[] = ["square", "circle", "triangle"];
  const shapes = cells.map((cell) => ({ t: r.weighted(types, wts), c: cell % cols, r: Math.floor(cell / cols) }));
  const cnt = (t: ShapeType) => shapes.filter((s) => s.t === t).length;
  const S = cnt("square");
  const C = cnt("circle");
  const T = cnt("triangle");
  const visual: Visual = { kind: "shapes", w: cols, h: rows, cell: 24, shapes };
  const sub = r.pick(d === 1 ? ["share", "count"] : ["two_mix", "two_same", "share", "count"]);
  const counts = `Counts: ${S} squares, ${C} circles, ${T} triangles (${N} shapes).`;
  if (sub === "two_mix") {
    const p = F(2 * S * C, N * (N - 1));
    return {
      sub,
      text: "Two shapes are picked at random without replacement. Probability (in %) that you get one square and one circle?",
      unit: "prob",
      exact: P100(p),
      visual,
      solution: [counts, `P = 2·${S}·${C} / (${N}·${N - 1}) = ${fmtNum(p.toNumber() * 100)}%.`],
      hint: "Estimate each type's share (count a few rows and scale); P ≈ 2·s·c with shares s, c.",
      params: { sub, S, C, T },
    };
  }
  if (sub === "two_same") {
    const p = F(S * (S - 1) + C * (C - 1) + T * (T - 1), N * (N - 1));
    return {
      sub,
      text: "Two shapes are picked at random without replacement. Probability (in %) that they are the same kind of shape?",
      unit: "prob",
      exact: P100(p),
      visual,
      solution: [counts, `P = Σ n_i(n_i−1) / (N(N−1)) = ${fmtNum(p.toNumber() * 100)}%.`],
      hint: "≈ s² + c² + t² with the type shares; at least 1/3.",
      params: { sub, S, C, T },
    };
  }
  if (sub === "share") {
    const p = F(T, N);
    return {
      sub,
      text: "One shape is picked at random. Probability (in %) that it is a triangle?",
      unit: "prob",
      exact: P100(p),
      visual,
      solution: [counts, `P = ${T}/${N} = ${fmtNum(p.toNumber() * 100)}%.`],
      hint: "Sample a few rows, count triangles, scale.",
      params: { sub, S, C, T },
    };
  }
  return {
    sub,
    text: "How many circles are in the grid?",
    unit: "num",
    exact: F(C),
    visual,
    solution: [counts],
    hint: `There are ${rows} rows; count a few and multiply.`,
    params: { sub, S, C, T },
  };
}

function density(r: Rng, d: Difficulty): Draft {
  const size = 300;
  const N = d === 1 ? r.int(120, 200) : d === 2 ? r.int(180, 300) : r.int(250, 420);
  const dots: [number, number][] = Array.from({ length: N }, () => [Math.round(r.next() * size * 10) / 10, Math.round(r.next() * size * 10) / 10]);
  const circle = r.chance(0.6);
  const region = circle
    ? { type: "circle" as const, cx: r.int(90, 210), cy: r.int(90, 210), r: r.int(45, 90) }
    : { type: "rect" as const, x: r.int(10, 120), y: r.int(10, 120), w: r.int(60, 160), h: r.int(60, 160) };
  const inside = (x: number, y: number) =>
    region.type === "circle" ? (x - region.cx) ** 2 + (y - region.cy) ** 2 <= region.r ** 2 : x >= region.x && x <= region.x + region.w && y >= region.y && y <= region.y + region.h;
  const k = dots.filter(([x, y]) => inside(x, y)).length;
  const visual: Visual = { kind: "dots", size, dots, region };
  const sub = r.pick(d === 1 ? ["inside_pct", "count"] : ["inside_pct", "count", "area_pct"]);
  if (sub === "inside_pct") {
    return {
      sub,
      text: "What percentage of the dots lie inside the shaded region?",
      unit: "prob",
      exact: F(k * 100, N),
      visual,
      solution: [`${k} of ${N} dots are inside: ${fmtNum((k * 100) / N)}%.`, `The region covers ${fmtNum((region.type === "circle" ? Math.PI * region.r ** 2 : region.w * region.h) / (size * size) * 100)}% of the square, a good first estimate.`],
      hint: "Dots are uniform: start from the region's share of the area.",
      params: { sub, N, k },
    };
  }
  if (sub === "count") {
    return {
      sub,
      text: "How many dots are there in total?",
      unit: "num",
      exact: F(N),
      visual,
      solution: [`There are ${N} dots.`],
      hint: "Count a small square and scale by the area.",
      params: { sub, N },
    };
  }
  const area = region.type === "circle" ? (Math.PI * region.r ** 2) / (size * size) : (region.w * region.h) / (size * size);
  return {
    sub,
    text: "What percentage of the square's area does the shaded region cover?",
    unit: "prob",
    approx: area * 100,
    exact: region.type === "rect" ? F(region.w * region.h * 100, size * size) : undefined,
    visual,
    solution: [region.type === "circle" ? `π·${region.r}² / ${size}² = ${fmtNum(area * 100)}%.` : `${region.w}·${region.h} / ${size}² = ${fmtNum(area * 100)}%.`],
    hint: "Compare the region's width with the square's side.",
    params: { sub, region, size },
  };
}

function fermi(r: Rng, d: Difficulty): Draft {
  const sub = r.pick(["customers", "distance", "seconds", "heartbeats", "tiles", "paper"]);
  if (sub === "customers") {
    const perH = r.int(12, 90);
    const hours = r.pick([8, 9.5, 10, 11.5, 12, 14]);
    const days = r.int(5, 7);
    const weeks = d === 1 ? r.int(2, 8) : 52;
    const v = F(perH).mul(Fraction.parse(String(hours))).mul(days).mul(weeks);
    return {
      sub,
      text: `A café serves ${perH} customers per hour, is open ${hours} hours a day, ${days} days a week. How many customers in ${weeks} weeks?`,
      unit: "num",
      exact: v,
      solution: [`${perH} × ${hours} × ${days} × ${weeks} = ${fmtNum(v.toNumber())}.`],
      hint: "Multiply step by step, rounding sensibly.",
      params: { sub, perH, hours, days, weeks },
    };
  }
  if (sub === "distance") {
    const speed = r.int(45, 130);
    const h = r.int(1, 12);
    const m = r.pick([0, 10, 15, 20, 30, 40, 45, 50]);
    const v = F(speed).mul(F(h * 60 + m, 60));
    return {
      sub,
      text: `A train averages ${speed} km/h for ${h} h ${m} min. How many km does it travel?`,
      unit: "num",
      exact: v,
      solution: [`${speed} × ${(h + m / 60).toFixed(3)} = ${fmtNum(v.toNumber())} km.`],
      hint: "Minutes/60 → hours.",
      params: { sub, speed, h, m },
    };
  }
  if (sub === "seconds") {
    const days = r.int(2, d === 3 ? 400 : 40);
    const hours = r.int(0, 23);
    const v = F((days * 24 + hours) * 3600);
    return {
      sub,
      text: `How many seconds are there in ${days} days and ${hours} hours?`,
      unit: "num",
      exact: v,
      solution: [`(${days}·24 + ${hours}) h × 3600 s = ${fmtNum(v.toNumber())}.`],
      hint: "One day = 86,400 s.",
      params: { sub, days, hours },
    };
  }
  if (sub === "heartbeats") {
    const bpm = r.int(55, 90);
    const days = r.int(1, d === 3 ? 365 : 30);
    const v = F(bpm * 60 * 24 * days);
    return {
      sub,
      text: `A heart beats ${bpm} times per minute. How many beats in ${days} days?`,
      unit: "num",
      exact: v,
      solution: [`${bpm} × 1440 × ${days} = ${fmtNum(v.toNumber())}.`],
      hint: "1 day = 1,440 minutes.",
      params: { sub, bpm, days },
    };
  }
  if (sub === "tiles") {
    const s = r.pick([20, 25, 30, 40, 50]);
    const L = (r.int(8, 30) * s) / 100;
    const W = (r.int(6, 20) * s) / 100;
    const v = F(Math.round((L * 100) / s) * Math.round((W * 100) / s));
    return {
      sub,
      text: `How many ${s} cm × ${s} cm tiles cover a ${L} m × ${W} m floor exactly?`,
      unit: "num",
      exact: v,
      solution: [`${(L * 100) / s} tiles along × ${(W * 100) / s} tiles across = ${fmtNum(v.toNumber())}.`],
      hint: "Tiles per side, multiplied.",
      params: { sub, s, L, W },
    };
  }
  const sheets = r.pick([500, 400, 250]);
  const cm = r.pick([4, 5, 6]);
  const n = r.int(1, 90) * 1000;
  const v = F(n * cm, sheets * 100);
  return {
    sub,
    text: `A pack of ${sheets} sheets is ${cm} cm thick. How tall (in metres) is a stack of ${n.toLocaleString("en-US")} sheets?`,
    unit: "num",
    exact: v,
    solution: [`${n} / ${sheets} packs × ${cm} cm = ${fmtNum((n / sheets) * cm)} cm = ${fmtNum(v.toNumber())} m.`],
    hint: "Count packs first.",
    params: { sub, sheets, cm, n },
  };
}

function truthLabel(truth: number, unit: IvUnit, exact?: Fraction): string {
  const base = `${fmtNum(truth)}${unit === "num" ? "" : "%"}`;
  if (!exact || exact.isInteger()) return base;
  const shown = unit === "prob" ? exact.div(100) : exact;
  const str = shown.toString();
  return str.length <= 13 ? `${base} (= ${str})` : base;
}

const GENS: Record<string, (r: Rng, d: Difficulty) => Draft> = {
  exact_prob: exactProb,
  sampling,
  expected,
  ratios,
  shape_grid: shapeGrid,
  density,
  fermi,
};

export function generateInterval(family: string, difficulty: Difficulty, seed: number): IntervalItem {
  const g = GENS[family];
  if (!g) throw new Error(`unknown Intervals family ${family}`);
  const r = itemRng("intervals", family, difficulty, seed);
  for (let i = 0; i < 100; i++) {
    const dr = g(r, difficulty);
    const truth = dr.approx ?? dr.exact!.toNumber();
    if (!(truth > 0) || !Number.isFinite(truth)) continue; // lower = 0 always scores 0, so truth must be positive
    if (dr.unit === "prob" && truth >= 100) continue;
    const exactStr = dr.approx === undefined && dr.exact ? dr.exact.toString() : null;
    return {
      family,
      difficulty,
      seed,
      sub: dr.sub,
      text: dr.text,
      unit: dr.unit,
      truth,
      truthExact: exactStr,
      truthLabel: truthLabel(truth, dr.unit, dr.approx === undefined ? dr.exact : undefined),
      visual: dr.visual,
      solution: dr.solution,
      hint: dr.hint,
      params: dr.params,
    };
  }
  throw new Error(`Intervals ${family}/${difficulty}/${seed}: no valid item`);
}

// ---------- scoring ----------

export interface IntervalResponse {
  lower: string;
  upper: string;
}

export function parseBound(s: string): Fraction | null {
  const t = s.trim().replace(/,/g, "").replace(/%$/, "");
  if (!t) return null;
  try {
    const f = Fraction.parse(t);
    return f;
  } catch {
    return null;
  }
}

export function validateInterval(resp: IntervalResponse | null, unit: IvUnit): string | null {
  if (!resp) return "Enter both bounds.";
  const lo = parseBound(resp.lower);
  const hi = parseBound(resp.upper);
  if (!lo || !hi) return "Enter both bounds as numbers.";
  if (lo.sign() < 0 || hi.sign() < 0) return "Bounds must be ≥ 0.";
  if (lo.gt(hi)) return "Lower bound must be ≤ upper bound.";
  if (unit === "prob" && hi.gt(100)) return "Probabilities are on a 0–100 scale.";
  return null;
}

/** Score if the truth lies inside: lower ÷ upper (lower = 0 scores 0). */
export function scoreIfHit(lower: Fraction, upper: Fraction): number {
  if (lower.sign() <= 0 || upper.sign() <= 0) return 0;
  return lower.div(upper).toNumber();
}

export function contains(item: Pick<IntervalItem, "truth" | "truthExact">, lower: Fraction, upper: Fraction): boolean {
  if (item.truthExact) {
    const t = Fraction.parse(item.truthExact);
    return lower.cmp(t) <= 0 && t.cmp(upper) <= 0;
  }
  return lower.toNumber() <= item.truth && item.truth <= upper.toNumber();
}

export function scoreInterval(item: Pick<IntervalItem, "truth" | "truthExact" | "unit">, resp: IntervalResponse | null): { correct: boolean | null; score: number } {
  if (!resp || validateInterval(resp, item.unit)) return { correct: null, score: 0 };
  const lo = parseBound(resp.lower)!;
  const hi = parseBound(resp.upper)!;
  const hit = contains(item, lo, hi);
  return { correct: hit, score: hit ? scoreIfHit(lo, hi) : 0 };
}
