import { F, Fraction, fsum } from "@/lib/fraction";
import { binom, harmonic } from "@/lib/math";
import { type BtoFamily, type Scenario, fr, pctStr, ORD } from "../core";

const approx = (x: number) => Fraction.parse(x.toPrecision(12));

const EVENTS: { act: string; cond: string; p: Fraction }[] = [
  { act: "roll a fair die", cond: "it shows a 6", p: F(1, 6) },
  { act: "roll two fair dice", cond: "their sum is 7", p: F(1, 6) },
  { act: "roll two fair dice", cond: "they show doubles", p: F(1, 6) },
  { act: "roll two fair dice", cond: "their sum is 8", p: F(5, 36) },
  { act: "flip two fair coins", cond: "both show heads", p: F(1, 4) },
  { act: "roll a fair 8-sided die", cond: "it shows an 8", p: F(1, 8) },
  { act: "roll two fair dice", cond: "their sum is at least 11", p: F(1, 12) },
  { act: "roll two fair dice", cond: "their sum is 4", p: F(1, 12) },
];

export const waiting: BtoFamily = {
  id: "waiting",
  name: "Waiting times",
  blurb: "Geometric, negative binomial, coupon collector",
  generate(r, d): Scenario {
    const subs = d === 1 ? ["geom_mean", "geom_pmf"] : d === 2 ? ["geom_tail", "negbin_mean", "coupon"] : ["coupon_partial", "negbin_pmf", "geom_set"];
    const sub = r.pick(subs);
    const ev = r.pick(EVENTS);
    const p = ev.p;
    const q = p.comp();

    if (sub === "geom_mean") {
      const ans = p.inv();
      return {
        sub,
        text: `You ${ev.act} repeatedly until ${ev.cond}. What is the expected number of attempts, including the successful one?`,
        unit: "num",
        answer: fr(ans),
        distractors: [
          { value: fr(ans.sub(1)), why: "counting only the failures" },
          { value: fr(ans.add(1)), why: "off by one" },
          { value: fr(approx(Math.LN2 / p.toNumber())), why: "that is roughly the median, not the mean" },
          { value: fr(ans.div(2)), why: "halving the mean" },
        ],
        solution: [`Success probability per attempt p = ${p}.`, `Geometric: E = 1/p = ${ans}${ans.isInteger() ? "" : ` = ${ans.toNumber().toFixed(2)}`}.`],
        hint: "Geometric distribution: mean 1/p.",
        params: { sub, p: p.toString() },
      };
    }
    if (sub === "geom_pmf") {
      const k = r.int(2, 6);
      const ans = q.pow(k - 1).mul(p);
      return {
        sub,
        text: `You ${ev.act} repeatedly until ${ev.cond}. What is the probability that this first happens on attempt number ${k}?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(q.pow(k).mul(p)), why: "one failure too many" },
          { value: fr(q.pow(k - 2).mul(p)), why: "one failure too few" },
          { value: fr(q.pow(k - 1).comp()), why: `that is P(success within ${k - 1} attempts)` },
          { value: fr(q.pow(k - 1)), why: "forgetting the final success" },
          { value: fr(p), why: "the per-attempt probability" },
        ],
        solution: [`Need ${k - 1} failures then a success: (1−p)^${k - 1}·p.`, `= (${q})^${k - 1}·${p} = ${ans} ≈ ${pctStr(ans)}.`],
        hint: "First success on attempt k: k−1 failures, then one success.",
        params: { sub, p: p.toString(), k },
      };
    }
    if (sub === "geom_tail") {
      const k = r.int(3, 10);
      const ans = q.pow(k);
      return {
        sub,
        text: `You ${ev.act} repeatedly until ${ev.cond}. What is the probability that you need more than ${k} attempts?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(q.pow(k + 1)), why: "one attempt too many" },
          { value: fr(q.pow(k - 1)), why: "one attempt too few" },
          { value: fr(ans.comp()), why: "complement error" },
          { value: fr(Fraction.ONE.sub(F(k).mul(p)).abs()), why: "subtracting k·p (linear approximation)" },
        ],
        solution: [`Needing more than ${k} attempts ⇔ the first ${k} all fail.`, `P = (${q})^${k} ≈ ${pctStr(ans)}.`],
        hint: "More than k attempts = the first k attempts fail.",
        params: { sub, p: p.toString(), k },
      };
    }
    if (sub === "negbin_mean") {
      const rr = r.int(2, 5);
      const ans = F(rr).div(p);
      return {
        sub,
        text: `You ${ev.act} repeatedly. What is the expected number of attempts until the ${ORD[rr]} time that ${ev.cond}?`,
        unit: "num",
        answer: fr(ans),
        distractors: [
          { value: fr(p.inv().pow(rr)), why: `that is the wait for ${rr} successes in a row… almost (1/p^r)` },
          { value: fr(F(rr).div(p).sub(rr)), why: "counting only failures" },
          { value: fr(p.inv().add(rr - 1)), why: "assuming the later successes come immediately" },
          { value: fr(F(rr - 1).div(p)), why: "one success too few" },
        ],
        solution: [`Each success takes 1/p = ${p.inv()} attempts on average, independently.`, `By linearity E = r/p = ${rr}·${p.inv()} = ${ans}.`],
        hint: "Negative binomial = sum of r independent geometric waits.",
        params: { sub, p: p.toString(), r: rr },
      };
    }
    if (sub === "coupon" || sub === "coupon_partial") {
      const s = sub === "coupon" ? r.pick([4, 6, 8]) : r.pick([6, 8, 10, 12]);
      const k = sub === "coupon" ? s : r.int(2, s - 1);
      const ans = fsum(Array.from({ length: k }, (_, i) => F(s, s - i)));
      const full = F(s).mul(harmonic(s));
      return {
        sub,
        text:
          sub === "coupon"
            ? `You roll a fair ${s}-sided die until every face has appeared at least once. What is the expected number of rolls?`
            : `You roll a fair ${s}-sided die until ${k} different faces have appeared. What is the expected number of rolls?`,
        unit: "num",
        answer: fr(ans),
        distractors: [
          { value: fr(F(s * k)), why: "k · s (as if each new face took s rolls)" },
          { value: fr(approx(s * Math.log(s))), why: "s·ln s: the asymptotic approximation, too small for small s" },
          { value: fr(F(k)), why: "assuming every roll is new" },
          { value: fr(sub === "coupon" ? F(s * s, 2) : full), why: sub === "coupon" ? "s²/2" : "that is the wait for all faces" },
          { value: fr(ans.add(1)), why: "off by one" },
        ],
        solution: [
          `After i distinct faces, a new one appears with probability (${s}−i)/${s}, so it takes ${s}/(${s}−i) rolls on average.`,
          `E = Σ_{i=0}^{${k - 1}} ${s}/(${s}−i) = ${ans} ≈ ${ans.toNumber().toFixed(3)}.`,
        ],
        hint: "Split into stages: waiting for the next new face is geometric.",
        params: { sub, s, k },
      };
    }
    if (sub === "negbin_pmf") {
      const pp = r.pick([F(1, 6), F(1, 2), F(1, 3)]);
      const rr = r.int(2, 3);
      const k = r.int(rr + 1, rr + 6);
      const qq = pp.comp();
      const ans = F(binom(k - 1, rr - 1)).mul(pp.pow(rr)).mul(qq.pow(k - rr));
      return {
        sub,
        text: `Each trial succeeds independently with probability ${pp}. What is the probability that the ${ORD[rr]} success happens exactly on trial ${k}?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(F(binom(k, rr)).mul(pp.pow(rr)).mul(qq.pow(k - rr))), why: `binomial: exactly ${rr} successes in ${k} trials (last trial not forced)` },
          { value: fr(pp.pow(rr).mul(qq.pow(k - rr))), why: "one specific arrangement only" },
          { value: fr(F(binom(k - 1, rr)).mul(pp.pow(rr)).mul(qq.pow(k - rr))), why: "choosing r instead of r−1 earlier successes" },
          { value: fr(F(binom(k - 1, rr - 1)).mul(pp.pow(rr - 1)).mul(qq.pow(k - rr))), why: "forgetting the final success" },
        ],
        solution: [
          `Trial ${k} is a success and exactly ${rr - 1} of the first ${k - 1} are successes.`,
          `P = C(${k - 1},${rr - 1})·p^${rr}·(1−p)^${k - rr} = ${ans} ≈ ${pctStr(ans)}.`,
        ],
        hint: "Fix the last trial as the r-th success.",
        params: { sub, p: pp.toString(), r: rr, k },
      };
    }
    // geom_set: wait until each of m specific faces has appeared
    const s = r.pick([6, 8, 10]);
    const m = r.int(2, 3);
    const faces = Array.from({ length: m }, (_, i) => s - i).reverse();
    const ans = F(s).mul(harmonic(m));
    return {
      sub,
      text: `You roll a fair ${s}-sided die until each of the faces ${faces.join(", ").replace(/, (\d+)$/, " and $1")} has appeared at least once. What is the expected number of rolls?`,
      unit: "num",
      answer: fr(ans),
      distractors: [
        { value: fr(F(s * m)), why: "adding the individual waits (s each)" },
        { value: fr(F(s)), why: "the wait for one face" },
        { value: fr(F(s, m)), why: "the wait for the first of them only" },
        { value: fr(F(s).mul(harmonic(m)).add(F(s, m))), why: "double-counting the first stage" },
      ],
      solution: [
        `Stage 1: any of the ${m} faces, probability ${m}/${s} → ${s}/${m} rolls.`,
        m === 3 ? `Stage 2: one of the 2 remaining → ${s}/2 rolls. Stage 3: the last → ${s} rolls.` : `Stage 2: the remaining face → ${s} rolls.`,
        `E = ${s}·H_${m} = ${ans}${ans.isInteger() ? "" : ` ≈ ${ans.toNumber().toFixed(2)}`}.`,
      ],
      hint: "Wait for the first of the set, then the next, …",
      params: { sub, s, m },
    };
  },
};
