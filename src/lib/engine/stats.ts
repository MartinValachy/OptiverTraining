// Dashboard statistics (pure).

import type { Attempt, ItemResult, ModuleId, SkillRow } from "@/modules/types";
import { localDay } from "@/lib/ids";
import { TARGET_MS, familyKey, moduleOfKey, weakness } from "./elo";

export interface TrendPoint {
  date: string;
  pct: number;
  score: number;
  max: number;
}

/** Exam-mode scores over time per module, as a percentage of the maximum. */
export function examTrends(attempts: Attempt[]): Record<string, TrendPoint[]> {
  const out: Record<string, TrendPoint[]> = {};
  for (const a of [...attempts].sort((x, y) => x.finished_at.localeCompare(y.finished_at))) {
    if (a.mode !== "exam" || a.module === "zapn" || a.module === "mock" || !a.max_score) continue;
    (out[a.module] ??= []).push({ date: a.finished_at.slice(0, 10), pct: Math.round((1000 * a.score) / a.max_score) / 10, score: a.score, max: a.max_score });
  }
  return out;
}

export interface FamilyStat {
  key: string;
  module: ModuleId;
  family: string;
  n: number;
  accuracy: number | null;
  /** mean ms / target ms (1 = on pace, > 1 slow) */
  speed: number | null;
  avgMs: number | null;
  rating: number | null;
}

/** Accuracy and speed per family over the most recent `window` answered items. */
export function familyStats(items: ItemResult[], skills: SkillRow[], window = 30): FamilyStat[] {
  const by = new Map<string, ItemResult[]>();
  for (const it of [...items].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    if (it.module === "zapn") continue;
    const k = familyKey(it.module, it.family);
    if (!by.has(k)) by.set(k, []);
    by.get(k)!.push(it);
  }
  const sk = new Map(skills.map((s) => [s.family, s]));
  return [...by].map(([key, list]) => {
    const recent = list.slice(-window);
    const answered = recent.filter((r) => r.correct !== null);
    const mod = moduleOfKey(key);
    // skipped items say nothing about speed
    const avgMs = answered.length ? answered.reduce((a, r) => a + r.ms_taken, 0) / answered.length : null;
    return {
      key,
      module: mod,
      family: key.slice(mod.length + 1),
      n: list.length,
      accuracy: answered.length ? answered.filter((r) => r.correct).length / answered.length : null,
      speed: avgMs === null ? null : avgMs / TARGET_MS[mod],
      avgMs,
      rating: sk.get(key)?.rating ?? null,
    };
  });
}

export function weakest(skills: SkillRow[], k = 5, now = new Date()): SkillRow[] {
  return skills
    .filter((s) => s.n > 0 && !s.family.startsWith("zapn:"))
    .sort((a, b) => weakness(b, now) - weakness(a, now))
    .slice(0, k);
}

/** Consecutive days (ending today, or yesterday if nothing yet today) with at least one attempt. */
export function streak(attempts: Attempt[], now = new Date()): number {
  const days = new Set(attempts.map((a) => localDay(a.finished_at)));
  const d = new Date(now);
  if (!days.has(localDay(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(localDay(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function startOfWeek(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return d;
}

/** Minutes trained since Monday: item time plus Zap-N session time. */
export function minutesThisWeek(items: ItemResult[], attempts: Attempt[], now = new Date()): number {
  const from = startOfWeek(now).getTime();
  let ms = 0;
  for (const it of items) if (new Date(it.created_at).getTime() >= from && it.module !== "zapn") ms += it.ms_taken;
  for (const a of attempts)
    if (a.module === "zapn" && new Date(a.finished_at).getTime() >= from) ms += Number((a.config as { sessionSec?: number }).sessionSec ?? 0) * 1000;
  return Math.round(ms / 60_000);
}
