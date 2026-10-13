"use client";

import { EXAM_SETUP, SOFT_LIMIT } from "@/modules/registry";
import { ModuleHome } from "@/components/exam/ModuleHome";
import { numberLogicModule } from "@/modules/numberlogic/module";

export default function NumberLogicPage() {
  return (
    <ModuleHome
      mod={numberLogicModule}
      about={
        <>
          <p>Number sequences: pick the next term from five cards. Each sequence follows exactly one rule of comparable simplicity (checked against the whole rule library).</p>
          <p className="mt-2 text-muted">Tapping a card commits and advances. BACK and SKIP are allowed and answers can be changed until “Save and submit”. Scoring +1 / −1 / 0, one shared clock.</p>
        </>
      }
      examSetup={EXAM_SETUP.numberlogic}
      softLimitMs={SOFT_LIMIT.numberlogic}
    />
  );
}
