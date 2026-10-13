"use client";

import { EXAM_SETUP, SOFT_LIMIT } from "@/modules/registry";
import { ModuleHome } from "@/components/exam/ModuleHome";
import { warmupModule } from "@/modules/warmup/module";

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
      examSetup={EXAM_SETUP.warmup}
      softLimitMs={SOFT_LIMIT.warmup}
    />
  );
}
