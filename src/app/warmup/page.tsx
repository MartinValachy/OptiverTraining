"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { TrainingRunner } from "@/components/exam/TrainingRunner";
import { Drill, type DrillConfig } from "@/components/warmup/Drill";
import { PageTitle, Section } from "@/components/ui";
import { QUICK_EXAM } from "@/lib/config";
import { listAttempts } from "@/lib/db/local";
import { randomSeed } from "@/lib/rng";
import { readQuery } from "@/components/exam/ModuleHome";
import { warmupModule } from "@/modules/warmup/module";
import type { Attempt } from "@/modules/types";

const SPRINT_SECS = [60, 120, 300];

function best(rows: Attempt[], pred: (a: Attempt) => boolean) {
  const xs = rows.filter(pred);
  return { best: xs.length ? Math.max(...xs.map((a) => a.score)) : null, last: xs.slice(-5).map((a) => a.score), n: xs.length };
}

export default function WarmupPage() {
  const { prefs, prefsLoaded } = useApp();
  const [drill, setDrill] = useState<DrillConfig | null>(null);
  const [training, setTraining] = useState(false);
  const [set, setSet] = useState<"eighty" | "zetamac">("eighty");
  const [secs, setSecs] = useState(120);
  const [hist, setHist] = useState<Attempt[]>([]);

  useEffect(() => {
    listAttempts("warmup")
      .then(setHist)
      .catch(() => {});
  }, [drill]);

  // deep links: ?drill=eighty&quick=1&seed=7 · ?drill=sprint&set=zetamac&sec=60&seed=7 · ?mode=training
  useEffect(() => {
    if (!prefsLoaded) return;
    const q = readQuery();
    const seed = q.get("seed") ? Number(q.get("seed")) : randomSeed();
    const d = q.get("drill");
    if (d === "eighty") {
      const c = q.get("quick") === "1" ? QUICK_EXAM.warmup : prefs.exam.warmup;
      queueMicrotask(() => setDrill({ kind: "eighty", count: c.count, totalSec: c.totalSec, seed }));
    } else if (d === "sprint") {
      queueMicrotask(() => setDrill({ kind: "sprint", set: q.get("set") === "zetamac" ? "zetamac" : "eighty", totalSec: Number(q.get("sec") ?? 120), seed }));
    } else if (q.get("mode") === "training") queueMicrotask(() => setTraining(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsLoaded]);

  const startEighty = () => setDrill({ kind: "eighty", count: prefs.exam.warmup.count, totalSec: prefs.exam.warmup.totalSec, seed: randomSeed() });
  const startSprint = () => setDrill({ kind: "sprint", set, totalSec: secs, seed: randomSeed() });
  const close = () => {
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
    setDrill(null);
  };

  if (drill) return <Drill key={drill.seed} config={drill} onExit={close} onAgain={() => setDrill({ ...drill, seed: randomSeed() })} />;
  if (training) return <TrainingRunner mod={warmupModule} families={warmupModule.families.map((f) => f.id)} softLimitMs={prefs.trainingSoftTimer ? 6000 : null} onQuit={() => setTraining(false)} />;

  const eighty = best(hist, (a) => a.config.format === "eighty" && a.config.count === 80);
  const sprint = best(hist, (a) => a.config.format === "sprint" && a.config.set === set && a.config.totalSec === secs);

  return (
    <div>
      <PageTitle back="/">Mental math</PageTitle>

      <button className="card mb-3 block w-full p-4 text-left active:scale-[0.99]" onClick={startEighty} data-testid="start-eighty">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-semibold">80 in 8</span>
          {eighty.best !== null && <span className="tabular text-sm text-muted">best {eighty.best} net</span>}
        </div>
        <p className="mt-1 text-sm text-muted">
          {prefs.exam.warmup.count} questions in {Math.round(prefs.exam.warmup.totalSec / 60)} minutes, four options each. A tap moves on — no skipping, no going back. +1 right, −1 wrong.
        </p>
        {eighty.last.length > 1 && <p className="tabular mt-1 text-xs text-muted">recent: {eighty.last.join(" · ")}</p>}
      </button>

      <div className="card mb-3 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-semibold">Sprint</span>
          {sprint.best !== null && <span className="tabular text-sm text-muted">best {sprint.best}</span>}
        </div>
        <p className="mt-1 mb-3 text-sm text-muted">Zetamac style: type the answer, it moves on by itself when it is right.</p>
        <div className="mb-2 flex gap-2">
          {(["eighty", "zetamac"] as const).map((s) => (
            <button key={s} className={`min-h-11 flex-1 rounded-lg border px-2 text-sm ${set === s ? "border-accent" : "border-line text-muted"}`} onClick={() => setSet(s)} aria-pressed={set === s}>
              {s === "eighty" ? "80-in-8 questions" : "Zetamac classic"}
            </button>
          ))}
        </div>
        <div className="mb-3 flex gap-2">
          {SPRINT_SECS.map((s) => (
            <button key={s} className={`tabular min-h-11 flex-1 rounded-lg border text-sm ${secs === s ? "border-accent" : "border-line text-muted"}`} onClick={() => setSecs(s)} aria-pressed={secs === s}>
              {s} s
            </button>
          ))}
        </div>
        {sprint.last.length > 1 && <p className="tabular mb-2 text-xs text-muted">recent: {sprint.last.join(" · ")}</p>}
        <button className="btn btn-primary min-h-12 w-full" onClick={startSprint} data-testid="start-sprint">
          Start sprint
        </button>
      </div>

      <Section title="By topic">
        <button className="btn w-full" onClick={() => setTraining(true)} data-testid="start-training">
          Topic training — worked solutions, adaptive difficulty
        </button>
      </Section>
      <p className="text-xs text-muted">
        Question types follow candidate reports of Optiver&apos;s 80 in 8: +, −, ×, ÷ on integers, decimals and fractions, including missing-number forms like 66 × ? = 138.6. Optiver has never published the format.
      </p>
    </div>
  );
}
