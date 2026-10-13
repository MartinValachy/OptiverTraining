import { describe, expect, it } from "vitest";
import { checkWarmup, generateWarmup, WARMUP_FAMILIES } from "../logic";
import { Fraction } from "@/lib/fraction";
import { DIFFICULTIES } from "@/modules/types";

describe("warm-up", () => {
  it("answer keys are exact and self-consistent", () => {
    for (const f of WARMUP_FAMILIES)
      for (const d of DIFFICULTIES)
        for (let seed = 0; seed < 1000; seed++) {
          const it = generateWarmup(f.id, d, seed);
          // the displayed answer is accepted
          expect(checkWarmup(it, it.display), `${f.id} ${d} ${seed} ${it.prompt}`).toBe(true);
          // independent recomputation for integer / decimal ops
          const m = /^(-?[\d.]+) ([+−×÷]) (-?[\d.]+)$/.exec(it.prompt);
          if (m) {
            const a = Fraction.parse(m[1]);
            const b = Fraction.parse(m[3]);
            const v = m[2] === "+" ? a.add(b) : m[2] === "−" ? a.sub(b) : m[2] === "×" ? a.mul(b) : a.div(b);
            expect(v.toString()).toBe(it.answer);
          }
        }
  });
  it("blank is skipped, wrong is wrong", () => {
    const it = generateWarmup("int", 1, 1);
    expect(checkWarmup(it, "")).toBeNull();
    expect(checkWarmup(it, "abc")).toBe(false);
    expect(checkWarmup(it, String(Number(it.display) + 1))).toBe(false);
  });
  it("fractions must be in lowest terms", () => {
    for (let s = 0; s < 200; s++) {
      const it = generateWarmup("frac", 1, s);
      if (it.format !== "fraction") continue;
      const f = Fraction.parse(it.answer);
      expect(checkWarmup(it, `${f.n * 2n}/${f.d * 2n}`)).toBe(false);
      expect(checkWarmup(it, `${f.n}/${f.d}`)).toBe(true);
      return;
    }
  });
});
