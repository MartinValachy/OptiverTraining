import { Fraction, F, fsum } from "@/lib/fraction";
import { absorptionProbabilities, binom, binomPmf, expectedHittingTimes } from "@/lib/math";
import { type BtoFamily, type Scenario, fr, pctStr } from "../core";

/** Markov chain over the prefixes of a set of patterns (Aho-Corasick style, H/T alphabet). */
export function patternAutomaton(patterns: string[], p: Fraction) {
  const prefixes = new Set<string>([""]);
  for (const pat of patterns) for (let i = 1; i <= pat.length; i++) prefixes.add(pat.slice(0, i));
  const states = [...prefixes].sort((a, b) => a.length - b.length || a.localeCompare(b));
  const idx = new Map(states.map((s, i) => [s, i]));
  const step = (s: string, c: string) => {
    let t = s + c;
    while (!prefixes.has(t)) t = t.slice(1);
    return t;
  };
  const P = states.map((s) => {
    const m = new Map<number, Fraction>();
    if (patterns.includes(s)) {
      m.set(idx.get(s)!, Fraction.ONE);
      return m;
    }
    for (const [c, pr] of [
      ["H", p],
      ["T", p.comp()],
    ] as const) {
      const j = idx.get(step(s, c))!;
      m.set(j, (m.get(j) ?? Fraction.ZERO).add(pr));
    }
    return m;
  });
  return { states, idx, P };
}

export function expectedWait(pattern: string, p: Fraction): Fraction {
  const { idx, P } = patternAutomaton([pattern], p);
  return expectedHittingTimes(P, new Set([idx.get(pattern)!]))[idx.get("")!];
}

export function firstPatternProb(a: string, b: string, p: Fraction): Fraction {
  const { idx, P } = patternAutomaton([a, b], p);
  const A = idx.get(a)!;
  const B = idx.get(b)!;
  return absorptionProbabilities(P, new Set([A, B]), new Set([A]))[idx.get("")!];
}

/** P(at least one run of >= r heads in n flips). */
export function runProb(n: number, r: number, p: Fraction): Fraction {
  // dp[j] = P(no run yet and current trailing run length j)
  let dp: Fraction[] = new Array(r).fill(Fraction.ZERO);
  dp[0] = Fraction.ONE;
  const q = p.comp();
  for (let i = 0; i < n; i++) {
    const nd: Fraction[] = new Array(r).fill(Fraction.ZERO);
    for (let j = 0; j < r; j++) {
      if (dp[j].isZero()) continue;
      nd[0] = nd[0].add(dp[j].mul(q));
      if (j + 1 < r) nd[j + 1] = nd[j + 1].add(dp[j].mul(p));
    }
    dp = nd;
  }
  return fsum(dp).comp();
}

const coinWord = (p: Fraction) => (p.eq(F(1, 2)) ? "a fair coin" : `a biased coin that lands heads with probability ${p}`);

