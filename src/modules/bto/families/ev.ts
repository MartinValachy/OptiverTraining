import { F, Fraction, fsum } from "@/lib/fraction";
import { type BtoFamily, type Scenario, fr } from "../core";

/** Optimal value with up to `rolls` rolls of an s-sided die (must keep the last roll). */
export function rerollValue(s: number, rolls: number): Fraction {
  let v = F(s + 1, 2);
  for (let j = 2; j <= rolls; j++) {
    const prev = v;
    v = fsum(Array.from({ length: s }, (_, i) => (F(i + 1).gt(prev) ? F(i + 1) : prev))).div(s);
  }
  return v;
}

export function expMax(n: number, s: number): Fraction {
  return fsum(Array.from({ length: s }, (_, k) => Fraction.ONE.sub(F(k, s).pow(n))));
}

export function expMin(n: number, s: number): Fraction {
  return fsum(Array.from({ length: s }, (_, k) => F(s - k, s).pow(n)));
}

const num = (f: Fraction) => (f.isInteger() ? f.toString() : `${f} ≈ ${f.toNumber().toFixed(3)}`);

export const ev: BtoFamily = {
  id: "ev",
  name: "Expected value & fair prices",
  blurb: "Dice payouts, optimal rerolls, simple games",
  generate(r, d): Scenario {
    const subs = d === 1 ? ["payout", "max2", "product"] : d === 2 ? ["reroll", "game", "until_tails", "payout"] : ["reroll_k", "max_n", "game", "until_tails"];
    const sub = r.pick(subs);
    const s = d === 1 ? 6 : r.pick([6, 8, 10, 12]);
    const mean = F(s + 1, 2);

    if (sub === "payout") {
      const kind = r.pick(["square", "double_plus", "triangle"]);
      const vals = Array.from({ length: s }, (_, i) => i + 1);
      const f = (x: number) => (kind === "square" ? x * x : kind === "double_plus" ? 2 * x + 1 : (x * (x + 1)) / 2);
      const ans = fsum(vals.map((x) => F(f(x)))).div(s);
      const desc = kind === "square" ? "the square of the number shown" : kind === "double_plus" ? "twice the number shown plus one" : "1 + 2 + … + (the number shown)";
      const fOfMean = kind === "square" ? mean.pow(2) : kind === "double_plus" ? mean.mul(2).add(1) : mean.mul(mean.add(1)).div(2);
      return {
        sub,
        text: `You roll a fair ${s}-sided die and receive $${desc}. What is the fair price of this game (in $)?`,
        unit: "num",
        answer: fr(ans),
        distractors: [
          { value: fr(fOfMean), why: "f(E[X]) instead of E[f(X)] (Jensen's inequality)" },
          { value: fr(mean), why: "the expected roll itself" },
          { value: fr(F(f(s), 2)), why: "half the maximum payout" },
          { value: fr(F(f(1) + f(s), 2)), why: "average of the smallest and largest payout" },
        ],
        solution: [`E[f(X)] = (1/${s})·Σ f(x) over x = 1..${s}.`, `= ${num(ans)}.`, kind === "double_plus" ? "Linear payout: E[2X+1] = 2E[X]+1." : "For a non-linear payout E[f(X)] ≠ f(E[X])."],
        hint: "Average the payout over all faces; don't plug in the average face.",
        params: { sub, s, kind },
      };
    }
    if (sub === "max2" || sub === "max_n") {
      const n = sub === "max2" ? 2 : r.int(3, 5);
      const ans = expMax(n, s);
      return {
        sub,
        text: `You roll ${n} fair ${s}-sided dice and receive $1 for each pip on the highest die. What is the expected payout (in $)?`,
        unit: "num",
        answer: fr(ans),
        distractors: [
          { value: fr(mean), why: "the expectation of a single die" },
          { value: fr(expMin(n, s)), why: "that is the expected minimum" },
          { value: fr(F(s * n, n + 1)), why: "continuous approximation s·n/(n+1)" },
          { value: fr(F((s + 1) * n, n + 1)), why: "(s+1)·n/(n+1): discrete-looking but wrong" },
          { value: fr(F(s)), why: "the maximum face" },
        ],
        solution: [`E[max] = Σ_{k=1}^{${s}} P(max ≥ k) = Σ (1 − ((k−1)/${s})^${n}).`, `= ${num(ans)}.`],
        hint: "Tail sum: E[M] = Σ P(M ≥ k).",
        params: { sub, n, s },
      };
    }
    if (sub === "product") {
      const ans = mean.pow(2);
      return {
        sub,
        text: `You roll two fair ${s}-sided dice and receive the product of the two numbers in $. What is the fair price?`,
        unit: "num",
        answer: fr(ans),
        distractors: [
          { value: fr(F((s + 1) * (2 * s + 1), 6)), why: "E[X²]: treating the product as one die squared" },
          { value: fr(mean.mul(2)), why: "the expected sum" },
          { value: fr(F(s * s, 2)), why: "half the maximum product" },
          { value: fr(F(s * s + 1, 2)), why: "average of min and max products" },
        ],
        solution: ["The dice are independent, so E[XY] = E[X]·E[Y].", `= ${mean}² = ${num(ans)}.`],
        hint: "Independence: expectation of a product = product of expectations.",
        params: { sub, s },
      };
    }
    if (sub === "reroll" || sub === "reroll_k") {
      const rolls = sub === "reroll" ? 2 : r.int(3, 4);
      const ans = rerollValue(s, rolls);
      return {
        sub,
        text: `You roll a fair ${s}-sided die and win $ equal to the number shown. After seeing a roll you may reroll, up to ${rolls - 1} time${rolls > 2 ? "s" : ""} in total, but you must accept the last roll. With optimal play, what is the expected payout?`,
        unit: "num",
        answer: fr(ans),
        distractors: [
          { value: fr(mean), why: "no rerolls" },
          { value: fr(expMax(rolls, s)), why: `E[max of ${rolls} rolls]: you cannot go back to an earlier roll` },
          { value: fr(rerollValue(s, rolls - 1)), why: "one reroll too few" },
          { value: fr(mean.add(s).div(2)), why: "averaging the mean and the top face" },
        ],
        solution: [
          `Work backwards. With 1 roll left: ${mean}.`,
          ...Array.from({ length: rolls - 1 }, (_, j) => {
            const prev = rerollValue(s, j + 1);
            const cur = rerollValue(s, j + 2);
            return `With ${j + 2} rolls: keep x if x > ${num(prev)}, else reroll → ${num(cur)}.`;
          }),
        ],
        hint: "Keep a roll only if it beats the value of continuing.",
        params: { sub, s, rolls },
      };
    }
    if (sub === "game") {
      const a = r.int(6, 30);
      const b = r.int(2, 9);
      const c = r.int(1, 5);
      const ans = F(a + b - 4 * c, 6);
      return {
        sub,
        text: `Roll a fair die: on a 6 you win $${a}, on a 5 you win $${b}, otherwise you lose $${c}. What is your expected profit per game (in $)?`,
        unit: "num",
        answer: fr(ans),
        distractors: [
          { value: fr(F(a + b - c, 3)), why: "treating the three outcomes as equally likely" },
          { value: fr(F(a + b, 6)), why: "forgetting the losses" },
          { value: fr(F(a + b - c, 6)), why: "counting the loss only once" },
          { value: fr(F(a + b + 4 * c, 6)), why: "sign error on the loss" },
          { value: fr(F(a + b - 3 * c, 6)), why: "losing on only three faces" },
        ],
        solution: [`E = (1/6)·${a} + (1/6)·${b} − (4/6)·${c}.`, `= ${num(ans)}.`],
        hint: "Weight each outcome by its probability; four faces lose.",
        params: { sub, a, b, c },
      };
    }
    // until_tails
    const p = r.pick([F(1, 2), F(2, 3), F(3, 4), F(3, 5)]);
    const q = p.comp();
    const ans = p.div(q);
    return {
      sub,
      text: `A coin lands heads with probability ${p}. You flip it until the first tails and win $1 for every head before that. What is the expected payout (in $)?`,
      unit: "num",
      answer: fr(ans),
      distractors: [
        { value: fr(q.inv()), why: "counting the final tails flip too" },
        { value: fr(p), why: "the probability of one head" },
        { value: fr(p.inv()), why: "1/p" },
        { value: fr(q.div(p)), why: "inverting the odds" },
      ],
      solution: [`Number of flips until tails is geometric with mean 1/(1−p) = ${q.inv()}.`, `Heads before it: ${q.inv()} − 1 = p/(1−p) = ${num(ans)}.`],
      hint: "Heads before the first tails = (flips until tails) − 1.",
      params: { sub, p: p.toString() },
    };
  },
};
