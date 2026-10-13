"use client";

import { ModuleHome } from "@/components/exam/ModuleHome";
import { intervalsModule } from "@/modules/intervals/module";
import { QUICK_EXAM } from "@/lib/config";

export default function IntervalsPage() {
  return (
    <ModuleHome
      mod={intervalsModule}
      about={
        <>
          <p>Give a lower and upper bound for each quantity. Probabilities are entered on a 0–100 scale.</p>
          <p className="mt-2 text-muted">If lower ≤ truth ≤ upper you score lower ÷ upper, otherwise 0. Lower = 0 always scores 0; a tight interval that still contains the truth is best.</p>
        </>
      }
      examSetup={(prefs, { quick }) => {
        const c = quick ? QUICK_EXAM.intervals : prefs.exam.intervals;
        return {
          count: c.count,
          timing: { perQuestionMs: c.perQuestionSec * 1000, totalMs: null },
          navigation: "forward",
          summary: `${c.count} questions, ${c.perQuestionSec} s each`,
          config: { ...c },
        };
      }}
      softLimitMs={(prefs) => prefs.exam.intervals.perQuestionSec * 1000}
    />
  );
}
