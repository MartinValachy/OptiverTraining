import { describe, expect, it } from "vitest";
import { Fraction } from "@/lib/fraction";
import { makeRng } from "@/lib/rng";
import { combinations } from "@/lib/math";
import { DIFFICULTIES } from "@/modules/types";
import { IV_FAMILIES, generateInterval, scoreInterval, scoreIfHit, validateInterval, type IntervalItem } from "../generate";

const N = 1000;

/** Independent recomputation of the truth from the item parameters / visual. */
function recompute(it: IntervalItem): number {
  const p = it.params as Record<string, never>;
  switch (it.sub) {
    case "die_beat": {
      const s = p.s as number;
      return 100 * (p.rel === "greater" ? (s - 1) / (2 * s) : p.rel === "atleast" ? (s + 1) / (2 * s) : 1 / s);
    }
    case "sum_atleast":
    case "sum3": {
      let dist = [1];
      for (let i = 0; i < (p.n as number); i++) {
        const nd = new Array(dist.length + 6).fill(0);
        dist.forEach((x, s) => {
          for (let f = 1; f <= 6; f++) nd[s + f] += x / 6;
        });
        dist = nd;
      }
      return 100 * dist.slice(p.k as number).reduce((a, b) => a + b, 0);
    }
    case "heads_k": {
      let row = [1];
      for (let i = 0; i < (p.n as number); i++) row = [...row, 0].map((x, k) => x + (k ? row[k - 1] : 0));
      return (100 * row[p.k as number]) / 2 ** (p.n as number);
    }
    case "atleast_one":
      return 100 * (1 - (5 / 6) ** (p.n as number));
    case "max_beat": {
      let s = 0;
      for (let k = 1; k <= 6; k++) s += ((2 * k - 1) / 36) * ((k - 1) / 6);
      return 100 * s;
    }
    case "all_red":
    case "atleast_one_red": {
      const balls = [...Array(p.red as number).fill(1), ...Array(p.blue as number).fill(0)];
      let hit = 0;
      let tot = 0;
      for (const c of combinations(balls.map((_, i) => i), p.k as number)) {
        tot++;
        const reds = c.filter((i) => balls[i] === 1).length;
        if (it.sub === "all_red" ? reds === c.length : reds > 0) hit++;
      }
      return (100 * hit) / tot;
    }
    case "no_suit": {
      let q = 1;
      for (let i = 0; i < (p.n as number); i++) q *= (39 - i) / (52 - i);
      return 100 * q;
    }
    case "committee": {
      let hit = 0;
      let tot = 0;
      for (const c of combinations(Array.from({ length: p.N as number }, (_, i) => i), p.k as number)) {
        tot++;
        if (c.filter((i) => i < (p.w as number)).length === p.j) hit++;
      }
      return (100 * hit) / tot;
    }
    case "pair_in_hand": {
      let distinct = 0;
      let tot = 0;
      for (const c of combinations(Array.from({ length: 52 }, (_, i) => i), p.n as number)) {
        tot++;
        if (new Set(c.map((x) => x % 13)).size === c.length) distinct++;
      }
      return 100 * (1 - distinct / tot);
    }
    case "rolls_until":
      return 1 / Fraction.parse(p.p as string).toNumber();
    case "max2":
    case "max_n": {
      const n = p.n as number;
      const s = p.s as number;
      let e = 0;
      for (let k = 1; k <= s; k++) e += k * ((k / s) ** n - ((k - 1) / s) ** n);
      return e;
    }
    case "coupon": {
      const s = p.s as number;
      let e = 0;
      for (let i = 0; i < s; i++) e += s / (s - i);
      return e;
    }
    case "product":
      return 3.5 ** (p.n as number);
    case "flips_k":
      return (p.k as number) / Fraction.parse(p.p as string).toNumber();
    case "share":
      if (it.family === "ratios") return (100 * (p.x as number)) / (p.y as number);
      break;
    case "pct_change":
      return 100 * (p.ch as number[]).reduce((a, c) => a * (1 + c / 100), 1);
    case "compound":
      return (1 + (p.rate as number) / 100) ** (p.years as number);
    case "rate":
      return ((p.km as number) * 60) / ((p.h as number) * 60 + (p.m as number));
    case "chain_ratio":
      return ((p.a as number) / (p.b as number)) * ((p.c as number) / (p.e as number));
    case "customers":
      return (p.perH as number) * (p.hours as number) * (p.days as number) * (p.weeks as number);
    case "distance":
      return ((p.speed as number) * ((p.h as number) * 60 + (p.m as number))) / 60;
    case "seconds":
      return ((p.days as number) * 24 + (p.hours as number)) * 3600;
    case "heartbeats":
      return (p.bpm as number) * 1440 * (p.days as number);
    case "tiles":
      return Math.round(((p.L as number) * 100) / (p.s as number)) * Math.round(((p.W as number) * 100) / (p.s as number));
    case "paper":
      return ((p.n as number) / (p.sheets as number)) * (p.cm as number) / 100;
  }
  if (it.family === "shape_grid" && it.visual?.kind === "shapes") {
    const sh = it.visual.shapes;
    const S = sh.filter((x) => x.t === "square").length;
    const C = sh.filter((x) => x.t === "circle").length;
    const T = sh.filter((x) => x.t === "triangle").length;
    const n = sh.length;
    // shapes must sit in distinct cells
    expect(new Set(sh.map((x) => `${x.c},${x.r}`)).size).toBe(n);
    if (it.sub === "two_mix") return (100 * 2 * S * C) / (n * (n - 1));
    if (it.sub === "two_same") return (100 * (S * (S - 1) + C * (C - 1) + T * (T - 1))) / (n * (n - 1));
    if (it.sub === "share") return (100 * T) / n;
    if (it.sub === "count") return C;
  }
  if (it.family === "density" && it.visual?.kind === "dots") {
    const { dots, region, size } = it.visual;
    if (it.sub === "count") return dots.length;
    if (it.sub === "inside_pct") {
      const inside = dots.filter(([x, y]) => (region.type === "circle" ? Math.hypot(x - region.cx, y - region.cy) <= region.r : x >= region.x && x <= region.x + region.w && y >= region.y && y <= region.y + region.h));
      return (100 * inside.length) / dots.length;
    }
    if (it.sub === "area_pct") return (100 * (region.type === "circle" ? Math.PI * region.r * region.r : region.w * region.h)) / (size * size);
  }
  throw new Error(`no recompute for ${it.family}/${it.sub}`);
}

