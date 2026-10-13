import { describe, expect, it } from "vitest";
import { Fraction } from "@/lib/fraction";
import { makeRng } from "@/lib/rng";
import { DIFFICULTIES } from "@/modules/types";
import { LL_FAMILIES, generateLL, getLikelihoodMargin, scoreLL, setLikelihoodMargin } from "../generate";

const N = 1000;
const WORD: Record<string, number> = { one: 1, two: 2, three: 3 };

// --- independent numeric helpers (deliberately not shared with the generator) ---
function pdf(x: number, m: number, s: number) {
  return Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
}
/** P(N(m, s) > t) by Simpson integration of the density (no erf). */
function upper(t: number, m: number, s: number) {
  const a = Math.max(t, m - 12 * s);
  const b = m + 12 * s;
  if (a >= b) return 0;
  const n = 1200;
  const h = (b - a) / n;
  let acc = pdf(a, m, s) + pdf(b, m, s);
  for (let i = 1; i < n; i++) acc += pdf(a + i * h, m, s) * (i % 2 ? 4 : 2);
  return (acc * h) / 3;
}
function poisson(l: number, k: number) {
  let lf = 0;
  for (let i = 2; i <= k; i++) lf += Math.log(i);
  return Math.exp(-l + k * Math.log(l) - lf);
}

