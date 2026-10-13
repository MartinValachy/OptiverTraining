"use client";

import { EXAM_SETUP, SOFT_LIMIT } from "@/modules/registry";
import { ModuleHome } from "@/components/exam/ModuleHome";
import { btoModule } from "@/modules/bto/module";
import { BTO_PRESETS } from "@/lib/config";

export default function BtoPage() {
  return (
    <ModuleHome
      mod={btoModule}
      about={
        <>
          <p>Probability questions with five numeric options: select the one closest to the true value. Sometimes the exact answer is deliberately missing.</p>
          <p className="mt-2 text-muted">Scoring +1 / −1 / 0. No going back. If the question timer runs out, the question counts as skipped even if you selected an option without submitting.</p>
        </>
      }
      presets={BTO_PRESETS.map((p) => ({ id: p.id, label: p.label }))}
      examSetup={EXAM_SETUP.bto}
      softLimitMs={SOFT_LIMIT.bto}
    />
  );
}