for (const fam of IV_FAMILIES) {
  describe(`Intervals ${fam.id}`, () => {
    for (const d of DIFFICULTIES) {
      it(`difficulty ${d}: ${N} items, truth re-derived`, () => {
        const cache = new Map<string, number>();
        for (let seed = 0; seed < N; seed++) {
          const it = generateInterval(fam.id, d, seed);
          const tag = `${fam.id}/${d}/${seed} ${it.text}`;
          expect(it.truth > 0 && Number.isFinite(it.truth), tag).toBe(true);
          if (it.unit === "prob") expect(it.truth < 100, tag).toBe(true);
          const key = it.visual ? `${seed}` : JSON.stringify(it.params);
          const v = cache.get(key) ?? recompute(it);
          cache.set(key, v);
          expect(Math.abs(v - it.truth) / Math.max(1, Math.abs(v)), tag).toBeLessThan(1e-9);
          if (it.truthExact) expect(Math.abs(Fraction.parse(it.truthExact).toNumber() - it.truth)).toBeLessThan(1e-9 * Math.max(1, it.truth));
          // the exact truth as a degenerate interval scores 100%
          if (it.truthExact && Fraction.parse(it.truthExact).d < 10n ** 12n) {
            const t = Fraction.parse(it.truthExact).toString();
            expect(scoreInterval(it, { lower: t, upper: t }).score, tag).toBe(1);
          }
          if (it.family === "shape_grid") {
            const n = it.visual?.kind === "shapes" ? it.visual.shapes.length : 0;
            expect(n >= 80 && n <= 200, tag).toBe(true);
          }
        }
      });
    }
  });
}

