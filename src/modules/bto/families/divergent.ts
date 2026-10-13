import { F, Fraction } from "@/lib/fraction";
import { harmonic } from "@/lib/math";
import { type BtoFamily, type Scenario, fr, INF } from "../core";

export const divergent: BtoFamily = {
  id: "divergent",
  name: "Divergent expectations",
  blurb: "St Petersburg, waiting to beat a record, recurrence",
  generate(r, d): Scenario {
    const sub = d === 1 ? r.pick(["st_pete", "st_pete_capped"]) : d === 2 ? r.pick(["exceed_first", "exceed_fixed", "st_pete_capped", "die_strict"]) : r.pick(["die_strict", "die_atleast", "return_line", "exceed_first", "st_pete"]);

    if (sub === "st_pete") {
      return {
        sub,
        text: "A fair coin is flipped until it lands heads. If that takes k flips you win $2^k. What is the expected payout?",
        unit: "num",
        answer: INF,
        distractors: [
          { value: fr(F(4)), why: "2^E[k] = 2² (plugging in the expected number of flips)" },
          { value: fr(F(2)), why: "the most likely payout" },
          { value: fr(F(1)), why: "each term contributes 1, counted once" },
          { value: fr(F(8)), why: "a 'large but finite' guess" },
        ],
        solution: ["P(k flips) = 2^−k and the payout is 2^k, so each k contributes exactly $1.", "E = Σ_k 1 = ∞."],
        hint: "Write E as a sum over k; what is each term?",
        params: { sub },
      };
    }
    if (sub === "st_pete_capped") {
      const c = r.int(3, 20);
      const ans = F(c + 1);
      return {
        sub,
        text: `A fair coin is flipped until it lands heads. If that takes k flips you win $2^k, but the payout is capped at $${2 ** c}. What is the expected payout?`,
        unit: "num",
        answer: fr(ans),
        distractors: [
          { value: INF, why: "forgetting the cap" },
          { value: fr(F(2 ** c, 2)), why: "half the cap" },
          { value: fr(F(c)), why: "forgetting the tail beyond the cap" },
          { value: fr(F(c + 2)), why: "double-counting the capped tail" },
          { value: fr(F(4)), why: "2^E[k]" },
        ],
        solution: [`For k ≤ ${c}, each k contributes 2^−k·2^k = 1 → ${c}.`, `For k > ${c}: payout ${2 ** c} with probability 2^−${c} → 1.`, `E = ${c} + 1 = ${ans}.`],
        hint: "Every uncapped k contributes $1.",
        params: { sub, c },
      };
    }
    if (sub === "exceed_first") {
      return {
        sub,
        text: "You draw independent Uniform(0,1) numbers X₁, X₂, … and stop at the first draw that is larger than X₁. What is the expected number of draws after the first one?",
        unit: "num",
        answer: INF,
        distractors: [
          { value: fr(F(2)), why: "E[1/(1−X₁)] confused with 1/(1−E[X₁])" },
          { value: fr(Fraction.parse(Math.E.toPrecision(12))), why: "e: that is the 'until the sequence decreases' puzzle" },
          { value: fr(F(1)), why: "most of the time one draw is enough" },
          { value: fr(F(3)), why: "a 'large but finite' guess" },
        ],
        solution: [
          "Given X₁ = x, the wait is geometric with mean 1/(1−x).",
          "E = ∫₀¹ 1/(1−x) dx = ∞ (log divergence): a high first draw makes you wait very long.",
          "Equivalently P(more than n draws needed) = 1/(n+1), and Σ 1/(n+1) diverges.",
        ],
        hint: "Condition on X₁ and integrate the geometric mean.",
        params: { sub },
      };
    }
    if (sub === "exceed_fixed") {
      const t = r.pick([F(1, 2), F(3, 4), F(4, 5), F(9, 10), F(2, 3)]);
      const ans = t.comp().inv();
      return {
        sub,
        text: `You draw independent Uniform(0,1) numbers until one is larger than ${t.toNumber()}. What is the expected number of draws (including the last)?`,
        unit: "num",
        answer: fr(ans),
        distractors: [
          { value: INF, why: "confusing a fixed threshold with 'beat the first draw'" },
          { value: fr(t.inv()), why: "1/t instead of 1/(1−t)" },
          { value: fr(t.div(t.comp())), why: "counting only failed draws" },
          { value: fr(F(2)), why: "two draws on average regardless of t" },
        ],
        solution: [`Each draw succeeds with probability 1 − ${t.toNumber()} = ${t.comp()}.`, `Geometric: E = 1/${t.comp()} = ${ans}.`],
        hint: "Fixed success probability → geometric.",
        params: { sub, t: t.toString() },
      };
    }
    if (sub === "die_strict" || sub === "die_atleast") {
      const strict = sub === "die_strict";
      const ans = strict ? INF : fr(harmonic(6));
      return {
        sub,
        text: `You roll a fair die once. Then you keep rolling until you get a number ${strict ? "strictly greater than" : "greater than or equal to"} your first roll. What is the expected number of additional rolls?`,
        unit: "num",
        answer: ans,
        distractors: [
          strict ? { value: fr(harmonic(6)), why: "the 'greater than or equal' answer" } : { value: INF, why: "the 'strictly greater' answer (a first 6 can never be beaten)" },
          { value: fr(F(7, 2)), why: "the expected roll" },
          { value: fr(F(2)), why: "about half the faces beat you" },
          { value: fr(strict ? harmonic(5) : harmonic(6).add(1)), why: strict ? "averaging only over first rolls 1–5" : "counting the first roll" },
          { value: fr(F(6)), why: "the wait for one specific face" },
        ],
        solution: strict
          ? ["If the first roll is 6, no roll can be strictly greater: you wait forever.", "That case has probability 1/6 > 0, so the expectation is infinite."]
          : ["Given first roll f, each roll succeeds with probability (7−f)/6: geometric mean 6/(7−f).", "E = (1/6)·Σ_f 6/(7−f) = 1 + 1/2 + … + 1/6 = 49/20 = 2.45."],
        hint: strict ? "What happens if the first roll is a 6?" : "Condition on the first roll.",
        params: { sub },
      };
    }
    // return_line
    return {
      sub,
      text: "A token starts at 0 on the integer line and moves +1 or −1 with probability 1/2 each step. It returns to 0 with probability 1. What is the expected number of steps until its first return to 0?",
      unit: "num",
      answer: INF,
      distractors: [
        { value: fr(F(2)), why: "the shortest return" },
        { value: fr(F(4)), why: "a 'reasonable' finite guess" },
        { value: fr(F(1)), why: "one step per unit" },
        { value: fr(F(8)), why: "a 'large but finite' guess" },
      ],
      solution: [
        "The walk is recurrent (returns w.p. 1) but null-recurrent.",
        "P(first return at step 2n) ~ c·n^(−3/2), so Σ 2n·P diverges: E = ∞.",
        "Contrast: on a finite cycle of n points the return time is n.",
      ],
      hint: "Recurrent does not mean positive recurrent.",
      params: { sub },
    };
  },
};
