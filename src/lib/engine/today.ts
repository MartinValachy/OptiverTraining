// Daily "Today" session: spaced repetition of weak, slow, due or never-practised families.

import type { Rng } from "@/lib/rng";
import type { SkillRow } from "@/modules/types";
import { CATALOG, type QuestionModuleId } from "./catalog";
import { familyKey, weakness, TARGET_MS } from "./elo";

export interface TodayFamily {
  module: QuestionModuleId;
  family: string;
  reason: "new" | "due" | "weak" | "slow" | "maintenance";
  weight: number;
}

export interface TodayBlock {
  module: QuestionModuleId;
  families: TodayFamily[];
  count: number;
}

export function reasonFor(s: SkillRow | undefined, now: Date): TodayFamily["reason"] {
  if (!s || s.n === 0) return "new";
  if (s.rating < 1050) return "weak";
  const mod = s.family.split(":")[0] as QuestionModuleId;
  if ((s.avg_ms ?? 0) > TARGET_MS[mod] * 1.2) return "slow";
  if (s.next_due && new Date(s.next_due) <= now) return "due";
  return "maintenance";
}

/**
 * Pick the families to practise today. Weaker, slower and overdue families get higher weight;
 * the warm-up is optional and only included when it is itself weak.
 */
export function buildToday(skills: SkillRow[], now: Date, rng: Rng, opts: { families?: number; perFamily?: number; includeWarmup?: boolean } = {}): TodayBlock[] {
  const nFam = opts.families ?? 8;
  const per = opts.perFamily ?? 3;
  const map = new Map(skills.map((s) => [s.family, s]));
  const all: TodayFamily[] = [];
  for (const c of CATALOG) {
    if (c.module === "warmup" && !opts.includeWarmup) continue;
    for (const f of c.families) {
      if (c.module === "orderbooks" && f.id === "none") continue;
      const s = map.get(familyKey(c.module, f.id));
      // jitter breaks ties so new families are introduced in a varied order
      all.push({ module: c.module, family: f.id, reason: reasonFor(s, now), weight: weakness(s, now) + rng.next() * 0.3 });
    }
  }
  // not-yet-due healthy families are only picked if nothing else is left
  all.sort((a, b) => b.weight - a.weight);
  const chosen = all.slice(0, nFam);
  const blocks: TodayBlock[] = [];
  for (const c of CATALOG) {
    const fams = chosen.filter((x) => x.module === c.module);
    if (fams.length) blocks.push({ module: c.module, families: fams, count: fams.length * per });
  }
  return blocks;
}
