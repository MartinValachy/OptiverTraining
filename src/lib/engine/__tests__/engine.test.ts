import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import type { Attempt, ItemResult, SkillRow } from "@/modules/types";
import { BASE_RATING, chooseDifficulty, expectedScore, familyKey, updateSkill, weakness } from "../elo";
import { buildToday } from "../today";
import { examTrends, familyStats, minutesThisWeek, streak, weakest } from "../stats";
import { buildSchedule, currentWeek, daysUntil } from "../schedule";

const item = (o: Partial<ItemResult>): ItemResult => ({
  id: Math.random().toString(),
  attempt_id: "a",
  module: "bto",
  family: "dice",
  difficulty: 1,
  seed: 1,
  response: null,
  correct: true,
  score: 1,
  ms_taken: 30_000,
  created_at: "2026-10-13T10:00:00.000Z",
  ...o,
});

describe("Elo + adaptive difficulty", () => {
  it("chooses the difficulty whose predicted accuracy is closest to 75%", () => {
    for (const r of [800, 1000, 1150, 1300, 1500, 1700]) {
      const d = chooseDifficulty(r);
      for (const other of [1, 2, 3]) expect(Math.abs(expectedScore(r, d) - 0.75)).toBeLessThanOrEqual(Math.abs(expectedScore(r, other) - 0.75) + 1e-12);
    }
    expect(chooseDifficulty(BASE_RATING)).toBe(1);
    expect(chooseDifficulty(1700)).toBe(3);
  });
  it("rating rises with correct answers and falls with misses", () => {
    const up = updateSkill(undefined, "bto:dice", [item({ correct: true })]);
    const down = updateSkill(undefined, "bto:dice", [item({ correct: false, score: -1 })]);
    expect(up.rating).toBeGreaterThan(BASE_RATING);
    expect(down.rating).toBeLessThan(BASE_RATING);
    expect(up.n).toBe(1);
    expect(new Date(down.next_due!).getTime()).toBeLessThan(new Date(up.next_due!).getTime());
  });
  it("adaptive loop keeps a simulated learner near 70–80% accuracy", () => {
    // learner whose true rating is 1350: P(correct at d) = expectedScore(1350, d)
    const r = makeRng(1);
    let s: SkillRow | undefined;
    let correct = 0;
    let n = 0;
    for (let i = 0; i < 3000; i++) {
      const d = chooseDifficulty(s?.rating ?? BASE_RATING);
      const ok = r.next() < expectedScore(1350, d);
      s = updateSkill(s, "bto:dice", [item({ correct: ok, difficulty: d })]);
      if (i >= 500) {
        n++;
        if (ok) correct++;
      }
    }
    const acc = correct / n;
    expect(acc).toBeGreaterThan(0.65);
    expect(acc).toBeLessThan(0.85);
  });
  it("weak, slow and due families are prioritised", () => {
    const now = new Date("2026-10-13T12:00:00Z");
    const strong: SkillRow = { family: "bto:dice", rating: 1500, n: 40, last_seen: now.toISOString(), next_due: "2026-10-20T00:00:00Z", avg_ms: 20_000 };
    const weak: SkillRow = { family: "bto:coins", rating: 900, n: 10, last_seen: now.toISOString(), next_due: "2026-10-12T00:00:00Z", avg_ms: 20_000 };
    const slow: SkillRow = { ...strong, family: "bto:cards", avg_ms: 200_000 };
    expect(weakness(weak, now)).toBeGreaterThan(weakness(strong, now));
    expect(weakness(slow, now)).toBeGreaterThan(weakness(strong, now));
    expect(weakness(undefined, now)).toBeGreaterThan(weakness(strong, now));
  });
});

