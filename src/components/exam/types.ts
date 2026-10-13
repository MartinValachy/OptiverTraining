import type { ComponentType } from "react";
import type { Difficulty, FamilyInfo, ItemKey, Mode, ModuleId } from "@/modules/types";

export interface ScoreResult {
  /** null = skipped / no answer */
  correct: boolean | null;
  score: number;
}

export interface ItemViewProps<I, R> {
  item: I;
  mode: Mode;
  index: number;
  /** committed response (free-navigation exams show it highlighted) */
  response: R | null;
  draft: R | null;
  setDraft: (r: R | null) => void;
  /** commit and advance */
  submit: (r: R | null) => void;
  /** training: answer has been submitted, show correctness */
  locked: boolean;
}

export interface Scored<I, R> {
  key: ItemKey;
  item: I;
  response: R | null;
  correct: boolean | null;
  score: number;
  msTaken: number;
  timedOut: boolean;
}

export interface QuestionModule<I, R> {
  id: ModuleId;
  title: string;
  families: FamilyInfo[];
  generate(family: string, difficulty: Difficulty, seed: number): I;
  score(item: I, response: R | null): ScoreResult;
  /** response used when a per-question timer expires (default: none = skipped) */
  onTimeout?: (draft: R | null, item: I) => R | null;
  /** response to start a question with (e.g. the initial arrangement in Likelihood-list) */
  initialDraft?: (item: I) => R | null;
  View: ComponentType<ItemViewProps<I, R>>;
  Solution: ComponentType<{ item: I; response: R | null }>;
  ReviewSummary?: ComponentType<{ results: Scored<I, R>[]; mode: Mode }>;
  hint(item: I): string;
  /** one-line description for review lists */
  describe(item: I): string;
  /** short answer label for review lists */
  answerLabel(item: I): string;
  responseLabel(item: I, r: R | null): string;
  /** can the user submit this draft? */
  canSubmit?: (draft: R | null, item: I) => boolean;
  /** training/exam submit hook: return an error to reject (Orderbooks) */
  validate?: (draft: R | null, item: I) => string | null;
}
