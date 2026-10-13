// Elo-style skill per family, adaptive difficulty targeting ~75% accuracy, and spaced repetition.

import type { Difficulty, ItemResult, ModuleId, SkillRow } from "@/modules/types";

export const BASE_RATING = 1000;
export const TARGET_ACCURACY = 0.75;

/** Item rating for each difficulty level. */
export function itemRating(d: number): number {
  return 850 + 150 * d;
}

export function expectedScore(rating: number, d: number): number {
  return 1 / (1 + 10 ** ((itemRating(d) - rating) / 400));
}

/** Difficulty whose predicted accuracy is closest to the target band (70-80%). */
export function chooseDifficulty(rating: number): Difficulty {
  let best: Difficulty = 1;
  let bestGap = Infinity;
  for (const d of [1, 2, 3] as Difficulty[]) {
    const gap = Math.abs(expectedScore(rating, d) - TARGET_ACCURACY);
    if (gap < bestGap - 1e-9) {
      best = d;
      bestGap = gap;
    }
  }
  return best;
}

/** Target seconds per item, used to flag "slow" families. */
export const TARGET_MS: Record<ModuleId, number> = {
  bto: 60_000,
  numberlogic: 45_000,
  likelihood: 60_000,
  intervals: 40_000,
  orderbooks: 20_000,
  zapn: 60_000,
  warmup: 6_000,
};

export function familyKey(module: ModuleId, family: string): string {
  return `${module}:${family}`;
}

export function moduleOfKey(key: string): ModuleId {
  return key.split(":")[0] as ModuleId;
}

/** Map an item result to an outcome in [0, 1]. */
export function outcome(r: Pick<ItemResult, "module" | "correct" | "score">): number {
  if (r.module === "intervals") return r.correct ? Math.min(1, Math.max(0, r.score) / 0.75) : 0;
  return r.correct ? 1 : 0;
}

const DAY = 86_400_000;

export function updateSkill(prev: SkillRow | undefined, key: string, results: Pick<ItemResult, "module" | "correct" | "score" | "difficulty" | "ms_taken">[], now = new Date()): SkillRow {
  let rating = prev?.rating ?? BASE_RATING;
  let n = prev?.n ?? 0;
  let avg = prev?.avg_ms ?? 0;
  let sumS = 0;
  for (const r of results) {
    const s = outcome(r);
    sumS += s;
    const k = n < 20 ? 40 : 20;
    rating += k * (s - expectedScore(rating, r.difficulty));
    avg = n === 0 ? r.ms_taken : 0.8 * avg + 0.2 * r.ms_taken;
    n++;
  }
  const mod = moduleOfKey(key);
  const slow = avg > TARGET_MS[mod] * 1.2;
  const recent = results.length ? sumS / results.length : 1;
  let days = rating < 1050 ? 1 : rating < 1200 ? 2 : rating < 1350 ? 4 : 7;
  if (slow) days = Math.max(1, Math.floor(days / 2));
  if (recent < 0.5) days = 0.5;
  return {
    family: key,
    rating: Math.round(rating * 10) / 10,
    n,
    last_seen: now.toISOString(),
    next_due: new Date(now.getTime() + days * DAY).toISOString(),
    avg_ms: Math.round(avg),
  };
}

/** Weakness score: higher = schedule more often. */
export function weakness(s: SkillRow | undefined, now = new Date()): number {
  if (!s) return 1.5; // never practised: high priority
  const mod = moduleOfKey(s.family);
  let w = (1300 - s.rating) / 200;
  if ((s.avg_ms ?? 0) > TARGET_MS[mod] * 1.2) w += 0.5;
  if (s.next_due && new Date(s.next_due) <= now) w += 1;
  return w;
}
