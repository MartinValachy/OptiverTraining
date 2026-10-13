// Every timing and count is a config value; defaults follow 2026/27 candidate reports.

export interface BtoConfig {
  count: number;
  perQuestionSec: number | null;
  totalSec: number | null;
}
export interface NumberLogicConfig {
  count: number;
  totalSec: number;
  options: number;
}
export interface LikelihoodConfig {
  count: number;
  perQuestionSec: number;
  marginPP: number;
}
export interface IntervalsConfig {
  count: number;
  perQuestionSec: number;
}
export interface OrderbooksConfig {
  count: number;
  totalSec: number;
  /** share of boards with no arbitrage (enables the "No opportunity" button) */
  noArbShare: number;
}
export interface WarmupConfig {
  count: number;
  totalSec: number;
}

export interface ExamConfigs {
  bto: BtoConfig;
  numberlogic: NumberLogicConfig;
  likelihood: LikelihoodConfig;
  intervals: IntervalsConfig;
  orderbooks: OrderbooksConfig;
  warmup: WarmupConfig;
}

export const DEFAULT_EXAM: ExamConfigs = {
  bto: { count: 30, perQuestionSec: 90, totalSec: 25 * 60 },
  numberlogic: { count: 26, totalSec: 25 * 60, options: 5 },
  likelihood: { count: 15, perQuestionSec: 90, marginPP: 3 },
  intervals: { count: 18, perQuestionSec: 60 },
  orderbooks: { count: 20, totalSec: 8 * 60, noArbShare: 0 },
  warmup: { count: 80, totalSec: 8 * 60 },
};

export const BTO_PRESETS: { id: string; label: string; cfg: BtoConfig }[] = [
  { id: "invite", label: "Invite: 90 s / question, 25 min cap", cfg: DEFAULT_EXAM.bto },
  { id: "30x90", label: "30 × 90 s (no overall cap)", cfg: { count: 30, perQuestionSec: 90, totalSec: null } },
];

export interface Prefs {
  targetDate: string;
  startDate: string | null;
  theme: "dark" | "light" | "system";
  exam: ExamConfigs;
  /** soft timer shown in training mode (seconds per item, 0 = off) */
  trainingSoftTimer: boolean;
  zapnSessionSec: number;
  mockBreaks: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  targetDate: "2026-11-30",
  startDate: null,
  theme: "dark",
  exam: DEFAULT_EXAM,
  trainingSoftTimer: true,
  zapnSessionSec: 180,
  mockBreaks: true,
};

export function mergePrefs(p: Partial<Prefs> | undefined | null): Prefs {
  const exam = { ...DEFAULT_EXAM } as ExamConfigs;
  const src = (p?.exam ?? {}) as Partial<ExamConfigs>;
  for (const k of Object.keys(DEFAULT_EXAM) as (keyof ExamConfigs)[]) {
    (exam as unknown as Record<string, unknown>)[k] = { ...DEFAULT_EXAM[k], ...(src[k] ?? {}) };
  }
  return { ...DEFAULT_PREFS, ...(p ?? {}), exam };
}

/**
 * Short configs used by automated tests and the "quick exam" toggle (?quick=1), so a full UI
 * run of every module fits in an end-to-end test.
 */
export const QUICK_EXAM: ExamConfigs = {
  bto: { count: 3, perQuestionSec: 90, totalSec: 25 * 60 },
  numberlogic: { count: 3, totalSec: 25 * 60, options: 5 },
  likelihood: { count: 2, perQuestionSec: 90, marginPP: 3 },
  intervals: { count: 2, perQuestionSec: 60 },
  orderbooks: { count: 3, totalSec: 8 * 60, noArbShare: 0 },
  warmup: { count: 5, totalSec: 8 * 60 },
};