describe("Intervals Monte Carlo cross-check", () => {
  it("probabilistic truths agree with simulation", () => {
    const r = makeRng(3);
    for (const fam of ["exact_prob", "sampling"])
      for (const d of DIFFICULTIES)
        for (let seed = 0; seed < 6; seed++) {
          const it = generateInterval(fam, d, seed);
          const p = it.params as Record<string, never>;
          const M = 100_000;
          let hits = 0;
          for (let k = 0; k < M; k++) {
            const die = (s: number) => r.int(1, s);
            let h = false;
            switch (it.sub) {
              case "die_beat": {
                const a = die(p.s);
                const b = die(p.s);
                h = p.rel === "greater" ? a > b : p.rel === "atleast" ? a >= b : a === b;
                break;
              }
              case "sum_atleast":
              case "sum3":
                h = Array.from({ length: p.n }, () => die(6)).reduce((x, y) => x + y, 0) >= p.k;
                break;
              case "heads_k":
                h = Array.from({ length: p.n }, () => r.next() < 0.5).filter(Boolean).length === p.k;
                break;
              case "atleast_one":
                h = Array.from({ length: p.n }, () => die(6)).includes(6);
                break;
              case "max_beat":
                h = Math.max(die(6), die(6)) > die(6);
                break;
              case "all_red":
              case "atleast_one_red": {
                const draw = r.shuffle([...Array(p.red).fill(1), ...Array(p.blue).fill(0)]).slice(0, p.k);
                h = it.sub === "all_red" ? draw.every((x) => x === 1) : draw.some((x) => x === 1);
                break;
              }
              case "no_suit":
                h = r.shuffle(Array.from({ length: 52 }, (_, i) => i)).slice(0, p.n).every((c) => c >= 13);
                break;
              case "committee":
                h = r.shuffle(Array.from({ length: p.N }, (_, i) => i)).slice(0, p.k).filter((x) => x < p.w).length === p.j;
                break;
              case "pair_in_hand": {
                const hand = r.shuffle(Array.from({ length: 52 }, (_, i) => i)).slice(0, p.n);
                h = new Set(hand.map((x) => x % 13)).size < hand.length;
                break;
              }
            }
            if (h) hits++;
          }
          const f = (100 * hits) / M;
          const q = it.truth / 100;
          const se = 100 * Math.sqrt((q * (1 - q)) / M);
          expect(Math.abs(f - it.truth), `${it.text}`).toBeLessThan(5 * se + 0.05);
        }
  });
});

describe("Intervals scoring", () => {
  const item = { truth: 41.6666666667, truthExact: "125/3", unit: "prob" as const };
  it("hit scores lower ÷ upper, miss scores 0", () => {
    expect(scoreInterval(item, { lower: "40", upper: "50" }).score).toBeCloseTo(0.8, 12);
    expect(scoreInterval(item, { lower: "42", upper: "50" })).toEqual({ correct: false, score: 0 });
  });
  it("lower = 0 always scores 0", () => {
    expect(scoreInterval(item, { lower: "0", upper: "100" })).toEqual({ correct: true, score: 0 });
    expect(scoreIfHit(Fraction.ZERO, Fraction.parse("5"))).toBe(0);
  });
  it("[x, x] scores 100% only if exact", () => {
    expect(scoreInterval(item, { lower: "125/3", upper: "125/3" }).score).toBe(1);
    expect(scoreInterval(item, { lower: "41.67", upper: "41.67" }).score).toBe(0);
    expect(scoreInterval({ truth: 20, truthExact: "20", unit: "num" }, { lower: "20", upper: "20" }).score).toBe(1);
  });
  it("for equal width, a higher-placed interval scores more", () => {
    const t = { truth: 50, truthExact: "50", unit: "num" as const };
    const low = scoreInterval(t, { lower: "40", upper: "50" }).score;
    const high = scoreInterval(t, { lower: "50", upper: "60" }).score;
    expect(high).toBeGreaterThan(low);
  });
  it("validation", () => {
    expect(validateInterval({ lower: "5", upper: "3" }, "num")).toMatch(/≤/);
    expect(validateInterval({ lower: "-1", upper: "3" }, "num")).toMatch(/≥ 0/);
    expect(validateInterval({ lower: "1", upper: "120" }, "prob")).toMatch(/0–100/);
    expect(validateInterval({ lower: "", upper: "3" }, "num")).toBeTruthy();
    expect(validateInterval({ lower: "1,000", upper: "2,000" }, "num")).toBeNull();
    expect(scoreInterval(item, { lower: "50", upper: "40" })).toEqual({ correct: null, score: 0 });
    expect(scoreInterval(item, null)).toEqual({ correct: null, score: 0 });
  });
});
