import { Fraction, F, fsum } from "@/lib/fraction";
import { binomPmf, integrate, normCdf, normPdf, stationary } from "@/lib/math";
import { itemRng, type Rng } from "@/lib/rng";
import type { Difficulty, FamilyInfo } from "@/modules/types";
import type { Visual } from "@/modules/visual";

export const LL_FAMILIES: FamilyInfo[] = [
  { id: "subset", name: "Subset / superset events", blurb: "wins vs wins by 3+" },
  { id: "impossible", name: "Impossibility checks", blurb: "can a 90% shooter reach 95%?" },
  { id: "table", name: "Results tables", blurb: "conditional questions on a table" },
  { id: "density", name: "Densities & histograms", blurb: "read probabilities from a chart" },
  { id: "scatter", name: "Scatter plots", blurb: "regions of a point cloud" },
  { id: "timeseries", name: "Time series", blurb: "mean vs variance over short and long horizons" },
  { id: "markov_graph", name: "Markov chain diagrams", blurb: "long-run share of time per state" },
  { id: "fund", name: "Fund return histories", blurb: "compare funds year by year" },
];

/** Default minimum gap between any two statements' probabilities (3 percentage points). */
let MARGIN = 0.03;
export function setLikelihoodMargin(pp: number) {
  MARGIN = Math.max(0.005, pp / 100);
}
export function getLikelihoodMargin(): number {
  return MARGIN;
}

export interface LLItem {
  family: string;
  difficulty: Difficulty;
  seed: number;
  sub: string;
  scenario: string;
  visual?: Visual;
  statements: string[];
  probs: number[];
  exact: (string | null)[];
  /** statement indices from most to least likely */
  correctOrder: number[];
  solution: string[];
  hint: string;
  margin: number;
  params: Record<string, unknown>;
}

interface Stmt {
  text: string;
  p: number;
  exact?: Fraction;
  why?: string;
}

interface Draft {
  sub: string;
  scenario: string;
  visual?: Visual;
  pool: Stmt[];
  /** statements that should preferably be included (e.g. a subset pair) */
  prefer?: number[];
  solution: string[];
  hint: string;
  params: Record<string, unknown>;
}

const pct = (p: number) => `${(p * 100).toFixed(p < 0.01 && p > 0 ? 3 : 1)}%`;
const round1 = (x: number) => Math.round(x * 10) / 10;

/** Choose 3 statements whose probabilities are pairwise at least `margin` apart. */
export function pick3(r: Rng, pool: Stmt[], margin: number, prefer: number[] = []): Stmt[] | null {
  const idx = pool.map((_, i) => i);
  for (let t = 0; t < 60; t++) {
    let choice: number[];
    if (prefer.length >= 2 && t < 30) {
      const rest = r.shuffle(idx.filter((i) => !prefer.includes(i)));
      choice = [...r.sample(prefer, 2), rest[0]];
    } else choice = r.sample(idx, 3);
    const ps = choice.map((i) => pool[i].p).sort((a, b) => b - a);
    if (ps[0] - ps[1] >= margin && ps[1] - ps[2] >= margin) return choice.map((i) => pool[i]);
  }
  return null;
}

function poissonPmf(l: number, k: number): number {
  let p = Math.exp(-l);
  for (let i = 1; i <= k; i++) p *= l / i;
  return p;
}

// ---------- families ----------

