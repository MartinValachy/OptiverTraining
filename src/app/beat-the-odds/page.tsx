"use client";

import { ModuleHome } from "@/components/exam/ModuleHome";
import { btoModule } from "@/modules/bto/module";
import { BTO_PRESETS, QUICK_EXAM } from "@/lib/config";

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
      examSetup={(prefs, { quick, preset }) => {
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
      }}
      softLimitMs={(prefs) => (prefs.exam.bto.perQuestionSec ?? 90) * 1000}
    />
  );
}
