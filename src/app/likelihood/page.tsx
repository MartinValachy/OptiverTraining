"use client";

import { EXAM_SETUP, SOFT_LIMIT } from "@/modules/registry";
import { useEffect } from "react";
import { ModuleHome } from "@/components/exam/ModuleHome";
import { likelihoodModule } from "@/modules/likelihood/module";
import { setLikelihoodMargin } from "@/modules/likelihood/generate";
import { useApp } from "@/components/AppProvider";

export default function LikelihoodPage() {
  const { prefs } = useApp();
  useEffect(() => setLikelihoodMargin(prefs.exam.likelihood.marginPP), [prefs.exam.likelihood.marginPP]);
  return (
    <ModuleHome
      mod={likelihoodModule}
      about={
        <>
          <p>Each question gives a scenario (table, chart, diagram or text) and three outcomes. Drag them into order from most to least likely (or use the arrows).</p>
          <p className="mt-2 text-muted">1 point only for the exact order, no partial credit. When the timer hits 0 the current order is submitted.</p>
        </>
      }
      examSetup={EXAM_SETUP.likelihood}
      softLimitMs={SOFT_LIMIT.likelihood}
    />
  );
}
