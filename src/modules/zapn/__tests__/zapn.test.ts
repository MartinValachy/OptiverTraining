import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import {
  allCodes,
  angleDiff,
  balloonEV,
  balloonOptimalStop,
  balloonPopPoint,
  checkNumberBox,
  codePair,
  consistentCount,
  dialHit,
  evalExpression,
  grillStatus,
  grillTap,
  heights,
  mmFeedback,
  nextWindow,
  numberPuzzle,
  pinNextLength,
  rtStats,
  shapeSequence,
  solveNumbers,
  switchAnswer,
  switchCost,
  switchTrials,
  towerLevel,
  towerSolve,
} from "../logic";
import { PARAMS } from "../config";

describe("Balloon", () => {
  it("optimal stop for uniform pop points is M/2", () => {
    expect(balloonOptimalStop(64).k).toBe(32);
    expect(balloonOptimalStop(16).k).toBe(8);
  });
  it("EV formula matches simulation", () => {
    const r = makeRng(1);
    for (const [M, k] of [
      [64, 20],
      [16, 8],
      [16, 12],
    ]) {
      let s = 0;
      const n = 200_000;
      for (let i = 0; i < n; i++) s += balloonPopPoint(r, M) > k ? k : 0;
      expect(Math.abs(s / n - balloonEV(k, M, 1))).toBeLessThan(0.05 * k);
    }
  });
});

describe("Pincode / CodeCompare", () => {
  it("staircase", () => {
    expect(pinNextLength(5, true, 3)).toBe(6);
    expect(pinNextLength(5, false, 3)).toBe(4);
    expect(pinNextLength(3, false, 3)).toBe(3);
  });
  it("code pairs are labelled correctly", () => {
    const r = makeRng(2);
    for (let i = 0; i < 2000; i++) {
      const p = codePair(r, 6, 0.5);
      expect(p.a === p.b).toBe(p.same);
      expect(p.a.length).toBe(p.b.length);
    }
  });
  it("decision window shrinks toward the floor", () => {
    let w = PARAMS.codecompare.startWindowMs;
    for (let i = 0; i < 100; i++) w = nextWindow(w, true, PARAMS.codecompare);
    expect(w).toBe(500);
    expect(nextWindow(500, false, PARAMS.codecompare)).toBeGreaterThan(500);
  });
});

describe("The Switch", () => {
  it("answers and switch cost", () => {
    expect(switchAnswer({ rule: "number", n: 3, arrow: "right", switched: false })).toBe("left");
    expect(switchAnswer({ rule: "number", n: 4, arrow: "left", switched: false })).toBe("right");
    expect(switchAnswer({ rule: "arrow", n: 4, arrow: "left", switched: false })).toBe("left");
    const t = switchTrials(makeRng(3), 64, true, 0.5);
    expect(t.filter((x) => x.switched).length).toBeGreaterThan(15);
    for (let i = 1; i < t.length; i++) expect(t[i].switched).toBe(t[i].rule !== t[i - 1].rule);
    const res = t.map((x) => ({ correct: true, rt: x.switched ? 700 : 500 }));
    expect(switchCost(t, res).cost).toBeCloseTo(200, 6);
  });
});

describe("NumberBox", () => {
  it("solver finds famous solutions and rejects impossible sets", () => {
    expect(solveNumbers([3, 3, 8, 8], 24)).not.toBeNull();
    expect(solveNumbers([1, 1, 1, 1], 24)).toBeNull();
    expect(solveNumbers([1, 1, 1, 2], 24)).toBeNull();
    expect(solveNumbers([4, 7, 8, 8], 24)).not.toBeNull();
  });
  it("every generated puzzle is solvable and the shown solution checks out (independent parser)", () => {
    const r = makeRng(4);
    for (let i = 0; i < 1000; i++) {
      const p = numberPuzzle(r, PARAMS.numberbox.targets, 1, 13);
      expect(checkNumberBox(p.solution, p.nums, p.target).ok, `${p.nums} → ${p.target}: ${p.solution}`).toBe(true);
    }
  });
  it("expression parser", () => {
    expect(evalExpression("(1 + 2) × 3")!.value.toString()).toBe("9");
    expect(evalExpression("1 + 2 × 3")!.value.toString()).toBe("7");
    expect(evalExpression("8 ÷ (3 − 8 ÷ 3)")!.value.toString()).toBe("24");
    expect(evalExpression("1 +")).toBeNull();
    expect(evalExpression("4 ÷ (2 − 2)")).toBeNull();
    expect(checkNumberBox("3 × 8", [3, 8, 1, 1], 24).ok).toBe(false);
  });
});