export const coins: BtoFamily = {
  id: "coins",
  name: "Coins",
  blurb: "k heads, runs, waiting for HH vs HT, Penney's game",
  generate(r, d): Scenario {
    const subs = d === 1 ? ["k_heads", "atleast_k"] : d === 2 ? ["exp_pattern", "run", "k_heads"] : ["exp_pattern", "first_pattern", "run", "atleast_k"];
    const sub = r.pick(subs);
    const fair = F(1, 2);

    if (sub === "k_heads" || sub === "atleast_k") {
      const p = d === 1 ? fair : r.pick([F(1, 3), F(2, 3), F(3, 5), F(2, 5), F(3, 4)]);
      const n = d === 1 ? r.int(3, 6) : r.int(4, 8);
      const k = r.int(1, n - 1);
      const q = p.comp();
      if (sub === "k_heads") {
        const ans = binomPmf(n, k, p);
        return {
          sub,
          text: `You flip ${coinWord(p)} ${n} times. What is the probability of exactly ${k} head${k === 1 ? "" : "s"}?`,
          unit: "prob",
          answer: fr(ans),
          distractors: [
            { value: fr(p.pow(k).mul(q.pow(n - k))), why: `forgetting the C(${n},${k}) arrangements` },
            { value: fr(F(binom(n, k), 2n ** BigInt(n))), why: "using the fair-coin formula" },
            { value: fr(F(k, n)), why: "confusing the proportion of heads with a probability" },
            { value: fr(F(1, n + 1)), why: "assuming every head count is equally likely" },
            { value: fr(F(binom(n, k)).mul(p.pow(k))), why: "forgetting the tails factor" },
            { value: fr(binomPmf(n, k + 1, p)), why: "off by one head" },
          ],
          solution: [`Binomial: P = C(${n},${k}) · p^${k} · (1−p)^${n - k}.`, `= ${binom(n, k)} · (${p})^${k} · (${q})^${n - k} = ${ans} ≈ ${pctStr(ans)}.`],
          hint: "Binomial: choose which flips are heads, then multiply probabilities.",
          params: { sub, n, k, p: p.toString() },
        };
      }
      const ans = fsum(Array.from({ length: n - k + 1 }, (_, i) => binomPmf(n, k + i, p)));
      return {
        sub,
        text: `You flip ${coinWord(p)} ${n} times. What is the probability of at least ${k} head${k === 1 ? "" : "s"}?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(binomPmf(n, k, p)), why: `only P(exactly ${k})` },
          { value: fr(ans.sub(binomPmf(n, k, p))), why: "≥ vs >: that is P(more than k)" },
          { value: fr(ans.comp()), why: "complement error" },
          { value: fr(p.pow(k)), why: "the first k flips all being heads" },
          { value: fr(F(n - k + 1, n + 1)), why: "assuming every head count is equally likely" },
        ],
        solution: [`Sum the binomial terms P(X = j) for j = ${k}..${n} (or 1 − P(X ≤ ${k - 1})).`, `= ${ans} ≈ ${pctStr(ans)}.`],
        hint: "Use the shorter tail and subtract from 1 if needed.",
        params: { sub, n, k, p: p.toString() },
      };
    }

    if (sub === "exp_pattern") {
      const L = d === 2 ? r.pick([2, 3]) : r.pick([2, 3, 3, 4]);
      const p = d === 2 ? fair : L === 4 ? fair : r.pick([F(2, 3), F(1, 3), F(3, 5)]);
      let pat = "";
      for (let i = 0; i < L; i++) pat += r.chance(0.5) ? "H" : "T";
      const ans = expectedWait(pat, p);
      const partner = pat.slice(0, -1) + (pat.endsWith("H") ? "T" : "H");
      const probPat = [...pat].reduce((a, c) => a.mul(c === "H" ? p : p.comp()), Fraction.ONE);
      const perSymbol = fsum([...pat].map((c) => (c === "H" ? p.inv() : p.comp().inv())));
      return {
        sub,
        text: `${coinWord(p)[0].toUpperCase() + coinWord(p).slice(1)} is flipped repeatedly. What is the expected number of flips until the sequence ${pat} first appears (counting the final flip)?`,
        unit: "num",
        answer: fr(ans),
        distractors: [
          { value: fr(probPat.inv()), why: "1/P(pattern): ignores self-overlap (correct only if the pattern cannot overlap itself)" },
          { value: fr(expectedWait(partner, p)), why: `that is the answer for ${partner}` },
          { value: fr(perSymbol), why: "adding the expected wait for each symbol separately" },
          { value: fr(probPat.inv().add(L)), why: "adding the pattern length to 1/P(pattern)" },
          { value: fr(probPat.inv().sub(1)), why: "counting only the flips before the pattern completes" },
        ],
        solution: [
          `Track how much of ${pat} you have matched (states = prefixes); on a mismatch fall back to the longest suffix that is still a prefix.`,
          `Solve E[state] = 1 + Σ P(next)·E[next] for each state.`,
          `Shortcut (Conway): sum 1/P(prefix) over every k where the first k symbols equal the last k symbols.`,
          `E = ${ans}${ans.isInteger() ? "" : ` ≈ ${ans.toNumber().toFixed(3)}`}.`,
        ],
        hint: "Self-overlapping patterns (HH, HTH) take longer than non-overlapping ones (HT).",
        params: { sub, pattern: pat, p: p.toString() },
      };
    }

    if (sub === "first_pattern") {
      const L = r.pick([2, 3, 3]);
      const rand = () => Array.from({ length: L }, () => (r.chance(0.5) ? "H" : "T")).join("");
      let a = rand();
      let b = rand();
      while (b === a || a.includes(b) || b.includes(a)) {
        a = rand();
        b = rand();
      }
      const ans = firstPatternProb(a, b, fair);
      const ea = expectedWait(a, fair);
      const eb = expectedWait(b, fair);
      return {
        sub,
        text: `A fair coin is flipped until either ${a} or ${b} appears as consecutive flips. What is the probability that ${a} appears first?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(F(1, 2)), why: "symmetry fallacy: both patterns have the same probability, but not the same chance of coming first" },
          { value: fr(ans.comp()), why: `that is the probability that ${b} comes first` },
          { value: fr(eb.div(ea.add(eb))), why: "weighting by expected waiting times" },
          { value: fr(ea.div(ea.add(eb))), why: "inverse weighting by expected waiting times" },
        ],
        solution: [
          `States = longest suffix that is a prefix of ${a} or ${b}; absorbing at ${a} or ${b}.`,
          `Solve the absorption equations (or use Conway's leading numbers).`,
          `P(${a} first) = ${ans} ≈ ${pctStr(ans)}.`,
        ],
        hint: "Look at what each pattern needs right after the other one's prefix has appeared.",
        params: { sub, a, b },
      };
    }

    // run
    const rr = d === 2 ? r.pick([2, 3]) : r.pick([3, 4]);
    const n = d === 2 ? r.int(rr + 2, 10) : r.int(rr + 4, 12);
    const p = fair;
    const ans = runProb(n, rr, p);
    const pr = p.pow(rr);
    return {
      sub,
      text: `A fair coin is flipped ${n} times. What is the probability that somewhere there are at least ${rr} heads in a row?`,
      unit: "prob",
      answer: fr(ans),
      distractors: [
        { value: fr(F(n - rr + 1).mul(pr)), why: "union bound: adding the probabilities of overlapping windows" },
        { value: fr(pr.comp().pow(n - rr + 1).comp()), why: "treating overlapping windows as independent" },
        { value: fr(pr), why: "probability of one specific window" },
        { value: fr(runProb(n - 1, rr, p)), why: "off by one flip" },
        { value: fr(runProb(n, rr + 1, p)), why: `that is for ${rr + 1} in a row` },
      ],
      solution: [
        `Count sequences with no run of ${rr}: let a_j = P(no run so far, current streak j).`,
        `Each flip: tails resets the streak to 0, heads increases it; streak ${rr} is forbidden.`,
        `After ${n} flips P(no run) = ${ans.comp()}, so P(run) = ${ans} ≈ ${pctStr(ans)}.`,
      ],
      hint: "Count the complement with a small recursion on the current streak length.",
      params: { sub, n, r: rr },
    };
  },
};
