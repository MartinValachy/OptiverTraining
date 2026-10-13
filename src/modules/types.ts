export type ModuleId = "bto" | "numberlogic" | "likelihood" | "intervals" | "orderbooks" | "zapn" | "warmup";
export type Mode = "exam" | "training";
export type Difficulty = 1 | 2 | 3;
export const DIFFICULTIES: Difficulty[] = [1, 2, 3];

export interface ItemKey {
  module: ModuleId;
  family: string;
  difficulty: Difficulty;
  seed: number;
}

export interface FamilyInfo {
  id: string;
  name: string;
  blurb?: string;
}

export interface Attempt {
  id: string;
  module: ModuleId;
  mode: Mode;
  config: Record<string, unknown>;
  started_at: string;
  finished_at: string;
  score: number;
  max_score: number;
  /** extra summary (e.g. Zap-N RT stats, mock battery id) */
  meta?: Record<string, unknown>;
}

export interface ItemResult {
  id: string;
  attempt_id: string;
  module: ModuleId;
  family: string;
  difficulty: number;
  seed: number;
  response: unknown;
  /** null = skipped / unanswered */
  correct: boolean | null;
  score: number;
  ms_taken: number;
  created_at: string;
}

export interface SkillRow {
  family: string;
  rating: number;
  n: number;
  last_seen: string | null;
  next_due: string | null;
  /** exponentially-weighted mean ms per item, local-only helper */
  avg_ms?: number;
}

export const MODULE_NAMES: Record<ModuleId, string> = {
  bto: "Beat The Odds",
  numberlogic: "NumberLogic",
  likelihood: "Likelihood-list",
  intervals: "Intervals",
  orderbooks: "Orderbooks",
  zapn: "Zap-N",
  warmup: "Mental-math warm-up",
};

export const MODULE_PATHS: Record<ModuleId, string> = {
  bto: "/beat-the-odds/",
  numberlogic: "/number-logic/",
  likelihood: "/likelihood/",
  intervals: "/intervals/",
  orderbooks: "/orderbooks/",
  zapn: "/zap-n/",
  warmup: "/warmup/",
};
