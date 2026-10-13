import { Fraction, F } from "@/lib/fraction";
import { binom } from "@/lib/math";
import { type BtoFamily, type Scenario, fr, pctStr, ORD } from "../core";

const hyper = (K: number, N: number, n: number, k: number) => F(binom(K, k) * binom(N - K, n - k), binom(N, n));
const binomP = (n: number, k: number, p: Fraction) => F(binom(n, k)).mul(p.pow(k)).mul(p.comp().pow(n - k));

export const cards: BtoFamily = {
  id: "cards",
  name: "Cards",
  blurb: "Without replacement: suits, pairs, first ace position",
  generate(r, d): Scenario {
    const subs = d === 1 ? ["same_suit", "pair", "two_of_rank"] : d === 2 ? ["k_suit", "first_ace_pos", "group_before", "diff_suits"] : ["flush", "first_ace_pos_gen", "first_ace_at", "k_suit"];
    const sub = r.pick(subs);
    const deck = "a well-shuffled standard 52-card deck";

    if (sub === "same_suit") {
      const ans = F(12, 51);
      return {
        sub,
        text: `Two cards are drawn from ${deck}. What is the probability that they have the same suit?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(F(1, 4)), why: "with replacement (13/52)" },
          { value: fr(F(13, 52).mul(F(12, 51))), why: "probability both are one particular suit (forgot ×4)" },
          { value: fr(F(3, 51)), why: "that is the probability of the same rank" },
          { value: fr(F(1, 16)), why: "squaring 1/4" },
          { value: fr(F(39, 51)), why: "complement: different suits" },
        ],
        solution: ["The first card can be anything.", "The second must match its suit: 12 of the remaining 51 cards.", `P = 12/51 = 4/17 ≈ ${pctStr(ans)}.`],
        hint: "Condition on the first card.",
        params: { sub },
      };
    }
    if (sub === "pair") {
      const ans = F(3, 51);
      return {
        sub,
        text: `Two cards are drawn from ${deck}. What is the probability that they have the same rank (a pair)?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(F(1, 13)), why: "with replacement (4/52)" },
          { value: fr(F(4, 52).mul(F(3, 51))), why: "probability of a pair of one particular rank (forgot ×13)" },
          { value: fr(F(12, 51)), why: "that is the probability of the same suit" },
          { value: fr(F(3, 52)), why: "forgetting the deck shrinks to 51" },
          { value: fr(F(1, 169)), why: "squaring 1/13" },
        ],
        solution: ["The first card fixes the rank.", "3 cards of that rank remain among 51.", `P = 3/51 = 1/17 ≈ ${pctStr(ans)}.`],
        hint: "Condition on the first card.",
        params: { sub },
      };
    }
    if (sub === "two_of_rank") {
      const ranks = ["aces", "kings", "queens", "jacks", "tens"];
      const rank = r.pick(ranks);
      const n = r.pick([2, 3]);
      const ans = F(binom(4, n), binom(52, n));
      return {
        sub,
        text: `${n === 2 ? "Two" : "Three"} cards are drawn from ${deck}. What is the probability that all of them are ${rank}?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(F(1, 13).pow(n)), why: "with replacement" },
          { value: fr(F(4, 52).mul(F(4, 51)).mul(n === 3 ? F(4, 50) : Fraction.ONE)), why: "forgetting that each drawn " + rank.slice(0, -1) + " leaves one fewer" },
          { value: fr(F(n, 52)), why: "adding chances per card" },
          { value: fr(F(binom(4, n), binom(52, n)).mul(13)), why: "probability of any n-of-a-kind (multiplied by 13 ranks)" },
          { value: fr(F(4, 52).mul(F(3, 52)).mul(n === 3 ? F(2, 52) : Fraction.ONE)), why: "not shrinking the deck" },
        ],
        solution: [`Sequentially: ${n === 2 ? "4/52 · 3/51" : "4/52 · 3/51 · 2/50"}.`, `= C(4,${n})/C(52,${n}) = ${ans} ≈ ${pctStr(ans)}.`],
        hint: "Multiply conditional probabilities: both numerator and denominator shrink.",
        params: { sub, n },
      };
    }
    if (sub === "diff_suits") {
      const ans = F(39, 51).mul(F(26, 50));
      return {
        sub,
        text: `Three cards are drawn from ${deck}. What is the probability that all three have different suits?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(F(3, 4).mul(F(1, 2))), why: "with replacement (39/52 · 26/52)" },
          { value: fr(F(39, 52).mul(F(26, 51))), why: "off-by-one denominators" },
          { value: fr(F(12, 51).mul(F(11, 50))), why: "that is all three of the same suit" },
          { value: fr(F(4 * 13 * 13 * 13, 52 * 51 * 50)), why: "counting ordered draws but unordered suits" },
          { value: fr(F(1, 4).mul(F(1, 4)).mul(3)), why: "adding suit-match probabilities" },
        ],
        solution: ["First card: anything.", "Second: one of the 39 cards of another suit out of 51.", "Third: one of the 26 cards of the two unused suits out of 50.", `P = 39/51 · 26/50 = ${ans} ≈ ${pctStr(ans)}.`],
        hint: "Condition card by card.",
        params: { sub },
      };
    }
    if (sub === "k_suit") {
      const n = d === 2 ? 5 : r.pick([4, 5, 6]);
      const k = r.int(d === 2 ? 1 : 2, 3);
      const ans = hyper(13, 52, n, k);
      return {
        sub,
        text: `${n} cards are dealt from ${deck}. What is the probability of exactly ${k} hearts?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(binomP(n, k, F(1, 4))), why: "binomial with p = 1/4 (as if dealt with replacement)" },
          { value: fr(F(binom(13, k), binom(52, n))), why: "forgetting to choose the non-hearts" },
          { value: fr(hyper(13, 52, n, k + 1)), why: "off by one heart" },
          { value: fr(F(k, n)), why: "proportion instead of probability" },
          { value: fr(F(13, 52).pow(k)), why: "only the hearts' factor" },
        ],
        solution: [
          `Hypergeometric: choose ${k} of the 13 hearts and ${n - k} of the 39 others.`,
          `P = C(13,${k})·C(39,${n - k}) / C(52,${n}) = ${ans} ≈ ${pctStr(ans)}.`,
        ],
        hint: "Without replacement → hypergeometric, not binomial.",
        params: { sub, n, k },
      };
    }
    if (sub === "first_ace_pos" || sub === "first_ace_pos_gen") {
      const N = sub === "first_ace_pos" ? 52 : r.pick([20, 24, 30, 36, 40]);
      const K = sub === "first_ace_pos" ? 4 : r.pick([2, 3, 4, 5]);
      const ans = F(N + 1, K + 1);
      const text =
        sub === "first_ace_pos"
          ? `You turn over the cards of ${deck} one at a time. What is the expected position of the first ace?`
          : `A shuffled deck has ${N} cards, ${K} of which are red. You turn cards over one at a time. What is the expected position of the first red card?`;
      return {
        sub,
        text,
        unit: "num",
        answer: fr(ans),
        distractors: [
          { value: fr(F(N, K)), why: "N/K: as if special cards were evenly spaced from the start" },
          { value: fr(F(N, K + 1)), why: "forgetting the +1 in (N+1)/(K+1)" },
          { value: fr(F(N - K, K + 1)), why: "that is the expected number of cards before the first one" },
          { value: fr(F(N + 1, 2)), why: "expected position of a single random card" },
          { value: fr(F(N + 1, K)), why: "dividing by K instead of K+1" },
        ],
        solution: [
          `The ${K} special cards cut the other ${N - K} cards into ${K + 1} gaps of equal expected size (N−K)/(K+1).`,
          `First position = (cards before it) + 1 = (N−K)/(K+1) + 1 = (N+1)/(K+1) = ${ans}${ans.isInteger() ? "" : ` = ${ans.toNumber().toFixed(2)}`}.`,
        ],
        hint: "Special cards split the rest into K+1 equally sized gaps on average.",
        params: { sub, N, K },
      };
    }
    if (sub === "group_before") {
      const groups = [
        { name: "an ace", size: 4 },
        { name: "a face card (J, Q, K)", size: 12 },
        { name: "a two or a three", size: 8 },
        { name: "a seven", size: 4 },
        { name: "a red ten", size: 2 },
      ];
      let [g1, g2] = r.sample(groups, 2);
      if (g1.size === g2.size) [g1, g2] = [groups[1], g1];
      const ans = F(g1.size, g1.size + g2.size);
      return {
        sub,
        text: `You turn over the cards of ${deck} one at a time. What is the probability that ${g1.name} appears before ${g2.name}?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(F(1, 2)), why: "assuming both are equally likely to come first" },
          { value: fr(F(g2.size, g1.size + g2.size)), why: "swapping the groups" },
          { value: fr(F(g1.size, 52)), why: "probability the first card is in the group" },
          { value: fr(F(g1.size, g2.size)), why: "ratio of group sizes instead of share" },
        ],
        solution: [
          "Only the relative order of the cards in the two groups matters; all orders are equally likely.",
          `The first of those ${g1.size + g2.size} cards belongs to the first group with probability ${g1.size}/${g1.size + g2.size} = ${ans} ≈ ${pctStr(ans)}.`,
        ],
        hint: "Ignore every card that is in neither group.",
        params: { sub, a: g1.size, b: g2.size },
      };
    }
    if (sub === "first_ace_at") {
      const j = r.int(2, 8);
      const ans = F(binom(52 - j, 3), binom(52, 4));
      return {
        sub,
        text: `You turn over the cards of ${deck} one at a time. What is the probability that the first ace is the ${ORD[j]} card?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(F(48, 52).pow(j - 1).mul(F(4, 52))), why: "geometric (with replacement)" },
          { value: fr(F(4, 52)), why: "any specific position holds an ace with 4/52 but ignores 'first'" },
          { value: fr(F(binom(52 - j - 1, 3), binom(52, 4))), why: "off by one position" },
          { value: fr(F(binom(52 - j + 1, 3), binom(52, 4))), why: "off by one position" },
          { value: fr(F(1, 52)), why: "uniform over positions" },
        ],
        solution: [
          `The first ${j - 1} cards are non-aces and card ${j} is an ace.`,
          `P = (48/52)(47/51)…(${48 - j + 2}/${52 - j + 2}) · 4/${52 - j + 1}.`,
          `Equivalently C(${52 - j},3)/C(52,4) = ${ans} ≈ ${pctStr(ans)}.`,
        ],
        hint: "Multiply the chances of non-aces then one ace, shrinking the deck each time.",
        params: { sub, j },
      };
    }
    // flush
    const ans = F(4n * binom(13, 5), binom(52, 5));
    return {
      sub,
      text: `Five cards are dealt from ${deck}. What is the probability that all five are of the same suit (including straight flushes)?`,
      unit: "prob",
      answer: fr(ans),
      distractors: [
        { value: fr(F(1, 4).pow(4)), why: "with replacement: (1/4)^4" },
        { value: fr(F(binom(13, 5), binom(52, 5))), why: "one particular suit only (forgot ×4)" },
        { value: fr(F(12, 51).mul(F(11, 50))), why: "stopping after three cards" },
        { value: fr(F(1, 4).pow(5)), why: "(1/4)^5: requiring a specific suit with replacement" },
        { value: fr(F(13, 52).mul(F(12, 51)).mul(F(11, 50)).mul(F(10, 49))), why: "including the first card's 13/52 factor" },
      ],
      solution: ["First card: anything.", "Then 12/51 · 11/50 · 10/49 · 9/48 for the same suit.", `P = 4·C(13,5)/C(52,5) = ${ans} ≈ ${pctStr(ans)}.`],
      hint: "The first card sets the suit; the next four must follow it.",
      params: { sub },
    };
  },
};
