import { F, Fraction } from "@/lib/fraction";
import { binom } from "@/lib/math";
import { type BtoFamily, type Scenario, fr, pctStr, numw } from "../core";

const hyper = (K: number, N: number, n: number, k: number) => F(binom(K, k) * binom(N - K, n - k), binom(N, n));
const binomP = (n: number, k: number, p: Fraction) => F(binom(n, k)).mul(p.pow(k)).mul(p.comp().pow(n - k));

export const urns: BtoFamily = {
  id: "urns",
  name: "Urns",
  blurb: "With vs without replacement, Pólya urns, transfers",
  generate(r, d): Scenario {
    const subs = d === 1 ? ["both_red", "same_color"] : d === 2 ? ["second_red", "k_red", "one_each"] : ["last_ball", "polya", "transfer", "k_red"];
    const sub = r.pick(subs);
    const red = r.int(2, d === 1 ? 6 : 8);
    const blue = r.int(2, d === 1 ? 6 : 8);
    const N = red + blue;
    const urn = `An urn contains ${red} red and ${blue} blue balls.`;
    const pr = F(red, N);

    if (sub === "both_red") {
      const ans = F(red * (red - 1), N * (N - 1));
      return {
        sub,
        text: `${urn} Two balls are drawn without replacement. What is the probability that both are red?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(pr.pow(2)), why: "with replacement" },
          { value: fr(pr), why: "only the first draw" },
          { value: fr(F(red - 1, N - 1)), why: "only the second draw (given the first was red)" },
          { value: fr(F(2 * red * blue, N * (N - 1))), why: "that is one of each colour" },
          { value: fr(F(red * (red - 1), N * N)), why: "shrinking the numerator but not the denominator" },
        ],
        solution: [`P = ${red}/${N} · ${red - 1}/${N - 1} = ${ans} ≈ ${pctStr(ans)}.`],
        hint: "Without replacement: the second draw has one red and one ball fewer.",
        params: { sub, red, blue },
      };
    }
    if (sub === "same_color") {
      const ans = F(red * (red - 1) + blue * (blue - 1), N * (N - 1));
      return {
        sub,
        text: `${urn} Two balls are drawn without replacement. What is the probability that they have the same colour?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(F(red * red + blue * blue, N * N)), why: "with replacement" },
          { value: fr(F(1, 2)), why: "two colours → 1/2" },
          { value: fr(F(red * (red - 1), N * (N - 1))), why: "only both red" },
          { value: fr(ans.comp()), why: "that is different colours" },
        ],
        solution: [`P(both red) + P(both blue) = ${red}·${red - 1}/(${N}·${N - 1}) + ${blue}·${blue - 1}/(${N}·${N - 1}).`, `= ${ans} ≈ ${pctStr(ans)}.`],
        hint: "Add the two disjoint cases.",
        params: { sub, red, blue },
      };
    }
    if (sub === "one_each") {
      const ans = F(2 * red * blue, N * (N - 1));
      return {
        sub,
        text: `${urn} Two balls are drawn without replacement. What is the probability of getting one red and one blue ball?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(F(red * blue, N * (N - 1))), why: "forgetting the order (blue first also counts)" },
          { value: fr(F(2 * red * blue, N * N)), why: "with replacement" },
          { value: fr(F(1, 2)), why: "two outcomes → 1/2" },
          { value: fr(F(red * blue, binom(N, 2) * 2n)), why: "dividing unordered pairs by ordered draws" },
        ],
        solution: [`Red then blue: ${red}/${N}·${blue}/${N - 1}; blue then red: ${blue}/${N}·${red}/${N - 1}.`, `Sum = ${ans} ≈ ${pctStr(ans)} (= ${red}·${blue}/C(${N},2)).`],
        hint: "Two orders, or count unordered pairs: r·b / C(N,2).",
        params: { sub, red, blue },
      };
    }
    if (sub === "second_red") {
      const ans = pr;
      return {
        sub,
        text: `${urn} Two balls are drawn one after the other without replacement; you do not see the first. What is the probability that the second ball is red?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(F(red - 1, N - 1)), why: "assuming the first ball was red" },
          { value: fr(F(red, N - 1)), why: "assuming the first ball was blue" },
          { value: fr(F(red * (red - 1), N * (N - 1))), why: "that is both red" },
          { value: fr(F(1, 2)), why: "two colours → 1/2" },
        ],
        solution: ["By symmetry every position in the draw order is equally likely to hold any given ball.", `So P(second is red) = P(first is red) = ${red}/${N} ≈ ${pctStr(ans)}.`],
        hint: "An unseen first draw changes nothing on average.",
        params: { sub, red, blue },
      };
    }
    if (sub === "k_red") {
      const n = r.int(3, Math.min(4, N - 1));
      const k = r.int(Math.max(1, n - blue), Math.min(n - 1, red));
      const ans = hyper(red, N, n, k);
      return {
        sub,
        text: `${urn} ${numw(n)[0].toUpperCase() + numw(n).slice(1)} balls are drawn without replacement. What is the probability that exactly ${k} of them are red?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(binomP(n, k, pr)), why: "binomial (with replacement)" },
          { value: fr(F(binom(red, k), binom(N, n))), why: "forgetting to choose the blue balls" },
          { value: fr(hyper(red, N, n, Math.min(k + 1, n))), why: "off by one red" },
          { value: fr(pr.pow(k).mul(pr.comp().pow(n - k))), why: "one specific order only" },
        ],
        solution: [`Hypergeometric: C(${red},${k})·C(${blue},${n - k}) / C(${N},${n}).`, `= ${ans} ≈ ${pctStr(ans)}.`],
        hint: "Count subsets: choose the reds, choose the blues.",
        params: { sub, red, blue, n, k },
      };
    }
    if (sub === "last_ball") {
      return {
        sub,
        text: `${urn} All balls are drawn one at a time without replacement. What is the probability that the last ball drawn is red?`,
        unit: "prob",
        answer: fr(pr),
        distractors: [
          { value: fr(F(1, 2)), why: "two colours → 1/2" },
          { value: fr(F(1, N)), why: "probability that a particular ball is last" },
          { value: fr(F(red - 1, N - 1)), why: "conditioning on something that did not happen" },
          { value: fr(F(blue, N)), why: "swapping the colours" },
        ],
        solution: ["Every ordering of the balls is equally likely, so the last position is a uniformly random ball.", `P = ${red}/${N} ≈ ${pctStr(pr)}.`],
        hint: "Positions are exchangeable: last is just as random as first.",
        params: { sub, red, blue },
      };
    }
    if (sub === "polya") {
      const c = r.int(1, 3);
      const both = r.chance(0.5);
      const text = `${urn} You draw a ball, then put it back together with ${c} more ball${c > 1 ? "s" : ""} of the same colour, and draw again. What is the probability that ${both ? "both draws are red" : "the second draw is red"}?`;
      if (!both) {
        return {
          sub,
          text,
          unit: "prob",
          answer: fr(pr),
          distractors: [
            { value: fr(F(red + c, N + c)), why: "assuming the first draw was red" },
            { value: fr(F(red, N + c)), why: "assuming the first draw was blue" },
            { value: fr(pr.pow(2)), why: "that is both red with replacement" },
            { value: fr(F(red * (red + c), N * (N + c))), why: "that is both red" },
          ],
          solution: [
            `P(2nd red) = ${red}/${N}·${red + c}/${N + c} + ${blue}/${N}·${red}/${N + c}.`,
            `= ${red}(${red + c} + ${blue})/(${N}·${N + c}) = ${red}/${N} ≈ ${pctStr(pr)} — the Pólya urn is exchangeable.`,
          ],
          hint: "Condition on the first draw and simplify.",
          params: { sub, red, blue, c, both },
        };
      }
      const ans = F(red * (red + c), N * (N + c));
      return {
        sub,
        text,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(pr.pow(2)), why: "ignoring the added balls (with replacement)" },
          { value: fr(F(red * (red - 1), N * (N - 1))), why: "without replacement" },
          { value: fr(pr), why: "only the first draw" },
          { value: fr(F(red + c, N + c)), why: "only the second draw" },
        ],
        solution: [`P = ${red}/${N} · ${red + c}/${N + c} = ${ans} ≈ ${pctStr(ans)}.`],
        hint: "After a red draw the urn has c more reds.",
        params: { sub, red, blue, c, both },
      };
    }
    // transfer
    const r2 = r.int(1, 6);
    const b2 = r.int(1, 6);
    const N2 = r2 + b2;
    const ans = pr.mul(F(r2 + 1, N2 + 1)).add(pr.comp().mul(F(r2, N2 + 1)));
    return {
      sub,
      text: `Urn A has ${red} red and ${blue} blue balls; urn B has ${r2} red and ${b2} blue balls. A random ball is moved from A to B, then a ball is drawn from B. What is the probability it is red?`,
      unit: "prob",
      answer: fr(ans),
      distractors: [
        { value: fr(F(r2, N2)), why: "ignoring the transferred ball" },
        { value: fr(F(r2 + 1, N2 + 1)), why: "assuming the moved ball was red" },
        { value: fr(F(red + r2, N + N2)), why: "pooling both urns" },
        { value: fr(F(r2, N2 + 1)), why: "assuming the moved ball was blue" },
      ],
      solution: [
        `Condition on the moved ball: red w.p. ${red}/${N}, blue w.p. ${blue}/${N}.`,
        `P = ${red}/${N}·${r2 + 1}/${N2 + 1} + ${blue}/${N}·${r2}/${N2 + 1} = ${ans} ≈ ${pctStr(ans)}.`,
      ],
      hint: "Law of total probability over the moved ball's colour.",
      params: { sub, red, blue, r2, b2 },
    };
  },
};
