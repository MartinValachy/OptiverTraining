import { describe, expect, it } from "vitest";
import { DIFFICULTIES } from "@/modules/types";
import { OB_FAMILIES, checkResponse, generateOB, scoreOB, type OBItem } from "../generate";
import { compKey, evaluate, isArb, isNoArbCertificate, solve, type Board } from "../solver";

const N = 1000;

/** Naive independent check: does any plan with |x_k| ≤ 1 make money? Returns min level found. */
function naiveUnitLevel(item: OBItem): number | null {
  const n = item.cards.length;
  let best: number | null = null;
  const total = 3 ** n;
  for (let code = 1; code < total; code++) {
    const x: number[] = [];
    let c = code;
    for (let k = 0; k < n; k++) {
      x.push((c % 3) - 1);
      c = Math.floor(c / 3);
    }
    const inv = new Array(item.items.length).fill(0);
    let cash = 0;
    x.forEach((v, k) => {
      if (!v) return;
      for (const [i, q] of item.cards[k].comp) inv[i] += v * q;
      cash += v > 0 ? -item.cards[k].buy : item.cards[k].sell;
    });
    if (inv.some((v) => v !== 0) || cash <= 0) continue;
    const used = x.map((v, k) => [v, k]).filter(([v]) => v);
    const lvl = used.length === 2 && compKey(item.cards[used[0][1]]) === compKey(item.cards[used[1][1]]) ? 1 : 2;
    best = best === null ? lvl : Math.min(best, lvl);
  }
  return best;
}

/** Full brute force over x ∈ [−4, 4]^n (small boards only): min clicks of any arbitrage. */
function naiveMinClicks(item: OBItem): number | null {
  const n = item.cards.length;
  let best: number | null = null;
  const x = new Array(n).fill(0);
  const rec = (k: number) => {
    if (k === n) {
      const board: Board = { nItems: item.items.length, cards: item.cards };
      if (isArb(board, x)) {
        const c = x.reduce((a, v) => a + Math.abs(v), 0);
        best = best === null ? c : Math.min(best, c);
      }
      return;
    }
    for (let v = -4; v <= 4; v++) {
      x[k] = v;
      rec(k + 1);
    }
    x[k] = 0;
  };
  rec(0);
  return best;
}

for (const fam of OB_FAMILIES) {
  describe(`Orderbooks ${fam.id}`, () => {
    for (const d of DIFFICULTIES) {
      it(`difficulty ${d}: ${N} boards, solver proves the arbitrage and its phase`, () => {
        let brute = 0;
        for (let seed = 0; seed < N; seed++) {
          const it = generateOB(fam.id, d, seed);
          const tag = `${fam.id}/${d}/${seed}`;
          const board: Board = { nItems: it.items.length, cards: it.cards };
          for (const c of it.cards) {
            expect(c.sell > 0 && c.buy > c.sell, tag).toBe(true);
            for (const [i, q] of c.comp) expect(i >= 0 && i < it.items.length && q >= 1, tag).toBe(true);
          }
          expect(new Set(it.items).size, tag).toBe(it.items.length);
          if (fam.id === "none") {
            expect(it.hasArb).toBe(false);
            expect(isNoArbCertificate(board, it.fair), tag).toBe(true);
            expect(solve(board).simplest, tag).toBeNull();
            expect(naiveUnitLevel(it), tag).toBeNull();
            expect(scoreOB(it, { buys: [], sells: [], noarb: true }).score).toBe(1);
            continue;
          }
          const phase = fam.id === "direct" ? 1 : fam.id === "bundle" ? 2 : 3;
          // (f) the solver finds an arbitrage and the declared simplest plan is valid
          expect(it.simplest, tag).not.toBeNull();
          const plan = it.simplest!;
          expect(isArb(board, plan.x), tag).toBe(true);
          expect(evaluate(board, plan.x).cash, tag).toBe(plan.profit);
          expect(plan.level, tag).toBe(phase);
          expect(Math.max(...plan.x.map(Math.abs)) <= 4, tag).toBe(true);
          // independent check of the phase: no simpler arbitrage exists
          const unit = naiveUnitLevel(it);
          if (phase === 3) expect(unit, tag).toBeNull();
          else expect(unit, tag).toBe(phase);
          // the plan scores as a valid submission
          const buys = plan.x.map((v) => Math.max(0, v));
          const sells = plan.x.map((v) => Math.max(0, -v));
          expect(scoreOB(it, { buys, sells }), tag).toEqual({ correct: true, score: 1 });
          expect(checkResponse(it, { buys: [], sells: [], noarb: true }).valid).toBe(false);
          // full brute force on small boards: the declared plan has the minimum number of clicks for its level
          if (phase === 3 && it.cards.length <= 5 && brute < 40) {
            brute++;
            expect(naiveMinClicks(it), tag).toBe(plan.clicks);
          }
        }
      });
    }
  });
}

describe("Orderbooks submit validation", () => {
  const ob = generateOB("direct", 1, 7);
  const n = ob.cards.length;
  it("non-zero inventory is rejected with an error (costs time, not points)", () => {
    const buys = new Array(n).fill(0);
    buys[0] = 1;
    const c = checkResponse(ob, { buys, sells: new Array(n).fill(0) });
    expect(c.valid).toBe(false);
    expect(c.error).toMatch(/net to zero/);
  });
  it("flat inventory with non-positive cash is rejected", () => {
    const buys = new Array(n).fill(0);
    const sells = new Array(n).fill(0);
    buys[0] = 1;
    sells[0] = 1; // buy and sell the same card: loses the spread
    const c = checkResponse(ob, { buys, sells });
    expect(c.valid).toBe(false);
    expect(c.error).toMatch(/positive profit/);
  });
  it("any valid arbitrage scores 1 regardless of size", () => {
    const x = ob.simplest!.x;
    const buys = x.map((v) => Math.max(0, v) * 2);
    const sells = x.map((v) => Math.max(0, -v) * 2);
    expect(scoreOB(ob, { buys, sells }).score).toBe(1);
  });
  it("empty submission and skip", () => {
    expect(checkResponse(ob, { buys: new Array(n).fill(0), sells: new Array(n).fill(0) }).error).toMatch(/Stage/);
    expect(scoreOB(ob, null)).toEqual({ correct: null, score: 0 });
  });
  it("'No opportunity' on a board with an arbitrage is an error", () => {
    expect(checkResponse(ob, { buys: [], sells: [], noarb: true }).error).toMatch(/opportunity/);
  });
});

import { planOrderbooks } from "../module";

describe("Orderbooks exam plan", () => {
  it("ramps direct → bundle → ratio across 20 boards", () => {
    const p = planOrderbooks(20, 1, { noArbShare: 0 });
    const phase = (f: string) => ["direct", "bundle", "ratio"].indexOf(f);
    for (let i = 1; i < p.length; i++) expect(phase(p[i].family)).toBeGreaterThanOrEqual(phase(p[i - 1].family));
    expect(p[0].family).toBe("direct");
    expect(p[19].family).toBe("ratio");
    expect(p.some((k) => k.family === "none")).toBe(false);
  });
  it("mixes in no-opportunity boards when enabled", () => {
    let none = 0;
    for (let s = 0; s < 50; s++) none += planOrderbooks(20, s, { noArbShare: 0.2 }).filter((k) => k.family === "none").length;
    expect(none / 1000).toBeGreaterThan(0.12);
    expect(none / 1000).toBeLessThan(0.28);
  });
});