function subset(r: Rng, d: Difficulty): Draft {
  if (d === 1) {
    const n = r.int(6, 20);
    const p = F(1, 6);
    const pk = (k: number) => binomPmf(n, k, p);
    const atLeast = (k: number) => fsum(Array.from({ length: n - k + 1 }, (_, i) => pk(k + i)));
    const pool: Stmt[] = [
      { text: "At least one six", p: 0, exact: atLeast(1) },
      { text: "At least two sixes", p: 0, exact: atLeast(2) },
      { text: "At least three sixes", p: 0, exact: atLeast(3) },
      { text: "Exactly one six", p: 0, exact: pk(1) },
      { text: "No six at all", p: 0, exact: pk(0) },
      { text: "Exactly two sixes", p: 0, exact: pk(2) },
    ].map((s) => ({ ...s, p: s.exact!.toNumber() }));
    return {
      sub: "dice",
      scenario: `You roll a fair die ${n} times.`,
      pool,
      prefer: [0, 1, 2],
      solution: ["'At least k' events are nested: at least one ⊇ at least two ⊇ at least three.", ...pool.map((s) => `${s.text}: ${pct(s.p)}`)],
      hint: "A superset event is always at least as likely as its subsets.",
      params: { sub: "dice", n },
    };
  }
  const la = round1(0.9 + r.next() * 1.8);
  const lb = round1(0.5 + r.next() * 1.5);
  const K = 40;
  const pa = Array.from({ length: K }, (_, k) => poissonPmf(la, k));
  const pb = Array.from({ length: K }, (_, k) => poissonPmf(lb, k));
  const prob = (f: (a: number, b: number) => boolean) => {
    let s = 0;
    for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) if (f(a, b)) s += pa[a] * pb[b];
    return s;
  };
  const pool: Stmt[] = [
    { text: "United win", p: prob((a, b) => a > b) },
    { text: "United win by 2 or more goals", p: prob((a, b) => a - b >= 2) },
    { text: "United win by 3 or more goals", p: prob((a, b) => a - b >= 3) },
    { text: "The match is a draw", p: prob((a, b) => a === b) },
    { text: "City win", p: prob((a, b) => b > a) },
    { text: "Both teams score", p: prob((a, b) => a > 0 && b > 0) },
    { text: "4 or more goals in total", p: prob((a, b) => a + b >= 4) },
    { text: "United score 3 or more", p: prob((a) => a >= 3) },
    { text: "City fail to score", p: prob((_, b) => b === 0) },
  ];
  const visual: Visual = {
    kind: "table",
    caption: "Probability of each number of goals",
    headers: ["Goals", "0", "1", "2", "3", "4", "5+"],
    rows: [
      ["United", ...pa.slice(0, 5).map((x) => pct(x)), pct(1 - pa.slice(0, 5).reduce((a, b) => a + b, 0))],
      ["City", ...pb.slice(0, 5).map((x) => pct(x)), pct(1 - pb.slice(0, 5).reduce((a, b) => a + b, 0))],
    ],
  };
  return {
    sub: "poisson",
    scenario: `United score a Poisson(${la}) number of goals per match and City a Poisson(${lb}) number, independently.`,
    visual,
    pool,
    prefer: d === 2 ? [0, 1, 2] : [],
    solution: ["Sum the joint probabilities P(United = a)·P(City = b) over the relevant (a, b).", ...pool.map((s) => `${s.text}: ${pct(s.p)}`)],
    hint: "'Win by 3+' is a subset of 'win by 2+', which is a subset of 'win'.",
    params: { sub: "poisson", la, lb },
  };
}

/** Binomial pmf in floating point via log-gamma-free recursion (stable for n ≤ 1000). */
export function binomPmfFloat(n: number, p: number): number[] {
  const out = new Array(n + 1).fill(0);
  // compute in log space to avoid underflow
  const lf: number[] = [0];
  for (let i = 1; i <= n; i++) lf.push(lf[i - 1] + Math.log(i));
  for (let k = 0; k <= n; k++) {
    const lp = lf[n] - lf[k] - lf[n - k] + (k ? k * Math.log(p) : 0) + (n - k ? (n - k) * Math.log(1 - p) : 0);
    out[k] = Math.exp(lp);
  }
  return out;
}

function impossible(r: Rng, d: Difficulty): Draft {
  const base = r.pick([
    { made: 90, shots: 100 },
    { made: 45, shots: 60 },
    { made: 160, shots: 200 },
    { made: 70, shots: 100 },
  ]);
  const p = base.made / base.shots;
  const m = d === 1 ? 10 : d === 2 ? r.pick([20, 50, 100]) : r.pick([50, 100, 200]);
  const tot = base.shots + m;
  const pmf = binomPmfFloat(m, p);
  // rate >= x% exactly: (made + k) * 100 >= x * tot (integer arithmetic)
  const atLeast = (x: number) => pmf.reduce((s, pk, k) => s + ((base.made + k) * 100 >= x * tot ? pk : 0), 0);
  const rate0 = Math.round(p * 100);
  const maxRate = (base.made + m) / tot;
  const imposs = Math.min(99, Math.floor(maxRate * 100) + 1);
  const k10 = Math.min(m, 10);
  const pool: Stmt[] = [
    { text: `Finishes the ${tot} shots at ${imposs}% or better`, p: atLeast(imposs), why: `even making all ${m} shots gives ${(maxRate * 100).toFixed(1)}%: impossible` },
    { text: `Finishes the ${tot} shots at ${rate0}% or better`, p: atLeast(rate0) },
    { text: `Finishes the ${tot} shots below ${rate0 - 2}%`, p: 1 - atLeast(rate0 - 2) },
    { text: `Makes every one of the next ${k10} shots`, p: p ** k10 },
    { text: `Finishes the ${tot} shots at ${rate0 + 3}% or better`, p: atLeast(rate0 + 3) },
    { text: `Misses at least one of the next ${k10} shots`, p: 1 - p ** k10 },
  ];
  return {
    sub: "shooter",
    scenario: `A shooter has made ${base.made} of ${base.shots} shots so far and makes each future shot independently with probability ${rate0}%. They take ${m} more shots (${tot} in total).`,
    pool,
    prefer: [0, 1],
    solution: [`Best possible final rate: (${base.made} + ${m})/${tot} = ${(maxRate * 100).toFixed(1)}%.`, ...pool.map((s) => `${s.text}: ${pct(s.p)}${s.why ? ` — ${s.why}` : ""}`)],
    hint: "Check what is even possible before estimating anything.",
    params: { sub: "shooter", ...base, m },
  };
}