function evaluate(fam: string, sub: string, p: Record<string, unknown>, text: string): number {
  if (fam === "subset" && sub === "dice") {
    // DP over rolls for the number of sixes
    const n = p.n as number;
    let dist = [1];
    for (let i = 0; i < n; i++) {
      const nd = new Array(dist.length + 1).fill(0);
      dist.forEach((q, k) => {
        nd[k] += (q * 5) / 6;
        nd[k + 1] += q / 6;
      });
      dist = nd;
    }
    let m = /^At least (\w+) six/.exec(text);
    if (m) return dist.slice(WORD[m[1]]).reduce((a, b) => a + b, 0);
    m = /^Exactly (\w+) six/.exec(text);
    if (m) return dist[WORD[m[1]]];
    if (text === "No six at all") return dist[0];
  }
  if (fam === "subset" && sub === "poisson") {
    const la = p.la as number;
    const lb = p.lb as number;
    const preds: Record<string, (a: number, b: number) => boolean> = {
      "United win": (a, b) => a > b,
      "United win by 2 or more goals": (a, b) => a - b >= 2,
      "United win by 3 or more goals": (a, b) => a - b >= 3,
      "The match is a draw": (a, b) => a === b,
      "City win": (a, b) => b > a,
      "Both teams score": (a, b) => a > 0 && b > 0,
      "4 or more goals in total": (a, b) => a + b >= 4,
      "United score 3 or more": (a) => a >= 3,
      "City fail to score": (_, b) => b === 0,
    };
    const pa = Array.from({ length: 61 }, (_, k) => poisson(la, k));
    const pb = Array.from({ length: 61 }, (_, k) => poisson(lb, k));
    let s = 0;
    for (let b = 60; b >= 0; b--) for (let a = 60; a >= 0; a--) if (preds[text](a, b)) s += pa[a] * pb[b];
    return s;
  }
  if (fam === "impossible") {
    const made = p.made as number;
    const shots = p.shots as number;
    const m = p.m as number;
    const q = made / shots;
    // DP over future shots
    let dist = [1];
    for (let i = 0; i < m; i++) {
      const nd = new Array(dist.length + 1).fill(0);
      dist.forEach((x, k) => {
        nd[k] += x * (1 - q);
        nd[k + 1] += x * q;
      });
      dist = nd;
    }
    const tot = shots + m;
    let mm = /at (\d+)% or better$/.exec(text);
    if (mm) return dist.reduce((s, x, k) => s + ((made + k) / tot >= Number(mm![1]) / 100 - 1e-12 ? x : 0), 0);
    mm = /below (\d+)%$/.exec(text);
    if (mm) return dist.reduce((s, x, k) => s + ((made + k) / tot < Number(mm![1]) / 100 - 1e-12 ? x : 0), 0);
    mm = /^Makes every one of the next (\d+) shots/.exec(text);
    if (mm) return q ** Number(mm[1]);
    mm = /^Misses at least one of the next (\d+) shots/.exec(text);
    if (mm) return 1 - q ** Number(mm[1]);
  }
  if (fam === "table") {
    const teams = ["Lions", "Hawks", "Bears"];
    const rows = p.rows as number[][];
    const t = teams.findIndex((x) => text.includes(x));
    const [hw, hd, hl, aw, ad, al] = rows[t];
    if (/match was a win$/.test(text) && !text.includes("home")) return (hw + aw) / (hw + hd + hl + aw + ad + al);
    if (/home match was a win$/.test(text)) return hw / (hw + hd + hl);
    if (/away match was not lost$/.test(text)) return (aw + ad) / (aw + ad + al);
    if (/win came at home$/.test(text)) return hw / (hw + aw);
    if (/belongs to the/.test(text)) {
      const wins = rows.map((r) => r[0] + r[3]);
      return wins[t] / wins.reduce((a, b) => a + b, 0);
    }
  }
  if (fam === "density" && sub === "hist") {
    const edges = [30, 40, 50, 60, 70, 80, 90];
    const c = (text.includes("Class A") ? p.A : p.B) as number[];
    const n = c.reduce((a, b) => a + b, 0);
    let m = /scored (\d+) or more/.exec(text);
    if (m) return c.reduce((s, x, i) => s + (edges[i] >= Number(m![1]) ? x : 0), 0) / n;
    m = /scored below (\d+)/.exec(text);
    if (m) return c.reduce((s, x, i) => s + (edges[i] + 10 <= Number(m![1]) ? x : 0), 0) / n;
  }
  if (fam === "density" && sub === "normal") {
    const dist = p.dist as { mu: number; sd: number }[];
    const ix = (c: string) => "XYZ".indexOf(c);
    let m = /^(\w) > (\d+)$/.exec(text);
    if (m) return upper(Number(m[2]), dist[ix(m[1])].mu, dist[ix(m[1])].sd);
    m = /^(\w) < (\d+)$/.exec(text);
    if (m) return 1 - upper(Number(m[2]), dist[ix(m[1])].mu, dist[ix(m[1])].sd);
    m = /^(\w) > (\w) \(independent draws\)$/.exec(text);
    if (m) {
      const a = dist[ix(m[1])];
      const b = dist[ix(m[2])];
      return upper(0, a.mu - b.mu, Math.sqrt(a.sd ** 2 + b.sd ** 2));
    }
  }
  if (fam === "scatter") {
    const pts = p.pts as [number, number][];
    const share = (f: (x: number, y: number) => boolean) => pts.filter(([x, y]) => f(x, y)).length / pts.length;
    if (text === "y > x") return share((x, y) => y > x);
    let m = /^x > (\d+) and y > (\d+)$/.exec(text);
    if (m) return share((x, y) => x > Number(m![1]) && y > Number(m![2]));
    m = /^x > (\d+)$/.exec(text);
    if (m) return share((x) => x > Number(m![1]));
    m = /^x \+ y > (\d+)$/.exec(text);
    if (m) return share((x, y) => x + y > Number(m![1]));
    m = /^y < (\d+)$/.exec(text);
    if (m) return share((_, y) => y < Number(m![1]));
    m = /^x < (\d+) or y < (\d+)$/.exec(text);
    if (m) return share((x, y) => x < Number(m![1]) || y < Number(m![2]));
  }
  if (fam === "timeseries") {
    const ps = p.ps as { mu: number; sd: number }[];
    let m = /^(\w) ends below its start after (\d+) days$/.exec(text);
    if (m) {
      const a = ps["ABC".indexOf(m[1])];
      const T = Number(m[2]);
      return 1 - upper(0, a.mu * T, a.sd * Math.sqrt(T));
    }
    m = /^(\w) is the highest after (\d+) days?$/.exec(text);
    if (m) {
      const i = "ABC".indexOf(m[1]);
      const T = Number(m[2]);
      const mu = ps.map((x) => x.mu * T);
      const sd = ps.map((x) => x.sd * Math.sqrt(T));
      // trapezoid on a wide grid, CDF via cumulative trapezoid of each density
      const lo = Math.min(...mu.map((x, k) => x - 12 * sd[k]));
      const hi = Math.max(...mu.map((x, k) => x + 12 * sd[k]));
      const n = 12000;
      const h = (hi - lo) / n;
      const cdf = ps.map(() => 0);
      let acc = 0;
      let prevF = 0;
      for (let k = 0; k <= n; k++) {
        const x = lo + k * h;
        if (k > 0) for (let j = 0; j < ps.length; j++) cdf[j] += (h / 2) * (pdf(x - h, mu[j], sd[j]) + pdf(x, mu[j], sd[j]));
        const f = pdf(x, mu[i], sd[i]) * cdf.reduce((a, c, j) => (j === i ? a : a * c), 1);
        if (k > 0) acc += (h / 2) * (prevF + f);
        prevF = f;
      }
      return acc;
    }
  }
  if (fam === "markov_graph") {
    const P = (p.P as string[][]).map((r) => r.map((x) => Fraction.parse(x).toNumber()));
    // power iteration on the lazy chain (I + P)/2: same stationary law, aperiodic
    let v = [1 / 3, 1 / 3, 1 / 3];
    for (let it = 0; it < 100000; it++) {
      const w = [0, 1, 2].map((j) => 0.5 * v[j] + 0.5 * v.reduce((s2, x, i) => s2 + x * P[i][j], 0));
      const delta = Math.max(...w.map((x, i) => Math.abs(x - v[i])));
      v = w;
      if (delta < 1e-16) break;
    }
    return v["ABC".indexOf(text.slice(-1))];
  }
  if (fam === "fund") {
    const data = p.data as number[][];
    const names = ["Alpha", "Beta", "Gamma"];
    const years = data[0].length;
    const count = (f: (y: number) => boolean) => Array.from({ length: years }, (_, y) => y).filter(f).length / years;
    let m = /^In a random year, (\w+) had a negative return$/.exec(text);
    if (m) return count((y) => data[names.indexOf(m![1])][y] < 0);
    m = /^In a random year, (\w+) was the best of the three$/.exec(text);
    if (m) {
      const i = names.indexOf(m[1]);
      return count((y) => data.every((row, j) => j === i || data[i][y] > row[y]));
    }
    m = /^In a random year, (\w+) returned more than 10%$/.exec(text);
    if (m) return count((y) => data[names.indexOf(m![1])][y] > 10);
    m = /^In a random year, (\w+) beat (\w+)$/.exec(text);
    if (m) return count((y) => data[names.indexOf(m![1])][y] > data[names.indexOf(m![2])][y]);
  }
  throw new Error(`no evaluator for ${fam}/${sub}: ${text}`);
}

