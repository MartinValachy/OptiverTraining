"use client";

import type { QuestionModule } from "@/components/exam/types";
import type { ExamSetup } from "@/components/exam/ModuleHome";
import { BTO_PRESETS, QUICK_EXAM, type Prefs } from "@/lib/config";
import type { QuestionModuleId } from "@/lib/engine/catalog";
import { btoModule } from "./bto/module";
import { numberLogicModule } from "./numberlogic/module";
import { likelihoodModule } from "./likelihood/module";
import { setLikelihoodMargin } from "./likelihood/generate";
import { intervalsModule } from "./intervals/module";
import { orderbooksModule } from "./orderbooks/module";
import { warmupModule } from "./warmup/module";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const QUESTION_MODULES: Record<QuestionModuleId, QuestionModule<any, any>> = {
  bto: btoModule,
  numberlogic: numberLogicModule,
  likelihood: likelihoodModule,
  intervals: intervalsModule,
  orderbooks: orderbooksModule,
  warmup: warmupModule,
};

type SetupOpts = { quick: boolean; preset: string | null };
const mins = (s: number) => `${Math.round(s / 60)}:00`;

export const EXAM_SETUP: Record<QuestionModuleId, (prefs: Prefs, o: SetupOpts) => ExamSetup> = {
  bto: (prefs, { quick, preset }) => {
    const c = quick ? QUICK_EXAM.bto : preset === "30x90" ? BTO_PRESETS[1].cfg : prefs.exam.bto;
    const parts = [`${c.count} questions`];
    if (c.perQuestionSec) parts.push(`${c.perQuestionSec} s each`);
    if (c.totalSec) parts.push(`${Math.round(c.totalSec / 60)} min overall cap`);
    return {
      count: c.count,
      timing: { perQuestionMs: c.perQuestionSec ? c.perQuestionSec * 1000 : null, totalMs: c.totalSec ? c.totalSec * 1000 : null },
      navigation: "forward",
      summary: parts.join(", "),
      config: { ...c, preset },
    };
  },
  numberlogic: (prefs, { quick }) => {
    const c = quick ? QUICK_EXAM.numberlogic : prefs.exam.numberlogic;
    return { count: c.count, timing: { perQuestionMs: null, totalMs: c.totalSec * 1000 }, navigation: "free", summary: `${c.count} sequences, one shared ${mins(c.totalSec)} clock`, config: { ...c } };
  },
  likelihood: (prefs, { quick }) => {
    const c = quick ? QUICK_EXAM.likelihood : prefs.exam.likelihood;
    setLikelihoodMargin(prefs.exam.likelihood.marginPP);
    return { count: c.count, timing: { perQuestionMs: c.perQuestionSec * 1000, totalMs: null }, navigation: "forward", summary: `${c.count} questions, ${c.perQuestionSec} s each`, config: { ...c } };
  },
  intervals: (prefs, { quick }) => {
    const c = quick ? QUICK_EXAM.intervals : prefs.exam.intervals;
    return { count: c.count, timing: { perQuestionMs: c.perQuestionSec * 1000, totalMs: null }, navigation: "forward", summary: `${c.count} questions, ${c.perQuestionSec} s each`, config: { ...c } };
  },
  orderbooks: (prefs, { quick }) => {
    const c = quick ? QUICK_EXAM.orderbooks : prefs.exam.orderbooks;
    return {
      count: c.count,
      timing: { perQuestionMs: null, totalMs: c.totalSec * 1000 },
      navigation: "forward",
      summary: `${c.count} boards, one shared ${mins(c.totalSec)} clock${c.noArbShare > 0 ? `, ~${Math.round(c.noArbShare * 100)}% no-opportunity boards` : ""}`,
      config: { ...c },
    };
  },
  warmup: (prefs, { quick }) => {
    const c = quick ? QUICK_EXAM.warmup : prefs.exam.warmup;
    return { count: c.count, timing: { perQuestionMs: null, totalMs: c.totalSec * 1000 }, navigation: "forward", summary: `${c.count} questions, shared ${mins(c.totalSec)} clock, typed answers`, config: { ...c } };
  },
};

export const SOFT_LIMIT: Record<QuestionModuleId, (prefs: Prefs) => number | null> = {
  bto: (p) => (p.exam.bto.perQuestionSec ?? 90) * 1000,
  numberlogic: (p) => Math.round((p.exam.numberlogic.totalSec * 1000) / p.exam.numberlogic.count),
  likelihood: (p) => p.exam.likelihood.perQuestionSec * 1000,
  intervals: (p) => p.exam.intervals.perQuestionSec * 1000,
  orderbooks: (p) => Math.round((p.exam.orderbooks.totalSec * 1000) / p.exam.orderbooks.count),
  warmup: () => 6000,
};
