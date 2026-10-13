"use client";

import { ModuleHome } from "@/components/exam/ModuleHome";
import { warmupModule } from "@/modules/warmup/module";
import { QUICK_EXAM } from "@/lib/config";

export default function WarmupPage() {
  return (
    <ModuleHome
      mod={warmupModule}
      about={
        <>
          <p>Fast arithmetic: integer ops, decimals, fractions ↔ decimals and percentages. Not part of the invite, but speed here drives Intervals and Orderbooks.</p>
          <p className="mt-2 text-muted">Type the answer and press Enter. Non-terminating decimals: 3 dp.</p>
        </>
      }
      examSetup={(prefs, { quick }) => {
        const c = quick ? QUICK_EXAM.warmup : prefs.exam.warmup;
        return {
          count: c.count,
          timing: { perQuestionMs: null, totalMs: c.totalSec * 1000 },
          navigation: "forward",
          summary: `${c.count} questions, shared ${Math.round(c.totalSec / 60)}:00 clock, typed answers`,
          config: { ...c },
        };
      }}
      softLimitMs={() => 6000}
    />
  );
}
