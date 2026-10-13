import { Fraction, F, fsum } from "@/lib/fraction";
import { binom, diceSumDist } from "@/lib/math";
import { type BtoFamily, type Distractor, type Scenario, fr, numw, pctStr } from "../core";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Number of multisets of n values in 1..s with the given sum (the "unordered outcomes" mistake). */
export function multisetCount(n: number, s: number, pred: (sum: number) => boolean): number {
  let count = 0;
  const rec = (left: number, min: number, sum: number) => {
    if (left === 0) {
      if (pred(sum)) count++;
      return;
    }
    for (let v = min; v <= s; v++) rec(left - 1, v, sum + v);
  };
  rec(n, 1, 0);
  return count;
}

function diceWord(n: number, s: number): string {
  return `${numw(n)} fair ${s}-sided ${n === 1 ? "die" : "dice"}`;
}

export const dice: BtoFamily = {
  id: "dice",
  name: "Dice",
  blurb: "Sums, max / min, at least one six",
  generate(r, d): Scenario {
    const subs = d === 1 ? ["sum_eq", "atleast", "max_le"] : d === 2 ? ["sum_ge", "max_eq", "min_ge", "atleast"] : ["sum_eq", "max_eq", "min_eq", "atleast2", "sum_ge"];
    const sub = r.pick(subs);
    const n = d === 1 ? 2 : d === 2 ? 3 : r.int(3, 4);
    const s = d === 3 ? r.pick(n === 4 ? [6, 8] : [6, 8, 10, 12]) : 6;
    const S = F(s);
    const total = BigInt(s) ** BigInt(n);
    const nMultisets = Number(binom(s + n - 1, n));
    const W = diceWord(n, s);

    if (sub === "sum_eq" || sub === "sum_ge") {
      const dist = diceSumDist(n, s);
      const lo = n;
      const hi = n * s;
      const mid = Math.round((lo + hi) / 2);
      const k = sub === "sum_eq" ? r.int(Math.max(lo + 1, mid - Math.ceil(s / 2)), Math.min(hi - 1, mid + Math.ceil(s / 2))) : r.int(mid, hi - 2);
      const pGe = (t: number) => fsum(dist.slice(Math.max(0, t)));
      if (sub === "sum_eq") {
        const ans = dist[k];
        const ms = multisetCount(n, s, (x) => x === k);
        const ds: Distractor[] = [
          { value: fr(F(ms, total)), why: `counting only unordered outcomes (${ms} combinations) over ${total} ordered ones` },
          { value: fr(F(ms, nMultisets)), why: `treating the ${nMultisets} unordered outcomes as equally likely` },
          { value: fr(dist[k + 1] ?? Fraction.ZERO), why: `off by one: P(sum = ${k + 1})` },
          { value: fr(F(1, hi - lo + 1)), why: "assuming every possible sum is equally likely" },
          { value: fr(pGe(k)), why: `answering P(sum ≥ ${k}) instead of P(sum = ${k})` },
          { value: fr(dist[k - 1]), why: `off by one: P(sum = ${k - 1})` },
        ];
        const ways = ans.mul(total);
        return {
          sub,
          text: `${cap(W)} are rolled. What is the probability that the sum is exactly ${k}?`,
          unit: "prob",
          answer: fr(ans),
          distractors: ds,
          solution: [
            `There are ${s}^${n} = ${total} equally likely ordered outcomes.`,
            `Count ordered outcomes with sum ${k}: ${ways} (each unordered combination counted with all its orderings).`,
            `P = ${ways}/${total} = ${ans} ≈ ${pctStr(ans)}.`,
          ],
          hint: "Count ordered outcomes: (2,6) and (6,2) are different.",
          params: { sub, n, s, k },
        };
      }
      const ans = pGe(k);
      const msGe = multisetCount(n, s, (x) => x >= k);
      return {
        sub,
        text: `${cap(W)} are rolled. What is the probability that the sum is at least ${k}?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(pGe(k + 1)), why: `off by one: P(sum > ${k})` },
          { value: fr(ans.comp()), why: "complement error (that is P(sum < k))" },
          { value: fr(F(msGe, nMultisets)), why: "treating unordered outcomes as equally likely" },
          { value: fr(dist[k]), why: `P(sum = ${k}) only` },
          { value: fr(pGe(k - 1)), why: `off by one: P(sum ≥ ${k - 1})` },
        ],
        solution: [
          `Total ordered outcomes: ${total}.`,
          `Add the counts of sums ${k}..${hi}: ${ans.mul(total)} outcomes.`,
          `P = ${ans} ≈ ${pctStr(ans)}. (For high thresholds it is quicker to count from the top.)`,
        ],
        hint: "By symmetry P(sum ≥ k) = P(sum ≤ n(s+1) − k); count the smaller tail.",
        params: { sub, n, s, k },
      };
    }

    if (sub === "max_le") {
      const k = r.int(2, s - 1);
      const ans = F(k, s).pow(n);
      return {
        sub,
        text: `${cap(W)} are rolled. What is the probability that the largest number shown is at most ${k}?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(F(k, s)), why: "forgetting that every die must be ≤ k (no power)" },
          { value: fr(F(k - 1, s).pow(n)), why: "≤ vs <: that is P(max < k)" },
          { value: fr(F(s - k, s).pow(n).comp()), why: "confusing max with min (P(min ≤ k))" },
          { value: fr(ans.comp()), why: "complement error" },
        ],
        solution: [`max ≤ ${k} ⇔ every die ≤ ${k}.`, `P = (${k}/${s})^${n} = ${ans} ≈ ${pctStr(ans)}.`],
        hint: "The maximum is ≤ k exactly when all dice are ≤ k.",
        params: { sub, n, s, k },
      };
    }

    if (sub === "max_eq") {
      const k = r.int(Math.ceil(s / 2), s);
      const ans = F(k, s).pow(n).sub(F(k - 1, s).pow(n));
      return {
        sub,
        text: `${cap(W)} are rolled. What is the probability that the largest number shown is exactly ${k}?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(F(k, s).pow(n)), why: `forgetting to subtract P(max ≤ ${k - 1})` },
          { value: fr(F(n).mul(F(k - 1).pow(n - 1)).div(S.pow(n))), why: "exactly one die shows k and the rest less (ignores ties at k)" },
          { value: fr(F(1, s)), why: "one die's chance of showing k" },
          { value: fr(F(k - 1, s).pow(n).comp()), why: `P(max ≥ ${k}) instead of = ${k}` },
          { value: fr(F(n, s).mul(F(k - 1, s).pow(n - 1))), why: "union-bound style overcount" },
        ],
        solution: [
          `P(max = ${k}) = P(max ≤ ${k}) − P(max ≤ ${k - 1}).`,
          `= (${k}/${s})^${n} − (${k - 1}/${s})^${n} = ${ans} ≈ ${pctStr(ans)}.`,
        ],
        hint: "P(max = k) = P(all ≤ k) − P(all ≤ k−1).",
        params: { sub, n, s, k },
      };
    }

    if (sub === "min_ge" || sub === "min_eq") {
      const k = r.int(2, Math.ceil(s / 2) + 1);
      const ge = (t: number) => F(s - t + 1, s).pow(n);
      if (sub === "min_ge") {
        const ans = ge(k);
        return {
          sub,
          text: `${cap(W)} are rolled. What is the probability that the smallest number shown is at least ${k}?`,
          unit: "prob",
          answer: fr(ans),
          distractors: [
            { value: fr(F(s - k + 1, s)), why: "forgetting the power (only one die)" },
            { value: fr(ge(k + 1)), why: "≥ vs >: that is P(min > k)" },
            { value: fr(ans.comp()), why: "complement error" },
            { value: fr(F(s - k, s).pow(n)), why: `using ${s - k} allowed faces instead of ${s - k + 1}` },
          ],
          solution: [`min ≥ ${k} ⇔ every die shows ${k}..${s}: ${s - k + 1} faces each.`, `P = (${s - k + 1}/${s})^${n} = ${ans} ≈ ${pctStr(ans)}.`],
          hint: "The minimum is ≥ k exactly when all dice are ≥ k.",
          params: { sub, n, s, k },
        };
      }
      const ans = ge(k).sub(ge(k + 1));
      return {
        sub,
        text: `${cap(W)} are rolled. What is the probability that the smallest number shown is exactly ${k}?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(ge(k)), why: `forgetting to subtract P(min ≥ ${k + 1})` },
          { value: fr(F(n).mul(F(s - k).pow(n - 1)).div(S.pow(n))), why: "exactly one die shows k (ignores ties)" },
          { value: fr(F(1, s)), why: "one die's chance of showing k" },
          { value: fr(F(k, s).pow(n).sub(F(k - 1, s).pow(n))), why: "computing P(max = k) instead of P(min = k)" },
        ],
        solution: [`P(min = ${k}) = P(min ≥ ${k}) − P(min ≥ ${k + 1}).`, `= (${s - k + 1}/${s})^${n} − (${s - k}/${s})^${n} = ${ans} ≈ ${pctStr(ans)}.`],
        hint: "P(min = k) = P(all ≥ k) − P(all ≥ k+1).",
        params: { sub, n, s, k },
      };
    }

    // at least one / at least two of a face in m rolls
    const m = d === 1 ? r.int(2, 4) : d === 2 ? r.int(4, 8) : r.int(3, 10);
    const ss = d === 3 ? r.pick([6, 8, 10, 12]) : 6;
    const p = F(1, ss);
    const q = p.comp();
    const face = ss;
    const die = `a fair ${ss}-sided die`;
    if (sub === "atleast2") {
      const ans = Fraction.ONE.sub(q.pow(m)).sub(F(m).mul(p).mul(q.pow(m - 1)));
      return {
        sub,
        text: `You roll ${die} ${m} times. What is the probability of getting at least two ${face}s?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(q.pow(m).comp()), why: "that is P(at least one)" },
          { value: fr(F(binom(m, 2)).mul(p.pow(2)).mul(q.pow(m - 2))), why: "that is P(exactly two)" },
          { value: fr(Fraction.ONE.sub(q.pow(m)).sub(p.mul(q.pow(m - 1)))), why: "forgetting the factor m for the position of the single success" },
          { value: fr(p.pow(2)), why: "probability of two specific rolls both succeeding" },
          { value: fr(F(m, ss).pow(2)), why: "squaring the naive m/s" },
        ],
        solution: [
          `P(≥2) = 1 − P(0) − P(1).`,
          `P(0) = (${ss - 1}/${ss})^${m}; P(1) = ${m}·(1/${ss})·(${ss - 1}/${ss})^${m - 1}.`,
          `P(≥2) = ${ans} ≈ ${pctStr(ans)}.`,
        ],
        hint: "Use the complement: subtract P(none) and P(exactly one).",
        params: { sub, m, s: ss },
      };
    }
    const ans = q.pow(m).comp();
    return {
      sub,
      text: `You roll ${die} ${m} times. What is the probability of getting at least one ${face}?`,
      unit: "prob",
      answer: fr(ans),
      distractors: [
        { value: fr(F(m, ss)), why: "adding probabilities (m × 1/s) — overlaps double counted" },
        { value: fr(q.pow(m)), why: "complement error: that is P(no " + face + ")" },
        { value: fr(F(m).mul(p).mul(q.pow(m - 1))), why: "that is P(exactly one)" },
        { value: fr(p.pow(m).comp()), why: "wrong complement: 1 − P(all " + face + "s)" },
        { value: fr(q.pow(m - 1).comp()), why: `off by one roll: 1 − (${ss - 1}/${ss})^${m - 1}` },
      ],
      solution: [`P(no ${face} in ${m} rolls) = (${ss - 1}/${ss})^${m}.`, `P(at least one) = 1 − (${ss - 1}/${ss})^${m} = ${ans} ≈ ${pctStr(ans)}.`],
      hint: "\"At least one\" → 1 − P(none).",
      params: { sub, m, s: ss },
    };
  },
};
