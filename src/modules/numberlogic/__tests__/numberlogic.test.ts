import { describe, expect, it } from "vitest";
import { Fraction, F } from "@/lib/fraction";
import { DIFFICULTIES } from "@/modules/types";
import { NL_FAMILIES, generateNL, scoreNL } from "../generate";
import { conflicts, fitAll } from "../rules";

const N = 1000;

/** Independent re-derivation of the next term straight from the displayed terms. */
function parseTerm(t: string): Fraction {
  return Fraction.parse(t);
}

for (const fam of NL_FAMILIES) {
  describe(`NumberLogic ${fam.id}`, () => {
    for (const d of DIFFICULTIES) {
      it(`difficulty ${d}: ${N} items unique, keyed correctly, 5 distinct options`, () => {
        for (let seed = 0; seed < N; seed++) {
          const it = generateNL(fam.id, d, seed);
          const tag = `${fam.id}/${d}/${seed}: ${it.terms.join(", ")} → ${it.answerLabel}`;
          const xs = it.terms.map(parseTerm);
          const pairs = fam.id === "fraction" ? it.terms.map((t) => t.split("/").map((x) => F(BigInt(x))) as [Fraction, Fraction]) : undefined;
          const ans = Fraction.parse(it.answer);
          // displayed terms carry the generating values
          expect(xs.map((x) => x.toString()), tag).toEqual(it.values);
          // (a) the explained rule, re-fitted from the visible terms, predicts the keyed answer
          const own = fitAll(xs, pairs).filter((f) => f.rule === it.rule);
          expect(own.length, tag).toBeGreaterThan(0);
          expect(own.some((f) => f.next.eq(ans)), tag).toBe(true);
          // (d) uniqueness: no comparably simple rule predicts something else
          expect(conflicts(xs, ans, it.complexity, pairs).map((f) => `${f.rule} → ${f.next}`), tag).toEqual([]);
          // (b) exactly one option equals the answer, and it is the keyed one
          const vals = it.options.map((o) => Fraction.parse(o.value));
          expect(vals.filter((v) => v.eq(ans)).length, tag).toBe(1);
          expect(vals[it.correctIndex].eq(ans), tag).toBe(true);
          // labels display the same values
          for (const o of it.options) expect(Fraction.parse(o.label).eq(Fraction.parse(o.value)), tag).toBe(true);
          // (c) no duplicates
          expect(new Set(vals.map((v) => v.toString())).size, tag).toBe(5);
          expect(new Set(it.options.map((o) => o.label)).size, tag).toBe(5);
          expect(it.terms.length, tag).toBeGreaterThanOrEqual(5);
        }
      });
    }
  });
}

describe("NumberLogic scoring and checker", () => {
  it("+1 / −1 / 0", () => {
    const it = generateNL("rec2", 1, 1);
    expect(scoreNL(it, it.correctIndex)).toEqual({ correct: true, score: 1 });
    expect(scoreNL(it, (it.correctIndex + 1) % 5)).toEqual({ correct: false, score: -1 });
    expect(scoreNL(it, null)).toEqual({ correct: null, score: 0 });
  });
  it("detects a genuinely ambiguous sequence", () => {
    // 5, 7, 11, 13, 17: primes from 5 (→ 19) but also primes from 11 minus 6 (→ 23)
    const xs = [5, 7, 11, 13, 17].map((x) => F(x));
    expect(conflicts(xs, F(19), 2).length).toBeGreaterThan(0);
    // 2, 4, 8, 16, 32 → 64 is unambiguous at comparable complexity
    expect(conflicts([2, 4, 8, 16, 32].map((x) => F(x)), F(64), 1)).toEqual([]);
  });
  it("op cycles need two instances of every step", () => {
    const xs = [3, 2, 6, 5, 15].map((x) => F(x)); // −1, ×3 repeating: 4 transitions = 2 per step
    const f = fitAll(xs).filter((x) => x.kind === "cycle");
    expect(f.length).toBe(1);
    expect(f[0].next.eq(14)).toBe(true);
  });
});