for (const fam of LL_FAMILIES) {
  describe(`Likelihood ${fam.id}`, () => {
    for (const d of DIFFICULTIES) {
      it(`difficulty ${d}: ${N} items, ground truth re-derived, margin ≥ 3pp`, () => {
        for (let seed = 0; seed < N; seed++) {
          const it = generateLL(fam.id, d, seed);
          const tag = `${fam.id}/${d}/${seed}`;
          expect(it.statements.length).toBe(3);
          expect(new Set(it.statements).size, tag).toBe(3);
          // (a) each probability matches an independent computation
          it.statements.forEach((s, i) => {
            const v = evaluate(fam.id, it.sub, it.params, s);
            expect(Math.abs(v - it.probs[i]), `${tag} "${s}" ${v} vs ${it.probs[i]}`).toBeLessThan(fam.id === "timeseries" || it.sub === "normal" ? 2e-5 : 1e-9);
          });
          // exact fractions agree with the floats
          it.exact.forEach((e, i) => e && expect(Math.abs(Fraction.parse(e).toNumber() - it.probs[i])).toBeLessThan(1e-12));
          // (e) margin and ordering
          const sorted = it.correctOrder.map((i) => it.probs[i]);
          expect(sorted[0] - sorted[1], tag).toBeGreaterThanOrEqual(0.03 - 1e-12);
          expect(sorted[1] - sorted[2], tag).toBeGreaterThanOrEqual(0.03 - 1e-12);
          expect([...it.correctOrder].sort()).toEqual([0, 1, 2]);
          for (const pr of it.probs) expect(pr >= -1e-12 && pr <= 1 + 1e-12, tag).toBe(true);
        }
      });
    }
  });
}

