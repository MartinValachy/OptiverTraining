import { F, Fraction, fsum } from "@/lib/fraction";
import { absorptionProbabilities, binom, expectedHittingTimes } from "@/lib/math";
import { type BtoFamily, type Scenario, fr, pctStr } from "../core";

const PARTS: Fraction[][] = [
  [F(1, 2), F(1, 2)],
  [F(1, 3), F(2, 3)],
  [F(1, 4), F(3, 4)],
  [F(2, 5), F(3, 5)],
  [F(1, 2), F(1, 4), F(1, 4)],
  [F(1, 3), F(1, 3), F(1, 3)],
  [F(1, 6), F(1, 3), F(1, 2)],
];

export function crapsWin(): Fraction {
  const p = (s: number) => F(6 - Math.abs(s - 7), 36);
  const natural = p(7).add(p(11));
  const points = [4, 5, 6, 8, 9, 10].map((s) => p(s).mul(p(s)).div(p(s).add(p(7))));
  return natural.add(fsum(points));
}

export function raceWin(n: number, p: Fraction): Fraction {
  const q = p.comp();
  return fsum(Array.from({ length: n }, (_, j) => F(binom(n - 1 + j, j)).mul(p.pow(n)).mul(q.pow(j))));
}

export interface RandomChain {
  names: string[];
  P: Map<number, Fraction>[];
  t: number;
}

export function randomChain(r: { int(a: number, b: number): number; pick<T>(x: readonly T[]): T; shuffle<T>(x: readonly T[]): T[] }, t: number): RandomChain {
  const names = ["A", "B", "C", "D"].slice(0, t).concat(["Win", "Lose"]);
  for (;;) {
    const P: Map<number, Fraction>[] = [];
    for (let i = 0; i < t; i++) {
      const parts = r.pick(PARTS);
      const targets = r.shuffle(names.map((_, j) => j).filter((j) => j !== i)).slice(0, parts.length);
      const m = new Map<number, Fraction>();
      parts.forEach((pr, k) => m.set(targets[k], pr));
      P.push(m);
    }
    P.push(new Map([[t, Fraction.ONE]]), new Map([[t + 1, Fraction.ONE]]));
    // every transient state must reach absorption; start must be able to reach both ends
    const reach = (from: number) => {
      const seen = new Set([from]);
      const st = [from];
      while (st.length)
        for (const j of P[st.pop()!].keys())
          if (!seen.has(j)) {
            seen.add(j);
            st.push(j);
          }
      return seen;
    };
    let ok = true;
    for (let i = 0; i < t; i++) {
      const rs = reach(i);
      if (!rs.has(t) && !rs.has(t + 1)) ok = false;
    }
    const r0 = reach(0);
    if (!r0.has(t) || !r0.has(t + 1)) ok = false;
    // the chain should not be trivial: A must not go straight to absorption only
    if ([...P[0].keys()].every((j) => j >= t)) ok = false;
    if (ok) return { names, P, t };
  }
}

function describeChain(c: RandomChain): string {
  return c.P.slice(0, c.t)
    .map((m, i) => `From ${c.names[i]}: ` + [...m].map(([j, p]) => `${c.names[j]} with probability ${p}`).join(", ") + ".")
    .join(" ");
}

