"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Difficulty, ItemKey } from "@/modules/types";
import type { Prefs } from "@/lib/config";
import { useApp } from "@/components/AppProvider";
import { planItems } from "@/lib/plan";
import { randomSeed } from "@/lib/rng";
import { PageTitle, Section } from "@/components/ui";
import { ExamRunner, type ExamTiming } from "./ExamRunner";
import { TrainingRunner } from "./TrainingRunner";
import type { QuestionModule } from "./types";

export interface ExamSetup {
  count: number;
  timing: ExamTiming;
  navigation: "forward" | "free";
  summary: string;
  config: Record<string, unknown>;
}

type View =
  | { kind: "home" }
  | { kind: "exam"; keys: ItemKey[]; setup: ExamSetup; seed: number }
  | { kind: "training"; families: string[]; difficulty: "auto" | Difficulty };

export function readQuery(): URLSearchParams {
  return new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
}

export function ModuleHome<I, R>({
  mod,
  about,
  examSetup,
  presets,
  plan,
  softLimitMs,
}: {
  mod: QuestionModule<I, R>;
  about: ReactNode;
  examSetup: (prefs: Prefs, opts: { quick: boolean; preset: string | null }) => ExamSetup;
  presets?: { id: string; label: string }[];
  plan?: (count: number, seed: number) => ItemKey[];
  softLimitMs?: (prefs: Prefs) => number | null;
}) {
  const { prefs, prefsLoaded } = useApp();
  const [view, setView] = useState<View>({ kind: "home" });
  const [preset, setPreset] = useState<string | null>(presets?.[0]?.id ?? null);
  const [fams, setFams] = useState<string[]>(() => mod.families.map((f) => f.id));
  const [diff, setDiff] = useState<"auto" | Difficulty>("auto");
  const setup = useMemo(() => examSetup(prefs, { quick: false, preset }), [examSetup, prefs, preset]);

  function startExam(quick: boolean, seed: number, presetId: string | null) {
    const s = examSetup(prefs, { quick, preset: presetId });
    const keys = plan ? plan(s.count, seed) : planItems(mod.id, mod.families.map((f) => f.id), s.count, seed);
    setView({ kind: "exam", keys, setup: s, seed });
  }

  // Deep links: ?mode=exam&quick=1&seed=42 or ?mode=training&family=dice
  useEffect(() => {
    if (!prefsLoaded) return;
    const q = readQuery();
    const mode = q.get("mode");
    if (mode === "exam") {
      const seed = q.get("seed") ? Number(q.get("seed")) : randomSeed();
      const s = examSetup(prefs, { quick: q.get("quick") === "1", preset: q.get("preset") });
      const keys = plan ? plan(s.count, seed) : planItems(mod.id, mod.families.map((f) => f.id), s.count, seed);
      queueMicrotask(() => setView({ kind: "exam", keys, setup: s, seed }));
    } else if (mode === "training") {
      const f = q.get("family");
      const families = f ? f.split(",") : mod.families.map((x) => x.id);
      queueMicrotask(() => setView({ kind: "training", families, difficulty: "auto" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsLoaded]);

  const home = () => {
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
    setView({ kind: "home" });
  };

  if (view.kind === "exam") {
    return (
      <ExamRunner
        mod={mod}
        keys={view.keys}
        timing={view.setup.timing}
        navigation={view.setup.navigation}
        config={{ ...view.setup.config, seed: view.seed }}
        onQuit={home}
      />
    );
  }
  if (view.kind === "training") {
    return (
      <TrainingRunner
        mod={mod}
        families={view.families}
        difficulty={view.difficulty}
        softLimitMs={prefs.trainingSoftTimer ? (softLimitMs?.(prefs) ?? null) : null}
        onQuit={home}
      />
    );
  }

  return (
    <div>
      <PageTitle back="/">{mod.title}</PageTitle>
      <div className="card mb-5 p-4 text-sm leading-relaxed">{about}</div>
      <Section title="Exam mode">
        <div className="card p-4">
          {presets && presets.length > 1 && (
            <div className="mb-3 flex flex-col gap-2">
              {presets.map((p) => (
                <label key={p.id} className="flex min-h-11 items-center gap-3 text-sm">
                  <input type="radio" name="preset" checked={preset === p.id} onChange={() => setPreset(p.id)} className="h-5 w-5" />
                  {p.label}
                </label>
              ))}
            </div>
          )}
          <p className="mb-3 text-sm text-muted">{setup.summary}. No feedback until the end, then a full review.</p>
          <button className="btn btn-primary w-full" onClick={() => startExam(false, randomSeed(), preset)} data-testid="start-exam">
            Start exam
          </button>
        </div>
      </Section>
      <Section title="Training mode">
        <div className="card p-4">
          <p className="mb-3 text-sm text-muted">Same items, soft timer, hints on request and a worked solution after each answer. Difficulty adapts to keep you around 75% accuracy.</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {mod.families.map((f) => {
              const on = fams.includes(f.id);
              return (
                <button
                  key={f.id}
                  onClick={() => setFams((cur) => (on ? cur.filter((x) => x !== f.id) : [...cur, f.id]))}
                  className={`min-h-11 rounded-lg border px-3 text-left text-sm ${on ? "border-accent text-fg" : "border-line text-muted"}`}
                  aria-pressed={on}
                  title={f.blurb}
                >
                  {f.name}
                </button>
              );
            })}
          </div>
          <div className="mb-3 flex items-center gap-2 text-sm">
            <span className="text-muted">Difficulty</span>
            {(["auto", 1, 2, 3] as const).map((d) => (
              <button key={d} onClick={() => setDiff(d)} className={`min-h-11 min-w-11 rounded-lg border px-3 ${diff === d ? "border-accent" : "border-line text-muted"}`}>
                {d === "auto" ? "Adaptive" : d}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={() => setFams(fams.length === mod.families.length ? [] : mod.families.map((f) => f.id))}>
              {fams.length === mod.families.length ? "None" : "All"}
            </button>
            <button
              className="btn btn-primary flex-1"
              disabled={!fams.length}
              onClick={() => setView({ kind: "training", families: fams, difficulty: diff })}
              data-testid="start-training"
            >
              Start training
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}