describe("Skyscraper", () => {
  it("BFS solutions are valid and reach the targets", () => {
    const r = makeRng(5);
    for (let i = 0; i < 200; i++) {
      const lv = towerLevel(r, 3 + (i % 4));
      const p = lv.start.map((s) => s.slice());
      for (const [a, b] of lv.optimal) {
        expect(p[a].length).toBeGreaterThan(0);
        p[b].push(p[a].pop()!);
      }
      expect(heights(p)).toEqual(lv.target);
      // optimality: no shorter solution via BFS bounded by length - 1
      if (lv.optimal.length > 0) expect(towerSolve(lv.start, lv.target, lv.optimal.length - 1)).toBeNull();
    }
  });
});

describe("Shapeshift / Grill / Pattern / Dial / stats", () => {
  it("shape sequence repeat rate", () => {
    const s = shapeSequence(makeRng(6), 5000, 0.5);
    let same = 0;
    for (let i = 1; i < s.length; i++) if (s[i] === s[i - 1]) same++;
    expect(same / (s.length - 1)).toBeGreaterThan(0.46);
    expect(same / (s.length - 1)).toBeLessThan(0.54);
  });
  it("grill timeline: place → flip window → serve window → burnt", () => {
    const p = PARAMS.grill;
    const empty = { item: null, start: 0, flipped: false, flippedAt: 0 };
    const placed = grillTap(empty, 0, p, 1);
    expect(placed.event).toBe("placed");
    const cook = p.items[1].cookMs;
    expect(grillStatus(placed.slot, 1000, p)).toBe("cooking");
    expect(grillTap(placed.slot, 1000, p, null).event).toBe("early");
    expect(grillStatus(placed.slot, cook / 2, p)).toBe("flip");
    const flipped = grillTap(placed.slot, cook / 2, p, null);
    expect(flipped.event).toBe("flipped");
    expect(grillStatus(flipped.slot, cook, p)).toBe("serve");
    expect(grillTap(flipped.slot, cook, p, null).event).toBe("served");
    expect(grillStatus(flipped.slot, cook + p.windowMs + 1, p)).toBe("burnt");
    expect(grillStatus(placed.slot, cook / 2 + p.windowMs + 1, p)).toBe("burnt");
  });
  it("mastermind feedback", () => {
    expect(mmFeedback([0, 1, 2, 3], [0, 1, 2, 3])).toEqual({ exact: 4, partial: 0 });
    expect(mmFeedback([0, 1, 2, 3], [3, 2, 1, 0])).toEqual({ exact: 0, partial: 4 });
    expect(mmFeedback([0, 0, 1, 1], [0, 1, 0, 2])).toEqual({ exact: 1, partial: 2 });
    expect(mmFeedback([1, 1, 1, 1], [1, 2, 2, 2])).toEqual({ exact: 1, partial: 0 });
    expect(allCodes(4, 6).length).toBe(1296);
    const code = [2, 4, 4, 1];
    const g = [0, 4, 1, 1];
    const h = [{ guess: g, ...mmFeedback(code, g) }];
    const n = consistentCount(h, 4, 6);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(1296);
  });
  it("dial wraparound", () => {
    expect(angleDiff(359, 1)).toBe(-2);
    expect(angleDiff(1, 359)).toBe(2);
    expect(dialHit(5, 355, 30).hit).toBe(true);
    expect(dialHit(20, 355, 30).hit).toBe(false);
  });
  it("rt stats", () => {
    const s = rtStats([100, 200, 300, 400]);
    expect(s.mean).toBe(250);
    expect(s.median).toBe(250);
    expect(s.sd).toBeCloseTo(129.099, 2);
  });
});
