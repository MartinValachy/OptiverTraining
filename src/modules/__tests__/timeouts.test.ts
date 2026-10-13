import { describe, expect, it } from "vitest";
import { btoModule } from "../bto/module";
import { likelihoodModule } from "../likelihood/module";
import { intervalsModule } from "../intervals/module";
import { orderbooksModule } from "../orderbooks/module";

describe("per-question timeout policies", () => {
  it("BTO: a selected but unsubmitted option is a skip (0), never ±1", () => {
    const item = btoModule.generate("dice", 1, 1);
    for (const sel of [item.correctIndex, (item.correctIndex + 1) % 5]) {
      const r = btoModule.onTimeout!(sel, item);
      expect(r).toBeNull();
      expect(btoModule.score(item, r)).toEqual({ correct: null, score: 0 });
    }
  });
  it("Likelihood-list: the current arrangement is submitted", () => {
    const item = likelihoodModule.generate("table", 1, 2);
    expect(likelihoodModule.onTimeout!(item.correctOrder, item)).toEqual(item.correctOrder);
    expect(likelihoodModule.score(item, likelihoodModule.onTimeout!(item.correctOrder, item)).score).toBe(1);
    expect(likelihoodModule.onTimeout!(null, item)).toEqual([0, 1, 2]);
  });
  it("Intervals: a valid typed interval is submitted, an invalid one scores 0", () => {
    const item = intervalsModule.generate("fermi", 1, 3);
    const t = String(item.truthExact);
    expect(intervalsModule.onTimeout!({ lower: t, upper: t }, item)).toEqual({ lower: t, upper: t });
    expect(intervalsModule.score(item, intervalsModule.onTimeout!({ lower: t, upper: t }, item)).score).toBe(1);
    expect(intervalsModule.onTimeout!({ lower: "9", upper: "1" }, item)).toBeNull();
    expect(intervalsModule.onTimeout!({ lower: "", upper: "" }, item)).toBeNull();
  });
  it("Orderbooks: staged but unsubmitted trades do not count when the clock runs out", () => {
    const item = orderbooksModule.generate("direct", 1, 4);
    const x = item.simplest!.x;
    const staged = { buys: x.map((v) => Math.max(0, v)), sells: x.map((v) => Math.max(0, -v)) };
    expect(orderbooksModule.onTimeout!(staged, item)).toBeNull();
    expect(orderbooksModule.validate!(staged, item)).toBeNull();
    expect(orderbooksModule.score(item, staged).score).toBe(1);
  });
});
