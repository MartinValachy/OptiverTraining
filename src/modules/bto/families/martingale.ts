import { F, Fraction } from "@/lib/fraction";
import { type BtoFamily, type Scenario, fr, pctStr } from "../core";
import { ruinWinProb } from "./ruin";

/** Max number of doubling bets 1, 2, 4, … affordable from bankroll B. */
export function doublingBets(B: number): number {
  let m = 0;
  while (2 ** (m + 1) - 1 <= B) m++;
  return m;
}

export function doublingEV(B: number, p: Fraction): Fraction {
  const m = doublingBets(B);
  const qm = p.comp().pow(m);
  return qm.comp().sub(qm.mul(2 ** m - 1));
}

export const martingale: BtoFamily = {
  id: "martingale",
  name: "Martingale traps",
  blurb: "Doubling strategies, optional stopping",
  generate(r, d): Scenario {
    const sub = d === 1 ? r.pick(["doubling_ev", "stop_profit"]) : d === 2 ? r.pick(["doubling_ev", "doubling_pwin", "stop_profit"]) : r.pick(["doubling_ev_edge", "doubling_pwin", "stop_profit_edge"]);

    if (sub.startsWith("doubling")) {
      const B = r.pick([7, 15, 31, 20, 50, 63]);
      const p = sub === "doubling_ev_edge" || (sub === "doubling_pwin" && r.chance(0.5)) ? F(18, 37) : F(1, 2);
      const m = doublingBets(B);
      const q = p.comp();
      const qm = q.pow(m);
      const game = p.eq(F(1, 2)) ? "a fair coin (even money)" : "red at roulette (wins with probability 18/37, even money)";
      const rule = `You have $${B}. You bet $1 on ${game}; after every loss you double your bet. You stop after your first win, or when you cannot afford the next bet.`;
      if (sub === "doubling_pwin") {
        const ans = qm.comp();
        return {
          sub,
          text: `${rule} What is the probability that you finish with a profit?`,
          unit: "prob",
          answer: fr(ans),
          distractors: [
            { value: fr(Fraction.ONE), why: "believing the strategy always wins" },
            { value: fr(qm), why: "that is the probability of the big loss" },
            { value: fr(p), why: "the single-bet probability" },
            { value: fr(q.pow(m + 1).comp()), why: "one bet too many (bets 1, 2, …, 2^m)" },
            { value: fr(q.pow(m - 1).comp()), why: "one bet too few" },
          ],
          solution: [`Affordable bets: 1 + 2 + … + 2^${m - 1} = ${2 ** m - 1} ≤ ${B} (the next would need ${2 ** (m + 1) - 1}).`, `You lose only if all ${m} bets lose: (${q})^${m}.`, `P(profit) = 1 − (${q})^${m} ≈ ${pctStr(ans)}.`],
          hint: "Count how many doublings the bankroll supports.",
          params: { sub, B, p: p.toString() },
        };
      }
      const ans = doublingEV(B, p);
      return {
        sub,
        text: `${rule} What is your expected profit (in $)?`,
        unit: "num",
        answer: fr(ans),
        distractors: [
          { value: fr(F(1)), why: "believing you always end up $1 ahead" },
          { value: fr(qm.comp()), why: "the probability of winning, not the profit" },
          { value: fr(qm.mul(2 ** m - 1).neg()), why: "only the losing scenario" },
          { value: fr(p.sub(q)), why: "the edge of a single $1 bet" },
          { value: fr(F(m).mul(p.sub(q))), why: "edge times number of bets" },
          { value: fr(p), why: "the single-bet win probability × $1" },
          { value: fr(qm.comp().sub(qm)), why: "counting the bust as a $1 loss" },
          { value: fr(F(-1)), why: "assuming you lose your first stake on average" },
        ],
        solution: [
          `You can afford ${m} bets (total stake ${2 ** m - 1}).`,
          `Win $1 with probability 1 − q^${m}; lose $${2 ** m - 1} with probability q^${m}, q = ${q}.`,
          `E = (1 − q^${m}) − ${2 ** m - 1}·q^${m} = ${ans}${ans.isZero() ? " — no betting system beats a fair game" : ` ≈ ${ans.toNumber().toFixed(4)}`}.`,
        ],
        hint: "A bounded strategy on a fair game has expected profit 0 (optional stopping).",
        params: { sub, B, p: p.toString() },
      };
    }
    // stop_profit: start B, stop at B + t or 0
    const B = r.int(2, 20);
    const t = r.int(1, 5);
    const p = sub === "stop_profit_edge" ? r.pick([F(9, 19), F(18, 37), F(2, 5)]) : F(1, 2);
    const win = ruinWinProb(B, B + t, p);
    const ans = win.mul(B + t);
    return {
      sub,
      text: `You start with $${B} and bet $1 at a time on ${p.eq(F(1, 2)) ? "a fair coin" : `a game you win with probability ${p}`}. You stop as soon as you are $${t} up or have lost everything. What is your expected final wealth (in $)?`,
      unit: "num",
      answer: fr(ans),
      distractors: [
        { value: fr(F(B + t)), why: "assuming you always reach the target" },
        { value: fr(F(B).add(win.mul(t))), why: "adding the win probability × gain but ignoring the loss" },
        { value: fr(F(B + t, 2)), why: "averaging target and current" },
        { value: fr(win), why: "the probability of reaching the target" },
        { value: fr(F(B)), why: "the fair-game answer" },
      ],
      solution: p.eq(F(1, 2))
        ? ["Wealth in a fair game is a martingale and the stopping time is bounded in expectation.", `E[final] = $${B} — stopping rules cannot create value.`]
        : [`P(reach $${B + t}) = ${pctStr(win)} (gambler's ruin with ρ = q/p).`, `E[final] = ${B + t}·P ≈ ${ans.toNumber().toFixed(3)}.`],
      hint: "Optional stopping: fair game → expected final wealth = start.",
      params: { sub, B, t, p: p.toString() },
    };
  },
};
