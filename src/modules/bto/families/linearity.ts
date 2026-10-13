import { F, Fraction } from "@/lib/fraction";
import { harmonic } from "@/lib/math";
import { type BtoFamily, type Scenario, fr } from "../core";

const approx = (x: number) => Fraction.parse(x.toPrecision(12));

export const linearity: BtoFamily = {
  id: "linearity",
  name: "Linearity of expectation",
  blurb: "Fixed points, distinct values, records, couples",
  generate(r, d): Scenario {
    const sub = d === 1 ? r.pick(["fixed_points", "adjacent_equal"]) : d === 2 ? r.pick(["distinct_values", "empty_boxes", "fixed_points"]) : r.pick(["records", "couples", "runs", "distinct_values"]);

    if (sub === "fixed_points") {
      const n = r.int(4, 30);
      return {
        sub,
        text: `${n} people put their hats in a box and each takes back a hat uniformly at random (a random permutation). What is the expected number of people who get their own hat?`,
        unit: "num",
        answer: fr(F(1)),
        distractors: [
          { value: fr(F(1, n)), why: "one person's probability, not the sum" },
          { value: fr(approx(Math.exp(-1))), why: "≈ P(nobody gets their own hat), not an expectation" },
          { value: fr(F(n, 2)), why: "half of the people" },
          { value: fr(approx(n / Math.E)), why: "n/e" },
          { value: fr(F(0)), why: "assuming matches are negligible" },
        ],
        solution: ["Each person gets their own hat with probability 1/n.", `By linearity E = n · 1/n = 1, whatever n (${n} here).`],
        hint: "Sum indicator variables; dependence does not matter.",
        params: { sub, n },
      };
    }
    if (sub === "adjacent_equal") {
      const n = r.int(5, 40);
      const ans = F(n - 1, 2);
      return {
        sub,
        text: `A fair coin is flipped ${n} times. What is the expected number of positions i (1 ≤ i < ${n}) where flip i equals flip i+1?`,
        unit: "num",
        answer: fr(ans),
        distractors: [
          { value: fr(F(n, 2)), why: `there are only ${n - 1} adjacent pairs` },
          { value: fr(F(n - 1, 4)), why: "using P(both heads) = 1/4 instead of P(equal) = 1/2" },
          { value: fr(F(n - 2, 2)), why: "off by one pair" },
          { value: fr(F(n, 4)), why: "n/4" },
        ],
        solution: [`${n - 1} adjacent pairs, each equal with probability 1/2.`, `E = ${ans}.`],
        hint: "Count adjacent pairs.",
        params: { sub, n },
      };
    }
    if (sub === "distinct_values") {
      const s = r.pick([6, 8, 10, 12, 20]);
      const n = r.int(3, 2 * s);
      const ans = F(s).mul(F(s - 1, s).pow(n).comp());
      return {
        sub,
        text: `A fair ${s}-sided die is rolled ${n} times. What is the expected number of different faces that appear?`,
        unit: "num",
        answer: fr(ans),
        distractors: [
          { value: fr(F(Math.min(n, s))), why: "assuming no repeats" },
          { value: fr(F(s).mul(F(1, s).pow(n).comp())), why: "using P(face shows every time) in the complement" },
          { value: fr(F(n * (s - 1), s)), why: "n·(s−1)/s" },
          { value: fr(F(s, 2)), why: "half the faces" },
          { value: fr(F(s).mul(F(s - 1, s).pow(n))), why: "that is the expected number of faces that never appear" },
        ],
        solution: [`A given face appears at least once with probability 1 − ((${s}−1)/${s})^${n}.`, `Sum over ${s} faces: E = ${s}·(1 − (${s - 1}/${s})^${n}) ≈ ${ans.toNumber().toFixed(3)}.`],
        hint: "Indicator per face: did it appear?",
        params: { sub, s, n },
      };
    }
    if (sub === "empty_boxes") {
      const m = r.int(3, 10);
      const n = r.int(2, 2 * m);
      const ans = F(m).mul(F(m - 1, m).pow(n));
      return {
        sub,
        text: `${n} balls are thrown independently and uniformly into ${m} boxes. What is the expected number of empty boxes?`,
        unit: "num",
        answer: fr(ans),
        distractors: [
          { value: fr(F(Math.max(m - n, 0))), why: "assuming every ball lands in a new box" },
          { value: fr(F(m - 1, m).pow(n)), why: "probability one box is empty, not the sum" },
          { value: fr(F(m).mul(F(m - 1, m).pow(n).comp())), why: "expected number of non-empty boxes" },
          { value: fr(F(m).mul(F(1, m).pow(n))), why: "using 1/m instead of (m−1)/m" },
        ],
        solution: [`A given box is missed by every ball with probability ((${m}−1)/${m})^${n}.`, `E = ${m}·(${m - 1}/${m})^${n} ≈ ${ans.toNumber().toFixed(3)}.`],
        hint: "Indicator per box.",
        params: { sub, m, n },
      };
    }
    if (sub === "records") {
      const n = r.int(4, 12);
      const ans = harmonic(n);
      return {
        sub,
        text: `${n} people of different heights enter a room one at a time in random order. A bell rings whenever someone taller than everyone already inside enters (it rings for the first person). What is the expected number of rings?`,
        unit: "num",
        answer: fr(ans),
        distractors: [
          { value: fr(F(n, 2)), why: "half the people" },
          { value: fr(approx(Math.log(n))), why: "ln n: the asymptotic form without the +0.577" },
          { value: fr(ans.sub(1)), why: "forgetting the first person" },
          { value: fr(approx(Math.log2(n))), why: "log₂ n" },
          { value: fr(F(1)), why: "only the tallest person" },
        ],
        solution: [`The k-th person is the tallest so far with probability 1/k.`, `E = 1 + 1/2 + … + 1/${n} = H_${n} ≈ ${ans.toNumber().toFixed(3)}.`],
        hint: "Indicator: is person k the tallest of the first k?",
        params: { sub, n },
      };
    }
    if (sub === "couples") {
      const n = r.int(3, 8);
      const round = r.chance(0.5);
      const ans = round ? F(2 * n, 2 * n - 1) : F(1);
      return {
        sub,
        text: `${n} couples (${2 * n} people) sit in random order ${round ? "around a round table" : `in a row of ${2 * n} chairs`}. What is the expected number of couples sitting next to each other?`,
        unit: "num",
        answer: fr(ans),
        distractors: [
          { value: fr(round ? F(1) : F(2 * n, 2 * n - 1)), why: round ? "the row answer" : "the round-table answer" },
          { value: fr(F(n, 2 * n - 1)), why: "using 1/(2n−1) per couple (forgot the two neighbours)" },
          { value: fr(F(n, 2)), why: "half the couples" },
          { value: fr(F(1, 2)), why: "one half" },
        ],
        solution: round
          ? ["Fix one partner: the other is in one of the 2 adjacent seats out of 2n−1.", `P = 2/(2n−1); E = n·2/(2n−1) = ${ans}.`]
          : ["In a row, a given couple is adjacent with probability (2n−1)·2/(2n(2n−1)) = 1/n.", "E = n·1/n = 1."],
        hint: "Indicator per couple.",
        params: { sub, n, round },
      };
    }
    // runs
    const n = r.int(5, 40);
    const ans = F(n + 1, 2);
    return {
      sub,
      text: `A fair coin is flipped ${n} times. A run is a maximal block of equal consecutive flips (HHTHH has 3 runs). What is the expected number of runs?`,
      unit: "num",
      answer: fr(ans),
      distractors: [
        { value: fr(F(n, 2)), why: "n/2" },
        { value: fr(F(n - 1, 2)), why: "the number of changes, forgetting the first run" },
        { value: fr(F(2)), why: "one run of each face" },
        { value: fr(F(n, 4).add(1)), why: "using P(change) = 1/4" },
      ],
      solution: ["Runs = 1 + number of positions where the flip changes.", `Each of the ${n - 1} gaps changes with probability 1/2: E = 1 + ${n - 1}/2 = ${ans}.`],
      hint: "Count the changes between neighbours.",
      params: { sub, n },
    };
  },
};
