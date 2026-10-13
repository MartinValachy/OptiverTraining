import { describe, expect, it } from "vitest";
import { itemRng, makeRng, mulberry32 } from "../rng";

describe("rng", () => {
  it("mulberry32 is deterministic", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it("itemRng reproduces from (module, family, difficulty, seed)", () => {
    const x = itemRng("bto", "dice", 2, 123);
    const y = itemRng("bto", "dice", 2, 123);
    const z = itemRng("bto", "dice", 3, 123);
    const xs = Array.from({ length: 10 }, () => x.int(0, 1e6));
    expect(Array.from({ length: 10 }, () => y.int(0, 1e6))).toEqual(xs);
    expect(Array.from({ length: 10 }, () => z.int(0, 1e6))).not.toEqual(xs);
  });
  it("int is uniform and inclusive", () => {
    const r = makeRng(7);
    const counts = new Array(6).fill(0);
    for (let i = 0; i < 60000; i++) counts[r.int(1, 6) - 1]++;
    for (const c of counts) expect(Math.abs(c - 10000)).toBeLessThan(400);
  });
  it("normal has mean 0, sd 1", () => {
    const r = makeRng(9);
    let s = 0;
    let s2 = 0;
    const n = 100000;
    for (let i = 0; i < n; i++) {
      const x = r.normal();
      s += x;
      s2 += x * x;
    }
    expect(Math.abs(s / n)).toBeLessThan(0.02);
    expect(Math.abs(s2 / n - 1)).toBeLessThan(0.02);
  });
});
