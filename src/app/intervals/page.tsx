"use client";

import { EXAM_SETUP, SOFT_LIMIT } from "@/modules/registry";
import { ModuleHome } from "@/components/exam/ModuleHome";
import { intervalsModule } from "@/modules/intervals/module";

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
      examSetup={EXAM_SETUP.intervals}
      softLimitMs={SOFT_LIMIT.intervals}
    />
  );
}