function table(r: Rng, d: Difficulty): Draft {
  const teams = ["Lions", "Hawks", "Bears"];
  const rows = teams.map(() => {
    const hw = r.int(2, 12);
    const hd = r.int(0, 6);
    const hl = r.int(1, 8);
    const aw = r.int(1, 10);
    const ad = r.int(0, 6);
    const al = r.int(2, 10);
    return [hw, hd, hl, aw, ad, al];
  });
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const pool: Stmt[] = [];
  teams.forEach((t, i) => {
    const [hw, hd, hl, aw, ad, al] = rows[i];
    pool.push({ text: `A random ${t} match was a win`, p: 0, exact: F(hw + aw, sum(rows[i])) });
    pool.push({ text: `A random ${t} home match was a win`, p: 0, exact: F(hw, hw + hd + hl) });
    pool.push({ text: `A random ${t} away match was not lost`, p: 0, exact: F(aw + ad, aw + ad + al) });
    if (d >= 2) pool.push({ text: `A random ${t} win came at home`, p: 0, exact: F(hw, hw + aw) });
  });
  if (d === 3) {
    const wins = rows.map((x) => x[0] + x[3]);
    teams.forEach((t, i) => pool.push({ text: `A random win (by any team) belongs to the ${t}`, p: 0, exact: F(wins[i], sum(wins)) }));
  }
  for (const s of pool) s.p = s.exact!.toNumber();
  return {
    sub: "results",
    scenario: "Season results (number of matches):",
    visual: { kind: "table", headers: ["Team", "Home W", "Home D", "Home L", "Away W", "Away D", "Away L"], rows: teams.map((t, i) => [t, ...rows[i]]) },
    pool,
    solution: pool.map((s) => `${s.text}: ${s.exact} = ${pct(s.p)}`),
    hint: "Identify the denominator first: which matches are you choosing from?",
    params: { sub: "results", rows },
  };
}