describe("Likelihood Monte Carlo cross-check (200k paths)", () => {
  it("simulated frequencies agree with the analytic ground truth", () => {
    const r = makeRng(99);
    const cases: [string, number, number][] = [
      ["timeseries", 1, 1],
      ["timeseries", 3, 2],
      ["timeseries", 2, 5],
      ["subset", 2, 3],
      ["density", 3, 4],
    ];
    for (const [fam, d, seed] of cases) {
      const it = generateLL(fam, d as 1 | 2 | 3, seed);
      it.statements.forEach((s, i) => {
        const M = 200_000;
        let hits = 0;
        for (let k = 0; k < M; k++) {
          if (fam === "timeseries") {
            const ps = it.params.ps as { mu: number; sd: number }[];
            const m = /^(\w) (is the highest|ends below its start) after (\d+) days?$/.exec(s)!;
            const T = Number(m[3]);
            const vals = ps.map((p) => p.mu * T + p.sd * Math.sqrt(T) * r.normal());
            const i0 = "ABC".indexOf(m[1]);
            hits += m[2] === "is the highest" ? (vals.every((v, j) => j === i0 || vals[i0] > v) ? 1 : 0) : vals[i0] < 0 ? 1 : 0;
          } else if (fam === "subset") {
            const draw = (l: number) => {
              let k2 = 0;
              let t = Math.exp(-l);
              let acc = t;
              const u = r.next();
              while (u > acc) {
                k2++;
                t *= l / k2;
                acc += t;
              }
              return k2;
            };
            const a = draw(it.params.la as number);
            const b = draw(it.params.lb as number);
            const map: Record<string, boolean> = {
              "United win": a > b,
              "United win by 2 or more goals": a - b >= 2,
              "United win by 3 or more goals": a - b >= 3,
              "The match is a draw": a === b,
              "City win": b > a,
              "Both teams score": a > 0 && b > 0,
              "4 or more goals in total": a + b >= 4,
              "United score 3 or more": a >= 3,
              "City fail to score": b === 0,
            };
            hits += map[s] ? 1 : 0;
          } else {
            const dist = it.params.dist as { mu: number; sd: number }[];
            const v = dist.map((x) => x.mu + x.sd * r.normal());
            const ix = (c: string) => "XYZ".indexOf(c);
            let m = /^(\w) > (\d+)$/.exec(s);
            if (m) hits += v[ix(m[1])] > Number(m[2]) ? 1 : 0;
            else if ((m = /^(\w) < (\d+)$/.exec(s))) hits += v[ix(m[1])] < Number(m[2]) ? 1 : 0;
            else if ((m = /^(\w) > (\w)/.exec(s))) hits += v[ix(m[1])] > v[ix(m[2])] ? 1 : 0;
          }
        }
        const f = hits / M;
        const se = Math.sqrt((it.probs[i] * (1 - it.probs[i])) / M);
        expect(Math.abs(f - it.probs[i]), `${fam} ${s}`).toBeLessThan(5 * se + 1e-4);
      });
    }
  });
});

describe("Likelihood scoring", () => {
  it("1 point only for the exact order", () => {
    const it = generateLL("table", 1, 3);
    expect(scoreLL(it, it.correctOrder)).toEqual({ correct: true, score: 1 });
    const swapped = [it.correctOrder[1], it.correctOrder[0], it.correctOrder[2]];
    expect(scoreLL(it, swapped)).toEqual({ correct: false, score: 0 });
    const half = [it.correctOrder[0], it.correctOrder[2], it.correctOrder[1]];
    expect(scoreLL(it, half).score).toBe(0); // no partial credit
    expect(scoreLL(it, null)).toEqual({ correct: null, score: 0 });
  });
  it("margin is configurable", () => {
    const before = getLikelihoodMargin();
    setLikelihoodMargin(10);
    for (let s = 0; s < 50; s++) {
      const it = generateLL("scatter", 2, s);
      const v = it.correctOrder.map((i) => it.probs[i]);
      expect(v[0] - v[1]).toBeGreaterThanOrEqual(0.1 - 1e-12);
      expect(v[1] - v[2]).toBeGreaterThanOrEqual(0.1 - 1e-12);
    }
    setLikelihoodMargin(before * 100);
  });
});
