import { describe, expect, it } from "vitest";
import { BTO_FAMILIES, generateBto } from "../index";
import { closestIndex, distinctEnough, scoreBto } from "../core";
import { Fraction } from "@/lib/fraction";
import { makeRng } from "@/lib/rng";
import { bruteForce, simulate, type Checked } from "./verify";
import { DIFFICULTIES } from "@/modules/types";

const N_ITEMS = 1000;
const MC_PARAM_SETS = 10;
const MC_SAMPLES = 40_000;

function exactNum(e: string): number {
  return e === "inf" ? Infinity : Fraction.parse(e).toNumber();
}

for (const fam of BTO_FAMILIES) {
  describe(`BTO ${fam.id}`, () => {
    for (const d of DIFFICULTIES) {
      it(`difficulty ${d}: ${N_ITEMS} items verified (answer, unique closest, distinct options)`, () => {
        const cache = new Map<string, Checked>();
        const needMc = new Map<string, { params: Record<string, unknown>; exact: number }>();
        const mcSample = new Map<string, { params: Record<string, unknown>; exact: number }>();
        let omitted = 0;
        for (let seed = 0; seed < N_ITEMS; seed++) {
          const item = generateBto(fam.id, d, seed);
          const key = JSON.stringify(item.params);
          let chk = cache.get(key);
          if (!chk) {
            chk = bruteForce(fam.id, item.params);
            cache.set(key, chk);
          }
          const ex = exactNum(item.exact);
          const tag = `${fam.id}/${d}/${seed} ${key}`;
          // (a) keyed answer equals an independent computation
          if (chk.kind === "exact") expect(item.exact, tag).toBe(chk.v.toString());
          else if (chk.kind === "float") expect(Math.abs(ex - chk.v), tag).toBeLessThanOrEqual(chk.tol * Math.max(1, Math.abs(chk.v)));
          else if (chk.kind === "inf") expect(item.exact, tag).toBe("inf");
          else needMc.set(key, { params: item.params, exact: ex });
          if (Number.isFinite(ex) && mcSample.size < MC_PARAM_SETS && !mcSample.has(key)) mcSample.set(key, { params: item.params, exact: ex });

          // structure
          expect(item.options.length, tag).toBe(5);
          // (c) no duplicate options, all at least 3% apart
          const labels = new Set(item.options.map((o) => o.label));
          expect(labels.size, tag).toBe(5);
          for (let i = 0; i < 5; i++)
            for (let j = i + 1; j < 5; j++) expect(distinctEnough(item.options[i].value, item.options[j].value), `${tag} ${item.options[i].label} vs ${item.options[j].label}`).toBe(true);
          // (b) exactly one option is closest, and it is the keyed one
          expect(closestIndex(item.options, ex), tag).toBe(item.correctIndex);
          const dists = item.options
            .map((o) => (ex === Infinity ? (o.value === Infinity ? 0 : Infinity) : o.value === Infinity ? Infinity : Math.abs(o.value - ex)))
            .sort((a, b) => a - b);
          expect(dists[1], tag).toBeGreaterThan(dists[0]);
          if (Number.isFinite(ex)) expect(dists[1] - dists[0], tag).toBeGreaterThanOrEqual(0.01 * Math.abs(ex) - 1e-12);
          if (!item.exactIncluded) omitted++;
          // probabilities are valid
          if (item.unit === "prob") for (const o of item.options) expect(o.value >= 0 && o.value <= 1, tag).toBe(true);
          // scoring
          expect(scoreBto(item, item.correctIndex)).toEqual({ correct: true, score: 1 });
          expect(scoreBto(item, (item.correctIndex + 1) % 5)).toEqual({ correct: false, score: -1 });
          expect(scoreBto(item, null)).toEqual({ correct: null, score: 0 });
        }
        if (d === 3 && fam.id !== "divergent") expect(omitted, "exact answer is sometimes deliberately omitted").toBeGreaterThan(0);

        // Monte Carlo cross-check: every item without an exact brute force, plus a sample of the rest
        const r = makeRng(12345);
        for (const [key, { params, exact }] of [...needMc, ...mcSample]) {
          let n = 0;
          let s = 0;
          let s2 = 0;
          for (let i = 0; i < MC_SAMPLES; i++) {
            const x = simulate(fam.id, params, r);
            if (x === null) break;
            if (Number.isNaN(x)) continue;
            n++;
            s += x;
            s2 += x * x;
          }
          if (n === 0) {
            expect(needMc.has(key), `no MC and no brute force for ${fam.id} ${key}`).toBe(false);
            continue;
          }
          const mean = s / n;
          const sd = Math.sqrt(Math.max(0, s2 / n - mean * mean));
          const tol = 5 * (sd / Math.sqrt(n)) + 1e-9;
          expect(Math.abs(mean - exact), `MC ${fam.id}/${d} ${key}: mc=${mean} exact=${exact}`).toBeLessThanOrEqual(tol);
        }
      });
    }
  });
}

const EXPECTED_SUBS: Record<string, string[]> = {
  dice: ["sum_eq", "sum_ge", "max_le", "max_eq", "min_ge", "min_eq", "atleast", "atleast2"],
  coins: ["k_heads", "atleast_k", "exp_pattern", "first_pattern", "run"],
  cards: ["same_suit", "pair", "two_of_rank", "diff_suits", "k_suit", "first_ace_pos", "group_before", "first_ace_at", "first_ace_pos_gen", "flush"],
  urns: ["both_red", "same_color", "one_each", "second_red", "k_red", "last_ball", "polya", "transfer"],
  birthday: ["share_small", "share_365", "share_mine", "exp_pairs", "min_n"],
  bayes: ["test", "test_twice", "two_coins", "two_child", "two_child_tuesday", "monty", "monty_ignorant", "urn_bayes"],
  waiting: ["geom_mean", "geom_pmf", "geom_tail", "negbin_mean", "coupon", "coupon_partial", "negbin_pmf", "geom_set"],
  ev: ["payout", "max2", "product", "reroll", "reroll_k", "game", "until_tails", "max_n"],
  ruin: ["win_fair", "win_biased", "duration_fair", "duration_biased"],
  walk: ["cycle_return", "line_hit", "cycle_hit", "cover_cycle", "graph_return"],
  markov: ["deuce", "race", "craps", "chain_prob", "chain_steps"],
  linearity: ["fixed_points", "adjacent_equal", "distinct_values", "empty_boxes", "records", "couples", "runs"],
  martingale: ["doubling_ev", "doubling_ev_edge", "doubling_pwin", "stop_profit", "stop_profit_edge"],
  divergent: ["st_pete", "st_pete_capped", "exceed_first", "exceed_fixed", "die_strict", "die_atleast", "return_line"],
};

describe("BTO sub-variant coverage", () => {
  it("every declared sub-variant is actually generated", () => {
    for (const fam of BTO_FAMILIES) {
      const seen = new Set<string>();
      for (const d of DIFFICULTIES) for (let s = 0; s < 400; s++) seen.add(generateBto(fam.id, d, s).sub);
      expect([...seen].sort(), fam.id).toEqual([...EXPECTED_SUBS[fam.id]].sort());
    }
  });
});
