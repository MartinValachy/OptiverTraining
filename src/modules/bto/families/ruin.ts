import { F, Fraction } from "@/lib/fraction";
import { type BtoFamily, type Scenario, fr, pctStr } from "../core";

export function ruinWinProb(i: number, N: number, p: Fraction): Fraction {
  const q = p.comp();
  if (p.eq(q)) return F(i, N);
  const rr = q.div(p);
  return Fraction.ONE.sub(rr.pow(i)).div(Fraction.ONE.sub(rr.pow(N)));
}

export function ruinDuration(i: number, N: number, p: Fraction): Fraction {
  const q = p.comp();
  if (p.eq(q)) return F(i * (N - i));
  const d = q.sub(p);
  return F(i).div(d).sub(F(N).div(d).mul(ruinWinProb(i, N, p)));
}

export const ruin: BtoFamily = {
  id: "ruin",
  name: "Gambler's ruin",
  blurb: "Fair and biased, win probability and duration",
  generate(r, d): Scenario {
    const N = r.int(4, d === 3 ? 12 : 10);
    const i = r.int(1, N - 1);
    const sub = d === 1 ? "win_fair" : d === 2 ? r.pick(["win_biased", "duration_fair"]) : r.pick(["win_biased", "duration_biased"]);
    const p = sub.endsWith("fair") ? F(1, 2) : r.pick([F(2, 5), F(9, 20), F(3, 5), F(18, 37), F(11, 20)]);
    const q = p.comp();
    const setup = `You start with $${i} and repeatedly bet $1 on ${p.eq(F(1, 2)) ? "a fair coin" : `a game you win with probability ${p}`}, winning or losing $1 each time. You stop when you reach $${N} or go broke.`;

    if (sub.startsWith("win")) {
      const ans = ruinWinProb(i, N, p);
      return {
        sub,
        text: `${setup} What is the probability that you reach $${N}?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(F(i, N)), why: "the fair-game answer i/N" },
          { value: fr(p.pow(N - i)), why: "winning every bet in a row" },
          { value: fr(ans.comp()), why: "that is the probability of ruin" },
          { value: fr(F(i, N).mul(p).div(F(1, 2))), why: "scaling i/N by the edge" },
          { value: fr(ruinWinProb(i + 1, N, p)), why: "off by one dollar" },
        ],
        solution: p.eq(F(1, 2))
          ? ["Your wealth is a martingale: E[final] = i.", `N·P(win) = ${i} ⇒ P = ${i}/${N} ≈ ${pctStr(ans)}.`]
          : [
              `With ρ = q/p = ${q.div(p)}: P(reach N) = (1 − ρ^i)/(1 − ρ^N).`,
              `= (1 − ${q.div(p)}^${i})/(1 − ${q.div(p)}^${N}) ≈ ${pctStr(ans)}.`,
              "Even a small edge compounds over many bets.",
            ],
        hint: p.eq(F(1, 2)) ? "Fair game: expected wealth stays constant." : "Use ρ = q/p in the ruin formula.",
        params: { sub, i, N, p: p.toString() },
      };
    }
    const ans = ruinDuration(i, N, p);
    return {
      sub,
      text: `${setup} What is the expected number of bets until you stop?`,
      unit: "num",
      answer: fr(ans),
      distractors: [
        { value: fr(F(i * (N - i))), why: "the fair-game formula i(N−i)" },
        { value: fr(F(N - i)), why: "winning straight to the target" },
        { value: fr(F(i * N)), why: "i·N" },
        { value: fr(F((N - i) * (N - i))), why: "(N−i)²: the distance squared" },
        { value: fr(F(i * (N - i), 2)), why: "half of i(N−i)" },
      ],
      solution: p.eq(F(1, 2))
        ? ["For a fair ±1 walk, X_t² − t is a martingale.", `E[T] = i(N − i) = ${i}·${N - i} = ${ans}.`]
        : [
            `E[T] = i/(q−p) − (N/(q−p))·P(reach N).`,
            `With P(reach N) = ${pctStr(ruinWinProb(i, N, p))}: E[T] ≈ ${ans.toNumber().toFixed(3)}.`,
          ],
      hint: p.eq(F(1, 2)) ? "Fair case: i(N−i)." : "Wald: E[final − start] = (p − q)·E[T].",
      params: { sub, i, N, p: p.toString() },
    };
  },
};