export const markov: BtoFamily = {
  id: "markov",
  name: "Markov chains",
  blurb: "Absorption probabilities, deuce, races, craps",
  generate(r, d): Scenario {
    const sub = d === 1 ? r.pick(["deuce", "race"]) : d === 2 ? r.pick(["chain_prob", "race", "deuce"]) : r.pick(["chain_prob", "chain_steps", "craps"]);

    if (sub === "deuce") {
      const p = r.pick([F(3, 5), F(2, 3), F(3, 4), F(4, 7), F(5, 9), F(2, 5)]);
      const q = p.comp();
      const ans = p.pow(2).div(p.pow(2).add(q.pow(2)));
      return {
        sub,
        text: `Two players are at deuce: the game ends as soon as one player is two points ahead. Player A wins each point independently with probability ${p}. What is the probability that A wins the game?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(p), why: "the single-point probability" },
          { value: fr(p.pow(2)), why: "winning the next two points only" },
          { value: fr(q.pow(2).comp()), why: "winning at least one of the next two points" },
          { value: fr(p.pow(2).add(F(2).mul(p).mul(q).mul(p))), why: "allowing only one return to deuce" },
        ],
        solution: [
          "From deuce: AA → A wins (p²), BB → B wins (q²), otherwise back to deuce (2pq).",
          `P = p² + 2pq·P ⇒ P = p²/(p² + q²) = ${ans} ≈ ${pctStr(ans)}.`,
        ],
        hint: "Look two points ahead: win, lose or back to deuce.",
        params: { sub, p: p.toString() },
      };
    }
    if (sub === "race") {
      const n = r.int(2, d === 1 ? 3 : 4);
      const p = r.pick([F(3, 5), F(2, 3), F(2, 5), F(3, 4), F(1, 3)]);
      const ans = raceWin(n, p);
      return {
        sub,
        text: `A and B play a series of games; A wins each game independently with probability ${p}. The first to win ${n} games wins the series. What is the probability that A wins the series?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(p), why: "the single-game probability" },
          { value: fr(p.pow(n)), why: "A winning the first n games straight" },
          { value: fr(raceWin(n - 1, p)), why: `the first-to-${n - 1} answer` },
          { value: fr(raceWin(n + 1, p)), why: `the first-to-${n + 1} answer` },
        ],
        solution: [
          `A wins on game ${n}+j having lost j games (j = 0..${n - 1}): C(${n}−1+j, j)·p^${n}·q^j.`,
          `Sum = ${ans} ≈ ${pctStr(ans)} (same as winning at least ${n} of ${2 * n - 1} games).`,
        ],
        hint: "Equivalent to winning a majority of 2n−1 games played out in full.",
        params: { sub, n, p: p.toString() },
      };
    }
    if (sub === "craps") {
      const ans = crapsWin();
      return {
        sub,
        text: "Craps: roll two dice. On the first roll you win with 7 or 11 and lose with 2, 3 or 12. Any other total becomes your point; you then keep rolling until you roll the point again (win) or a 7 (lose). What is the probability of winning?",
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(F(1, 2)), why: "assuming the game is fair" },
          { value: fr(F(8, 36)), why: "winning on the first roll only" },
          { value: fr(F(8, 36).add(F(24, 36).mul(F(1, 2)))), why: "assuming a point is won half the time" },
          { value: fr(F(8, 36).add(F(24, 72))), why: "same 50/50 assumption" },
          { value: fr(ans.comp()), why: "that is the probability of losing" },
        ],
        solution: [
          "Win immediately: P(7) + P(11) = 6/36 + 2/36 = 8/36.",
          "With point s: P(s before 7) = P(s)/(P(s) + 6/36). E.g. point 4: (3/36)/(9/36) = 1/3.",
          `Total: 8/36 + Σ_s P(s)·P(s)/(P(s)+P(7)) = 244/495 ≈ ${pctStr(ans)}.`,
        ],
        hint: "Once a point is set, only the point and 7 matter.",
        params: { sub },
      };
    }
    const t = d === 2 ? 2 : r.int(2, 3);
    const c = randomChain(r, t);
    const absorbing = new Set([t, t + 1]);
    if (sub === "chain_prob") {
      const probs = absorptionProbabilities(c.P, absorbing, new Set([t]));
      const ans = probs[0];
      const pw = c.P[0].get(t) ?? Fraction.ZERO;
      const pl = c.P[0].get(t + 1) ?? Fraction.ZERO;
      return {
        sub,
        text: `A token moves between states ${c.names.slice(0, t).join(", ")}, Win and Lose. ${describeChain(c)} Win and Lose end the game. Starting at A, what is the probability of ending at Win?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(pw), why: "only the direct step to Win" },
          { value: fr(pw.add(pl).isZero() ? F(1, 2) : pw.div(pw.add(pl))), why: "normalising A's direct exits only" },
          { value: fr(ans.comp()), why: "that is the probability of Lose" },
          { value: fr(probs[1]), why: "that is the answer starting from B" },
          { value: fr(F(1, 2)), why: "two endings → 1/2" },
        ],
        solution: [
          `Let w_X = P(Win | start X). Then w_Win = 1, w_Lose = 0 and w_X = Σ P(X→Y)·w_Y.`,
          ...c.names.slice(0, t).map((nm, i) => `w_${nm} = ${probs[i]}`),
          `So P = ${ans} ≈ ${pctStr(ans)}.`,
        ],
        hint: "First-step analysis: write one equation per state.",
        params: { sub, P: c.P.map((m) => [...m].map(([j, p]) => [j, p.toString()])), t },
      };
    }
    const steps = expectedHittingTimes(c.P, absorbing);
    const ans = steps[0];
    const direct = (c.P[0].get(t) ?? Fraction.ZERO).add(c.P[0].get(t + 1) ?? Fraction.ZERO);
    return {
      sub,
      text: `A token moves between states ${c.names.slice(0, t).join(", ")}, Win and Lose, one move per step. ${describeChain(c)} Win and Lose end the game. Starting at A, what is the expected number of steps until the game ends?`,
      unit: "num",
      answer: fr(ans),
      distractors: [
        { value: fr(direct.isZero() ? F(t) : direct.inv()), why: "1 / P(ending from A in one step)" },
        { value: fr(F(t)), why: "number of non-terminal states" },
        { value: fr(steps[1]), why: "that is the answer starting from B" },
        { value: fr(ans.sub(1)), why: "off by one step" },
        { value: fr(ans.add(1)), why: "off by one step" },
      ],
      solution: [
        "Let m_X = expected steps from X. m_Win = m_Lose = 0 and m_X = 1 + Σ P(X→Y)·m_Y.",
        ...c.names.slice(0, t).map((nm, i) => `m_${nm} = ${steps[i]}`),
        `Answer: ${ans}${ans.isInteger() ? "" : ` ≈ ${ans.toNumber().toFixed(3)}`}.`,
      ],
      hint: "First-step analysis with +1 per step.",
      params: { sub, P: c.P.map((m) => [...m].map(([j, p]) => [j, p.toString()])), t },
    };
  },
};