function density(r: Rng, d: Difficulty): Draft {
  if (d === 1) {
    const edges = [30, 40, 50, 60, 70, 80, 90, 100];
    const mk = (shift: number) => edges.slice(0, -1).map((e) => Math.max(0, Math.round(12 * Math.exp(-(((e + 5 - shift) / 14) ** 2)) + r.int(0, 3))));
    const A = mk(r.int(55, 70));
    const B = mk(r.int(60, 78));
    const nA = A.reduce((a, b) => a + b, 0);
    const nB = B.reduce((a, b) => a + b, 0);
    const above = (c: number[], t: number) => c.reduce((s, x, i) => s + (edges[i] >= t ? x : 0), 0);
    const pool: Stmt[] = [70, 60, 80].flatMap((t) => [
      { text: `A random Class A student scored ${t} or more`, p: 0, exact: F(above(A, t), nA) },
      { text: `A random Class B student scored ${t} or more`, p: 0, exact: F(above(B, t), nB) },
    ]);
    pool.push({ text: "A random Class A student scored below 50", p: 0, exact: F(nA - above(A, 50), nA) });
    for (const s of pool) s.p = s.exact!.toNumber();
    return {
      sub: "hist",
      scenario: `Exam scores of two classes (Class A: ${nA} students, Class B: ${nB}).`,
      visual: { kind: "hist", xLabel: "score", edges, series: [{ name: "Class A", counts: A }, { name: "Class B", counts: B }] },
      pool,
      solution: [`Class A counts: ${A.join(", ")}; Class B: ${B.join(", ")} (bins of 10 from 30).`, ...pool.map((s) => `${s.text}: ${s.exact} = ${pct(s.p)}`)],
      hint: "Use proportions within each class, not raw counts.",
      params: { sub: "hist", A, B },
    };
  }
  const names = ["X", "Y", "Z"].slice(0, d === 2 ? 2 : 3);
  const dist = names.map(() => ({ mu: r.int(40, 70), sd: r.pick([5, 8, 10, 12, 15, 20]) }));
  const t1 = r.int(50, 75);
  const pool: Stmt[] = [];
  names.forEach((n, i) => {
    pool.push({ text: `${n} > ${t1}`, p: 1 - normCdf(t1, dist[i].mu, dist[i].sd) });
    pool.push({ text: `${n} < ${t1 - 20}`, p: normCdf(t1 - 20, dist[i].mu, dist[i].sd) });
  });
  for (let i = 0; i < names.length; i++)
    for (let j = 0; j < names.length; j++)
      if (i !== j) pool.push({ text: `${names[i]} > ${names[j]} (independent draws)`, p: 1 - normCdf(0, dist[i].mu - dist[j].mu, Math.hypot(dist[i].sd, dist[j].sd)) });
  const xs = Array.from({ length: 61 }, (_, k) => k * 2);
  return {
    sub: "normal",
    scenario: `${names.join(", ")} are independent and normally distributed with the densities shown (${names.map((n, i) => `${n}: mean ${dist[i].mu}, sd ${dist[i].sd}`).join("; ")}).`,
    visual: { kind: "curves", xLabel: "value", markers: [t1, t1 - 20], series: names.map((n, i) => ({ name: n, points: xs.map((x) => [x, normPdf(x, dist[i].mu, dist[i].sd)] as [number, number]) })) },
    pool,
    solution: ["Standardise: P(X > t) = 1 − Φ((t − μ)/σ); X − Y is normal with mean μx − μy and sd √(σx² + σy²).", ...pool.map((s) => `${s.text}: ${pct(s.p)}`)],
    hint: "Count standard deviations from the mean.",
    params: { sub: "normal", dist, t1 },
  };
}

function scatter(r: Rng, d: Difficulty): Draft {
  const n = d === 1 ? 40 : d === 2 ? 60 : 80;
  const rho = r.pick([-0.6, -0.3, 0, 0.4, 0.7, 0.85]);
  const pts: [number, number][] = Array.from({ length: n }, () => {
    const z1 = r.normal();
    const z2 = rho * z1 + Math.sqrt(1 - rho * rho) * r.normal();
    const clip = (v: number) => Math.max(1, Math.min(99, Math.round(v)));
    return [clip(50 + 18 * z1), clip(50 + 18 * z2)];
  });
  const share = (f: (x: number, y: number) => boolean) => F(pts.filter(([x, y]) => f(x, y)).length, n);
  const a = r.int(55, 70);
  const b = r.int(30, 45);
  const pool: Stmt[] = [
    { text: "y > x", p: 0, exact: share((x, y) => y > x) },
    { text: `x > ${a}`, p: 0, exact: share((x) => x > a) },
    { text: `x > ${a} and y > ${a}`, p: 0, exact: share((x, y) => x > a && y > a) },
    { text: `x + y > ${2 * a}`, p: 0, exact: share((x, y) => x + y > 2 * a) },
    { text: `y < ${b}`, p: 0, exact: share((_, y) => y < b) },
    { text: `x < ${b} or y < ${b}`, p: 0, exact: share((x, y) => x < b || y < b) },
  ].map((s) => ({ ...s, p: s.exact!.toNumber() }));
  return {
    sub: "points",
    scenario: `One of the ${n} plotted points is picked at random.`,
    visual: { kind: "scatter", xLabel: "x", yLabel: "y", points: pts, domain: [0, 100] },
    pool,
    solution: pool.map((s) => `${s.text}: ${s.exact} = ${pct(s.p)}`),
    hint: "'A and B' can never beat 'A'; 'A or B' can never lose to 'A'.",
    params: { sub: "points", pts },
  };
}

