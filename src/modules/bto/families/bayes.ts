import { F, Fraction } from "@/lib/fraction";
import { type BtoFamily, type Scenario, fr, pctStr } from "../core";

export function posterior(prior: Fraction, likeA: Fraction, likeB: Fraction): Fraction {
  const a = prior.mul(likeA);
  return a.div(a.add(prior.comp().mul(likeB)));
}

export function montyKnowing(n: number, k: number): Fraction {
  return F(n - 1, n * (n - k - 1));
}

export const bayes: BtoFamily = {
  id: "bayes",
  name: "Conditional & Bayes",
  blurb: "Medical tests, two-child, Monty Hall variants",
  generate(r, d): Scenario {
    const subs = d === 1 ? ["test", "two_coins"] : d === 2 ? ["two_child", "monty", "test", "two_coins"] : ["test_twice", "monty_ignorant", "two_child_tuesday", "urn_bayes", "monty"];
    const sub = r.pick(subs);

    if (sub === "test" || sub === "test_twice") {
      const prev = r.pick(d === 1 ? [F(1, 100), F(1, 50), F(1, 20), F(1, 10)] : [F(1, 1000), F(1, 200), F(1, 100), F(1, 50), F(1, 20)]);
      const sens = r.pick([F(9, 10), F(19, 20), F(99, 100), F(4, 5)]);
      const fpr = r.pick([F(1, 20), F(1, 10), F(1, 100), F(1, 50)]);
      const twice = sub === "test_twice";
      const lA = twice ? sens.pow(2) : sens;
      const lB = twice ? fpr.pow(2) : fpr;
      const ans = posterior(prev, lA, lB);
      return {
        sub,
        text: `A disease affects ${pctStr(prev)} of people. A test detects it in ${pctStr(sens)} of sick people and gives a false positive for ${pctStr(fpr)} of healthy people. ${twice ? "A person tests positive on two independent tests." : "A randomly chosen person tests positive."} What is the probability they have the disease?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(lA), why: "confusing P(positive | sick) with P(sick | positive)" },
          { value: fr(lB.comp()), why: "using the specificity" },
          { value: fr(prev.mul(lA)), why: "the joint probability P(sick and positive)" },
          { value: fr(twice ? posterior(prev, sens, fpr) : prev), why: twice ? "that is after only one positive test" : "ignoring the test (prior)" },
          { value: fr(posterior(F(1, 2), lA, lB)), why: "ignoring the base rate (50/50 prior)" },
        ],
        solution: [
          `P(sick ∧ +) = ${prev} · ${lA} = ${prev.mul(lA)}.`,
          `P(healthy ∧ +) = ${prev.comp()} · ${lB} = ${prev.comp().mul(lB)}.`,
          `P(sick | +) = ${prev.mul(lA)} / (${prev.mul(lA)} + ${prev.comp().mul(lB)}) = ${ans} ≈ ${pctStr(ans)}.`,
        ],
        hint: "Think of 1,000,000 people: how many true vs false positives?",
        params: { sub, prev: prev.toString(), sens: sens.toString(), fpr: fpr.toString(), twice },
      };
    }
    if (sub === "two_coins") {
      const m = r.int(1, 4);
      const k = r.int(1, d === 1 ? 3 : 5);
      const ans = F(2 ** k, 2 ** k + m);
      return {
        sub,
        text: `A bag holds ${m} fair coin${m > 1 ? "s" : ""} and 1 double-headed coin. You pick a coin at random and flip it ${k} time${k > 1 ? "s" : ""}: ${k > 1 ? "all heads" : "heads"}. What is the probability you picked the double-headed coin?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(F(1, m + 1)), why: "ignoring the evidence (prior)" },
          { value: fr(F(1, 2).pow(k).comp()), why: "1 − P(fair coin shows all heads)" },
          { value: fr(F(1, 2)), why: "two kinds of coin → 1/2" },
          { value: fr(F(2 ** k, 2 ** k + 1)), why: "ignoring how many fair coins there are" },
          { value: fr(F(2 ** (k - 1), 2 ** (k - 1) + m)), why: "one flip too few in the likelihood" },
        ],
        solution: [
          `Likelihood of ${k} heads: double-headed 1, fair (1/2)^${k}.`,
          `P = (1/${m + 1}·1) / (1/${m + 1}·1 + ${m}/${m + 1}·(1/2)^${k}) = 2^${k}/(2^${k} + ${m}) = ${ans} ≈ ${pctStr(ans)}.`,
        ],
        hint: "Posterior odds = prior odds × likelihood ratio.",
        params: { sub, m, k },
      };
    }
    if (sub === "two_child" || sub === "two_child_tuesday") {
      const variant = sub === "two_child_tuesday" ? "tuesday" : r.pick(["atleast", "older"]);
      const ans = variant === "atleast" ? F(1, 3) : variant === "older" ? F(1, 2) : F(13, 27);
      const info =
        variant === "atleast" ? "at least one of them is a boy" : variant === "older" ? "the older child is a boy" : "at least one of them is a boy born on a Tuesday";
      return {
        sub,
        text: `A family has two children. Each child is independently a boy or girl with probability 1/2${variant === "tuesday" ? " and born on any of the 7 days of the week with equal probability" : ""}. You learn that ${info}. What is the probability that both children are boys?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(F(1, 2)), why: "ignoring which information was given" },
          { value: fr(F(1, 3)), why: "the 'at least one boy' answer" },
          { value: fr(F(1, 4)), why: "unconditional P(two boys)" },
          { value: fr(F(2, 3)), why: "P(the other child is a girl) given at least one boy" },
          { value: fr(F(13, 28)), why: "Tuesday case with the double-counted Tuesday-boy pair not removed" },
          { value: fr(F(1, 7)), why: "the probability of Tuesday" },
        ],
        solution:
          variant === "atleast"
            ? ["Equally likely: BB, BG, GB, GG. Remove GG.", "BB is 1 of the 3 remaining → 1/3."]
            : variant === "older"
              ? ["Only the younger child is unknown.", "P(younger is a boy) = 1/2."]
              : [
                  "Each child has 14 equally likely types (sex × weekday): 196 combinations.",
                  "With at least one Tuesday-boy: 14 + 14 − 1 = 27 combinations.",
                  "Both boys among them: 7 + 7 − 1 = 13 → 13/27.",
                ],
        hint: "List the equally likely cases and condition on exactly what was revealed.",
        params: { sub, variant },
      };
    }
    if (sub === "monty") {
      const n = r.int(3, d === 2 ? 6 : 10);
      const k = r.int(1, n - 2);
      const ans = montyKnowing(n, k);
      const one = n - k - 1 === 1;
      return {
        sub,
        text: `A game show has ${n} doors: one hides a car, the rest goats. You pick a door. The host, who knows where the car is, opens ${k} of the other doors, always revealing goats. ${one ? "You switch to the remaining closed door." : `You then switch to one of the ${n - k - 1} other closed doors chosen at random.`} What is the probability you win the car?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(F(1, n - k)), why: "assuming all closed doors are equally likely" },
          { value: fr(F(1, n)), why: "that is the probability if you stay" },
          { value: fr(F(n - 1, n)), why: "P(first pick wrong), forgetting you must then pick the right door" },
          { value: fr(F(1, n - k - 1)), why: "uniform over the doors you could switch to" },
          { value: fr(F(n - 1, n * (n - k))), why: "dividing by all closed doors" },
        ],
        solution: [
          `Your first pick is wrong with probability ${n - 1}/${n}; then the car is behind one of the ${n - k - 1} other closed doors.`,
          `P(win by switching) = ${n - 1}/${n} · 1/${n - k - 1} = ${ans} ≈ ${pctStr(ans)}.`,
        ],
        hint: "The host's choice never moves the car; condition on your first pick.",
        params: { sub, n, k },
      };
    }
    if (sub === "monty_ignorant") {
      const n = r.int(3, 6);
      const ans = F(1, n - 1);
      return {
        sub,
        text: `A game show has ${n} doors: one car, the rest goats. You pick a door. The host does NOT know where the car is and opens one of the other ${n - 1} doors at random; it happens to show a goat. You switch to ${n === 3 ? "the remaining closed door" : `one of the other ${n - 2} closed doors chosen at random`}. What is the probability you win the car?`,
        unit: "prob",
        answer: fr(ans),
        distractors: [
          { value: fr(montyKnowing(n, 1)), why: "the knowing-host answer" },
          { value: fr(F(1, n)), why: "the stay probability before any reveal" },
          { value: fr(F(n - 1, n)), why: "P(first pick wrong)" },
          { value: fr(F(1, n - 2)), why: "ignoring that you may already hold the car" },
        ],
        solution: [
          `P(goat revealed) = 1/${n}·1 + ${n - 1}/${n}·${n - 2}/${n - 1} = ${n - 1}/${n}.`,
          `P(your door has the car | goat revealed) = (1/${n}) / (${n - 1}/${n}) = 1/${n - 1}.`,
          `${n === 3 ? "Switching wins otherwise" : `Switching wins with probability (1 − 1/${n - 1}) · 1/${n - 2}`} = 1/${n - 1} ≈ ${pctStr(ans)} — switching no longer helps.`,
        ],
        hint: "An accidental goat reveal carries information about your own door too.",
        params: { sub, n },
      };
    }
    // urn_bayes
    const rA = r.int(2, 6);
    const bA = r.int(1, 5);
    const rB = r.int(2, 5);
    const bB = r.int(2, 6);
    const prior = r.pick([F(1, 2), F(1, 3), F(2, 3)]);
    const NA = rA + bA;
    const NB = rB + bB;
    const lA = F(rA * (rA - 1), NA * (NA - 1));
    const lB = F(rB * (rB - 1), NB * (NB - 1));
    const ans = posterior(prior, lA, lB);
    return {
      sub,
      text: `Urn A has ${rA} red and ${bA} blue balls; urn B has ${rB} red and ${bB} blue. You choose urn A with probability ${prior} (otherwise B) and draw two balls without replacement: both red. What is the probability you chose urn A?`,
      unit: "prob",
      answer: fr(ans),
      distractors: [
        { value: fr(posterior(prior, F(rA, NA).pow(2), F(rB, NB).pow(2))), why: "likelihoods computed with replacement" },
        { value: fr(prior), why: "ignoring the evidence" },
        { value: fr(posterior(F(1, 2), lA, lB)), why: "ignoring the prior" },
        { value: fr(lA), why: "P(two reds | A) instead of P(A | two reds)" },
        { value: fr(posterior(prior, F(rA, NA), F(rB, NB))), why: "using only one draw" },
      ],
      solution: [
        `P(RR | A) = ${rA}/${NA}·${rA - 1}/${NA - 1} = ${lA}; P(RR | B) = ${rB}/${NB}·${rB - 1}/${NB - 1} = ${lB}.`,
        `P(A | RR) = ${prior}·${lA} / (${prior}·${lA} + ${prior.comp()}·${lB}) = ${ans} ≈ ${pctStr(ans)}.`,
      ],
      hint: "Bayes with likelihoods from drawing without replacement.",
      params: { sub, rA, bA, rB, bB, prior: prior.toString() },
    };
  },
};
