import { describe, expect, it } from "vitest";
import { ExamClock, advanceSequential, initialSequential, nextSequential, remainingMs } from "../clock";

describe("ExamClock", () => {
  it("uses performance deltas and corrects a frozen perf clock while hidden", () => {
    let perf = 1000;
    let wall = 1_000_000;
    const c = new ExamClock(() => perf, () => wall);
    perf += 5000;
    wall += 5000;
    expect(c.now()).toBe(5000);
    c.onHidden();
    // iOS suspends: perf frozen, wall advances 60 s
    wall += 60_000;
    c.onVisible();
    expect(c.now()).toBe(65_000);
  });
  it("does not double count when perf kept running in background", () => {
    let perf = 0;
    let wall = 0;
    const c = new ExamClock(() => perf, () => wall);
    c.onHidden();
    perf += 30_000;
    wall += 30_000;
    c.onVisible();
    expect(c.now()).toBe(30_000);
  });
  it("ignores backwards wall clock jumps", () => {
    let perf = 0;
    let wall = 100_000;
    const c = new ExamClock(() => perf, () => wall);
    c.onHidden();
    perf += 1000;
    wall -= 50_000;
    c.onVisible();
    expect(c.now()).toBe(1000);
  });
  it("pause/resume (training only)", () => {
    let perf = 0;
    const c = new ExamClock(() => perf, () => 0);
    perf = 1000;
    c.pause();
    perf = 5000;
    expect(c.now()).toBe(1000);
    c.resume();
    perf = 6000;
    expect(c.now()).toBe(2000);
  });
});

describe("advanceSequential", () => {
  const t = { perQuestionMs: 90_000, totalMs: 25 * 60_000, count: 30 };
  it("expires one question at a time and starts the next at the expiry instant", () => {
    const s0 = initialSequential();
    const { state, expired } = advanceSequential(s0, 90_000, t);
    expect(expired).toEqual([{ index: 0, at: 90_000 }]);
    expect(state.index).toBe(1);
    expect(state.qStart).toBe(90_000);
  });
  it("catches up multiple expiries after backgrounding", () => {
    const s = nextSequential(initialSequential(), 10_000, t); // q1 starts at 10s
    const r = advanceSequential(s, 10_000 + 90_000 * 3 + 5, t);
    expect(r.expired.map((e) => e.index)).toEqual([1, 2, 3]);
    expect(r.state.index).toBe(4);
    expect(remainingMs(r.state, 10_000 + 90_000 * 3 + 5, t).question).toBe(90_000 - 5);
  });
  it("ends at the total cap", () => {
    const tt = { perQuestionMs: 90_000, totalMs: 100_000, count: 30 };
    const r = advanceSequential(initialSequential(), 120_000, tt);
    expect(r.expired.map((e) => e.index)).toEqual([0]);
    expect(r.state.done).toBe(true);
    expect(r.state.endedBy).toBe("cap");
  });
  it("completes after the last question", () => {
    const tt = { perQuestionMs: 1000, totalMs: null, count: 2 };
    const r = advanceSequential(initialSequential(), 5000, tt);
    expect(r.state.done).toBe(true);
    expect(r.state.endedBy).toBe("complete");
    expect(r.expired.length).toBe(2);
  });
});