describe("Today session", () => {
  it("prefers weak and new families over strong ones", () => {
    const now = new Date("2026-10-13T12:00:00Z");
    const skills: SkillRow[] = [];
    // every BTO family strong except coins
    for (const f of ["dice", "coins", "cards", "urns", "birthday", "bayes", "waiting", "ev", "ruin", "walk", "markov", "linearity", "martingale", "divergent"])
      skills.push({ family: familyKey("bto", f), rating: f === "coins" ? 850 : 1600, n: 30, last_seen: now.toISOString(), next_due: "2026-11-01T00:00:00Z", avg_ms: 20_000 });
    const blocks = buildToday(skills, now, makeRng(1), { families: 8 });
    const fams = blocks.flatMap((b) => b.families.map((f) => `${f.module}:${f.family}`));
    expect(fams.length).toBe(8);
    expect(fams).toContain("bto:coins");
    expect(fams.filter((f) => f.startsWith("bto:") && f !== "bto:coins").length).toBe(0); // strong BTO families wait
    expect(blocks.every((b) => b.count === b.families.length * 3)).toBe(true);
  });
});

describe("Dashboard stats", () => {
  const att = (o: Partial<Attempt>): Attempt => ({ id: Math.random().toString(), module: "bto", mode: "exam", config: {}, started_at: "", finished_at: "2026-10-13T10:00:00.000Z", score: 10, max_score: 20, ...o });
  it("exam trends as percentages", () => {
    const t = examTrends([att({}), att({ mode: "training" }), att({ module: "numberlogic", score: 13, max_score: 26 })]);
    expect(t.bto).toEqual([{ date: "2026-10-13", pct: 50, score: 10, max: 20 }]);
    expect(t.numberlogic[0].pct).toBe(50);
  });
  it("streak counts consecutive local days", () => {
    const now = new Date(2026, 9, 13, 18);
    const a = [11, 12, 13].map((d) => att({ finished_at: new Date(2026, 9, d, 9).toISOString() }));
    expect(streak(a, now)).toBe(3);
    expect(streak(a.slice(0, 2), now)).toBe(2); // nothing yet today: count up to yesterday
    expect(streak([att({ finished_at: new Date(2026, 9, 9).toISOString() })], now)).toBe(0);
  });
  it("minutes this week", () => {
    const now = new Date(2026, 9, 14, 12); // Wednesday
    const items = [item({ created_at: new Date(2026, 9, 13).toISOString(), ms_taken: 120_000 }), item({ created_at: new Date(2026, 9, 5).toISOString(), ms_taken: 600_000 })];
    const zap = att({ module: "zapn", finished_at: new Date(2026, 9, 14).toISOString(), config: { sessionSec: 180 } });
    expect(minutesThisWeek(items, [zap], now)).toBe(5);
  });
  it("family stats and weakest", () => {
    const items = [item({ correct: true }), item({ correct: false }), item({ correct: null, ms_taken: 90_000 })];
    const fs = familyStats(items, [{ family: "bto:dice", rating: 1100, n: 3, last_seen: null, next_due: null }]);
    expect(fs[0].accuracy).toBe(0.5);
    expect(fs[0].speed).toBeCloseTo(30_000 / 60_000, 6); // the skipped 90 s item is ignored
    const w = weakest([
      { family: "bto:a", rating: 1400, n: 5, last_seen: null, next_due: null },
      { family: "bto:b", rating: 900, n: 5, last_seen: null, next_due: null },
    ]);
    expect(w[0].family).toBe("bto:b");
  });
});

describe("Plan schedule", () => {
  it("7 weeks to 30 Nov: 3 training, 3 mixed, 1 mock", () => {
    const w = buildSchedule("2026-10-13", "2026-11-30");
    expect(w.length).toBe(7);
    expect(w.map((x) => x.phase)).toEqual(["training", "training", "training", "mixed", "mixed", "mixed", "mock"]);
    expect(w[6].end).toBe("2026-11-30");
    expect(currentWeek(w, new Date(2026, 9, 20))?.index).toBe(2);
    expect(daysUntil("2026-11-30", new Date(2026, 9, 13, 15))).toBe(48);
  });
  it("short runs still end with a mock week", () => {
    const w = buildSchedule("2026-11-20", "2026-11-30");
    expect(w[w.length - 1].phase).toBe("mock");
  });
});