/** P(series i is the highest at horizon T) for independent normal increments. */
export function pHighest(params: { mu: number; sd: number }[], i: number, T: number): number {
  const m = params.map((p) => p.mu * T);
  const s = params.map((p) => p.sd * Math.sqrt(T));
  const lo = m[i] - 9 * s[i];
  const hi = m[i] + 9 * s[i];
  if (params.length === 2) {
    const j = 1 - i;
    return 1 - normCdf(0, m[i] - m[j], Math.hypot(s[i], s[j]));
  }
  return integrate((x) => normPdf(x, m[i], s[i]) * params.reduce((acc, _, j) => (j === i ? acc : acc * normCdf(x, m[j], s[j])), 1), lo, hi, 1600);
}

function timeseries(r: Rng, d: Difficulty): Draft {
  const names = ["A", "B", "C"].slice(0, d === 1 ? 2 : 3);
  const ps = names.map(() => ({ mu: r.pick([-0.05, 0, 0.05, 0.1, 0.2, 0.3]), sd: r.pick([0.5, 1, 2, 3, 4]) }));
  const shortT = 1;
  const longT = r.pick([250, 500]);
  const pool: Stmt[] = [];
  names.forEach((n, i) => {
    pool.push({ text: `${n} is the highest after ${shortT} day`, p: pHighest(ps, i, shortT) });
    pool.push({ text: `${n} is the highest after ${longT} days`, p: pHighest(ps, i, longT) });
    pool.push({ text: `${n} ends below its start after ${longT} days`, p: normCdf(0, ps[i].mu * longT, ps[i].sd * Math.sqrt(longT)) });
  });
  const steps = 60;
  const values = ps.map((p) => {
    let v = 100;
    return Array.from({ length: steps }, (_, k) => (k === 0 ? v : (v = Math.round((v + p.mu + p.sd * r.normal()) * 100) / 100)));
  });
  return {
    sub: "assets",
    scenario: `${names.length} assets start at the same value. Each day they change independently by a normal amount: ${names
      .map((n, i) => `${n}: mean ${ps[i].mu >= 0 ? "+" : ""}${ps[i].mu}, sd ${ps[i].sd}`)
      .join("; ")}. The chart shows a sample history.`,
    visual: { kind: "lines", xLabel: "day", series: names.map((n, i) => ({ name: n, values: values[i] })) },
    pool,
    solution: [
      "After T days asset i has moved by N(μᵢT, σᵢ²T): the mean grows like T, the noise like √T.",
      "Short horizon: noise dominates, so the most volatile asset is most likely on top. Long horizon: the highest mean wins.",
      ...pool.map((s) => `${s.text}: ${pct(s.p)}`),
    ],
    hint: "Compare mean·T with sd·√T for each horizon.",
    params: { sub: "assets", ps, longT },
  };
}

function markovGraph(r: Rng): Draft {
  const names = ["A", "B", "C"];
  const opts = [F(1, 2), F(1, 3), F(2, 3), F(1, 4), F(3, 4)];
  for (;;) {
    const P: Fraction[][] = names.map((_, i) => {
      const row = names.map(() => Fraction.ZERO);
      const targets = r.shuffle(names.map((_, j) => j)).slice(0, r.int(1, 2) + 1);
      if (targets.length === 1) {
        const t = targets[0] === i ? (i + 1) % 3 : targets[0];
        row[t] = Fraction.ONE;
      } else {
        const p = r.pick(opts);
        row[targets[0]] = p;
        row[targets[1]] = p.comp();
      }
      return row;
    });
    // irreducible?
    const reach = (s: number) => {
      const seen = new Set([s]);
      const st = [s];
      while (st.length) {
        const u = st.pop()!;
        P[u].forEach((p, v) => {
          if (!p.isZero() && !seen.has(v)) {
            seen.add(v);
            st.push(v);
          }
        });
      }
      return seen.size === 3;
    };
    if (![0, 1, 2].every(reach)) continue;
    const pi = stationary(P);
    const pool: Stmt[] = names.map((n, i) => ({ text: `The token is at ${n}`, p: pi[i].toNumber(), exact: pi[i] }));
    const pos = [
      { id: "A", x: 60, y: 40 },
      { id: "B", x: 240, y: 40 },
      { id: "C", x: 150, y: 190 },
    ];
    const edges: { from: number; to: number; label: string }[] = [];
    P.forEach((row, i) => row.forEach((p, j) => !p.isZero() && edges.push({ from: i, to: j, label: p.toString() })));
    return {
      sub: "stationary",
      scenario: "A token moves every second along the arrows with the probabilities shown. After a very long time, how likely is each position?",
      visual: { kind: "graph", nodes: pos, edges },
      pool,
      solution: ["Solve π = πP with π_A + π_B + π_C = 1.", ...pool.map((s) => `π_${s.text.slice(-1)} = ${s.exact} = ${pct(s.p)}`)],
      hint: "Flow into each state equals flow out in the long run.",
      params: { sub: "stationary", P: P.map((row) => row.map((x) => x.toString())) },
    };
  }
}

