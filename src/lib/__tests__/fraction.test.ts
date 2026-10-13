import { describe, expect, it } from "vitest";
import { Fraction, F, fsum } from "../fraction";

describe("Fraction", () => {
  it("normalises sign and gcd", () => {
    const f = new Fraction(6, -8);
    expect(f.n).toBe(-3n);
    expect(f.d).toBe(4n);
    expect(f.toString()).toBe("-3/4");
  });
  it("arithmetic is exact", () => {
    expect(F(1, 3).add(F(1, 6)).toString()).toBe("1/2");
    expect(F(1, 3).sub(F(1, 2)).toString()).toBe("-1/6");
    expect(F(2, 3).mul(F(9, 4)).toString()).toBe("3/2");
    expect(F(2, 3).div(F(4, 9)).toString()).toBe("3/2");
    expect(F(2, 3).pow(3).toString()).toBe("8/27");
    expect(F(2, 3).pow(-2).toString()).toBe("9/4");
    expect(fsum([F(1, 2), F(1, 3), F(1, 6)]).eq(1)).toBe(true);
  });
  it("parses decimals and fractions", () => {
    expect(Fraction.parse("0.125").toString()).toBe("1/8");
    expect(Fraction.parse("-3/12").toString()).toBe("-1/4");
    expect(Fraction.parse("1e-3").toString()).toBe("1/1000");
    expect(Fraction.parse(".5").toString()).toBe("1/2");
    expect(() => Fraction.parse("abc")).toThrow();
  });
  it("compares and converts big values accurately", () => {
    const big = new Fraction(10n ** 40n + 1n, 3n * 10n ** 40n);
    expect(big.toNumber()).toBeCloseTo(1 / 3, 15);
    expect(F(1, 3).lt(F(1, 2))).toBe(true);
    expect(F(-7, 2).floor()).toBe(-4n);
    expect(() => F(1, 0)).toThrow();
  });
});
