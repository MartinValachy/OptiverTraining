import { F, Fraction } from "@/lib/fraction";
import { binom, perm } from "@/lib/math";
import { type BtoFamily, type Scenario, fr, pctStr } from "../core";

export function pShareAny(d: number, n: number): Fraction {
  if (n > d) return Fraction.ONE;
  return F(perm(d, n), BigInt(d) ** BigInt(n)).comp();
}

export function minNForHalf(d: number): number {
  for (let n = 2; n <= d + 1; n++) if (pShareAny(d, n).cmp(F(1, 2)) >= 0) return n;
  return d + 1;
}

export const birthday: BtoFamily = {
  id: "birthday",
  name: "Birthday collisions",
  blurb: "Shared birthdays, my birthday vs any pair, expected pairs",
  generate(r, d): Scenario {
    const sub = d === 1 ? "share_small" : d === 2 ? r.pick(["share_365", "share_mine"]) : r.pick(["exp_pairs", "min_n", "share_mine", "share_365"]);

    if (sub === "share_small" || sub === "share_365") {
      let D: number;
      let n: number;
      let text: string;
      if (sub === "share_small") {
        const kind = r.pick(["die", "week", "month"]);
        D = kind === "die" ? 6 : kind === "week" ? 7 : 12;
        n = r.int(3, kind === "die" ? 4 : 5);
        text =
          kind === "die"
            ? `You roll a fair six-sided die ${n} times. What is the probability that at least two rolls show the same number?`
            : `${n} people are each born on a uniformly random ${kind === "week" ? "day of the week" : "month (all 12 equally likely)"}, independently. What is the probability that at least two of them share a ${kind === "week" ? "weekday" : "birth month"}?`;
      } else {
        D = 365;
        n = r.pick(d === 2 ? [10, 15, 20, 23, 25, 30] : [35, 40, 50, 57]);
        text = `In a room of ${n} people (birthdays independent and uniform over 365 days), what is the probability that at least two share a birthday?`;
      }
      const ans = pShareAny(D, n);
      const pairs = binom(n, 2);
      return {
        sub,
        text,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(F(pairs, D)), why: "expected number of matching pairs used as a probability" },
          { value: fr(F(n, D)), why: "n/d: linear guess" },
          { value: fr(F(D - 1, D).pow(n - 1).comp()), why: "that is the chance someone shares one particular person's birthday" },
          { value: fr(ans.comp()), why: "complement error: that is P(all different)" },
          { value: fr(F(D - 1, D).pow(Number(pairs)).comp()), why: "treating all pairs as independent" },
          { value: fr(pShareAny(D, n - 1)), why: "off by one person" },
        ],
        solution: [
          `P(all different) = ${D}/${D} · ${D - 1}/${D} · … · ${D - n + 1}/${D} = ${D}!/(${D - n}!·${D}^${n}).`,
          `P(at least one shared) = 1 − P(all different) = ${D === 365 ? ans.toNumber().toFixed(4) : ans.toString()} ≈ ${pctStr(ans)}.`,
          `Intuition: there are C(${n},2) = ${pairs} pairs, each matching with probability 1/${D}.`,
        ],
        hint: "Compute the complement: everyone different.",
        params: { sub, D, n },
      };
    }
    if (sub === "share_mine") {
      const n = r.pick([20, 23, 30, 50, 100, 150, 253]);
      const ans = F(364, 365).pow(n).comp();
      return {
        sub,
        text: `You meet ${n} other people (birthdays independent and uniform over 365 days). What is the probability that at least one of them has the same birthday as you?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(F(n, 365)), why: "adding n × 1/365 (overlaps double counted)" },
          { value: fr(pShareAny(365, n + 1)), why: "that is the chance any two of the n+1 people match" },
          { value: fr(F(364, 365).pow(n)), why: "complement error" },
          { value: fr(F(364, 365).pow(n - 1).comp()), why: "off by one person" },
        ],
        solution: [`Each person misses your birthday with probability 364/365, independently.`, `P = 1 − (364/365)^${n} ≈ ${pctStr(ans)}.`],
        hint: "This is about one fixed date, not any pair.",
        params: { sub, n },
      };
    }
    if (sub === "exp_pairs") {
      const n = r.pick([10, 20, 23, 30, 40, 50, 60]);
      const ans = F(binom(n, 2), 365);
      return {
        sub,
        text: `In a room of ${n} people (birthdays independent and uniform over 365 days), what is the expected number of pairs of people who share a birthday?`,
        unit: "num",
        answer: fr(ans),
        distractors: [
          { value: fr(F(n, 365)), why: "n/365 instead of C(n,2)/365" },
          { value: fr(F(n * n, 365)), why: "n²/365: counting ordered pairs and self-pairs" },
          { value: fr(F(n * (n - 1), 365)), why: "counting ordered pairs" },
          { value: fr(pShareAny(365, n)), why: "the probability of at least one match" },
        ],
        solution: [`Linearity: each of the C(${n},2) = ${binom(n, 2)} pairs matches with probability 1/365.`, `E = ${binom(n, 2)}/365 ≈ ${ans.toNumber().toFixed(3)}.`],
        hint: "Indicator per pair + linearity of expectation.",
        params: { sub, n },
      };
    }
    // min_n
    const D = r.pick([12, 20, 30, 52, 100, 365]);
    const ans = minNForHalf(D);
    return {
      sub,
      text: `Each person is assigned one of ${D} labels uniformly at random, independently. What is the smallest group size for which the probability that at least two people share a label is at least 50%?`,
      unit: "num",
      answer: fr(F(ans)),
      distractors: [
        { value: fr(F(Math.round(D / 2))), why: "half the number of labels" },
        { value: fr(F(Math.ceil(Math.sqrt(D)))), why: "√d — the right order of magnitude, but too small" },
        { value: fr(F(D + 1)), why: "pigeonhole: that guarantees a match" },
        { value: fr(F(Math.ceil(D * Math.LN2))), why: "that is roughly the size for matching one specific person" },
        { value: fr(F(Math.ceil(Math.sqrt(D)) - 1)), why: "√d rounded down" },
      ],
      solution: [
        `P(all different) with n people = ∏_{i<n} (1 − i/${D}). Find the first n where it drops to ≤ 1/2.`,
        `Approximation: n ≈ √(2·${D}·ln 2) ≈ ${(Math.sqrt(2 * D * Math.LN2)).toFixed(2)}.`,
        `Exact check gives n = ${ans} (P = ${pctStr(pShareAny(D, ans))}; with ${ans - 1} people it is ${pctStr(pShareAny(D, ans - 1))}).`,
      ],
      hint: "n ≈ 1.18·√d.",
      params: { sub, D },
    };
  },
};