function fund(r: Rng, d: Difficulty): Draft {
  const years = d === 1 ? 10 : 12;
  const names = ["Alpha", "Beta", "Gamma"];
  const spec = names.map(() => ({ mu: r.pick([2, 4, 6, 8]), sd: r.pick([3, 6, 10, 15]) }));
  let data = spec.map((s) => Array.from({ length: years }, () => Math.round((s.mu + s.sd * r.normal()) * 10) / 10));
  // no ties within a year, so "best of the three" is always well defined
  while (Array.from({ length: years }, (_, y) => new Set(data.map((x) => x[y])).size).some((n) => n < 3))
    data = spec.map((s) => Array.from({ length: years }, () => Math.round((s.mu + s.sd * r.normal()) * 10) / 10));
  const share = (f: (y: number) => boolean) => F(Array.from({ length: years }, (_, y) => y).filter(f).length, years);
  const pool: Stmt[] = [];
  names.forEach((n, i) => {
    pool.push({ text: `In a random year, ${n} had a negative return`, p: 0, exact: share((y) => data[i][y] < 0) });
    pool.push({ text: `In a random year, ${n} was the best of the three`, p: 0, exact: share((y) => data[i][y] > Math.max(...data.filter((_, j) => j !== i).map((x) => x[y]))) });
    pool.push({ text: `In a random year, ${n} returned more than 10%`, p: 0, exact: share((y) => data[i][y] > 10) });
  });
  pool.push({ text: `In a random year, ${names[0]} beat ${names[1]}`, p: 0, exact: share((y) => data[0][y] > data[1][y]) });
  for (const s of pool) s.p = s.exact!.toNumber();
  const startYear = 2026 - years;
  return {
    sub: "history",
    scenario: `Annual returns (%) of three funds. One year from this table is picked at random.`,
    visual: { kind: "table", headers: ["Year", ...names], rows: Array.from({ length: years }, (_, y) => [String(startYear + y), ...data.map((x) => x[y])]) },
    pool,
    solution: pool.map((s) => `${s.text}: ${s.exact} = ${pct(s.p)}`),
    hint: "Count the qualifying years for each statement.",
    params: { sub: "history", data },
  };
}

const GENS: Record<string, (r: Rng, d: Difficulty) => Draft> = {
  subset,
  impossible,
  table,
  density,
  scatter,
  timeseries,
  markov_graph: (r) => markovGraph(r),
  fund,
};

export function generateLL(family: string, difficulty: Difficulty, seed: number): LLItem {
  const g = GENS[family];
  if (!g) throw new Error(`unknown Likelihood family ${family}`);
  const r = itemRng("likelihood", family, difficulty, seed);
  const margin = MARGIN;
  for (let attempt = 0; attempt < 200; attempt++) {
    const dr = g(r, difficulty);
    const chosen = pick3(r, dr.pool, margin, dr.prefer);
    if (!chosen) continue;
    const display = r.shuffle(chosen);
    const probs = display.map((s) => s.p);
    const correctOrder = [0, 1, 2].sort((a, b) => probs[b] - probs[a]);
    return {
      family,
      difficulty,
      seed,
      sub: dr.sub,
      scenario: dr.scenario,
      visual: dr.visual,
      statements: display.map((s) => s.text),
      probs,
      exact: display.map((s) => (s.exact ? s.exact.toString() : null)),
      correctOrder,
      solution: [...correctOrder.map((i, k) => `${k + 1}. ${display[i].text} — ${pct(probs[i])}${display[i].why ? ` (${display[i].why})` : ""}`), "", ...dr.solution],
      hint: dr.hint,
      margin,
      params: dr.params,
    };
  }
  throw new Error(`Likelihood ${family}/${difficulty}/${seed}: no well-separated triple`);
}

export function scoreLL(item: Pick<LLItem, "correctOrder">, resp: number[] | null): { correct: boolean | null; score: number } {
  if (!resp) return { correct: null, score: 0 };
  const ok = resp.length === 3 && resp.every((x, i) => x === item.correctOrder[i]);
  return { correct: ok, score: ok ? 1 : 0 };
}
