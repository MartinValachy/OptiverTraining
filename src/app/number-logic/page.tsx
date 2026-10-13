"use client";

import { ModuleHome } from "@/components/exam/ModuleHome";
import { numberLogicModule } from "@/modules/numberlogic/module";
import { QUICK_EXAM } from "@/lib/config";

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
      examSetup={(prefs, { quick }) => {
        const c = quick ? QUICK_EXAM.numberlogic : prefs.exam.numberlogic;
        return {
          count: c.count,
          timing: { perQuestionMs: null, totalMs: c.totalSec * 1000 },
          navigation: "free",
          summary: `${c.count} sequences, one shared ${Math.round(c.totalSec / 60)}:00 clock`,
          config: { ...c },
        };
      }}
      softLimitMs={(prefs) => Math.round((prefs.exam.numberlogic.totalSec * 1000) / prefs.exam.numberlogic.count)}
    />
  );
}
