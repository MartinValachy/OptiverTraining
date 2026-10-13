"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { TrainingRunner } from "@/components/exam/TrainingRunner";
import { PageTitle, Pill, Section } from "@/components/ui";
import { getSkills, listAttempts } from "@/lib/db/local";
import { buildToday, type TodayBlock } from "@/lib/engine/today";
import { familyName } from "@/lib/engine/catalog";
import { makeRng, randomSeed } from "@/lib/rng";
import { MODULE_NAMES } from "@/modules/types";
import { GAMES } from "@/modules/zapn/config";
import { QUESTION_MODULES, SOFT_LIMIT } from "@/modules/registry";

const REASON_TONE = { new: "muted", due: "warn", weak: "bad", slow: "warn", maintenance: "good" } as const;

export default function TodayPage() {
  const { prefs } = useApp();
  const [blocks, setBlocks] = useState<TodayBlock[] | null>(null);
  const [game, setGame] = useState(GAMES[0]);
  const [run, setRun] = useState<{ i: number; results: { n: number; correct: number }[] } | null>(null);
  const [warmup, setWarmup] = useState(false);

  useEffect(() => {
    (async () => {
      let skills: Awaited<ReturnType<typeof getSkills>> = [];
      try {
        skills = await getSkills();
        const zap = await listAttempts("zapn");
        const last = new Map(zap.map((a) => [String(a.config.game), a.finished_at]));
        const g = [...GAMES].sort((a, b) => (last.get(a.id) ?? "").localeCompare(last.get(b.id) ?? ""))[0];
        setGame(g);
      } catch {
        /* no local data yet */
      }
      setBlocks(buildToday(skills, new Date(), makeRng(randomSeed()), { includeWarmup: warmup }));
    })();
  }, [warmup]);

  if (run && blocks) {
    if (run.i < blocks.length) {
      const b = blocks[run.i];
      const mod = QUESTION_MODULES[b.module];
      return (
        <TrainingRunner
          key={run.i}
          mod={mod}
          families={b.families.map((f) => f.family)}
          count={b.count}
          softLimitMs={prefs.trainingSoftTimer ? SOFT_LIMIT[b.module](prefs) : null}
          title={`Today ${run.i + 1}/${blocks.length} · ${MODULE_NAMES[b.module]}`}
          onDone={(r) => setRun({ i: run.i + 1, results: [...run.results, r] })}
          onQuit={() => setRun(null)}
        />
      );
    }
    const n = run.results.reduce((a, r) => a + r.n, 0);
    const c = run.results.reduce((a, r) => a + r.correct, 0);
    return (
      <div data-testid="today-done">
        <PageTitle back="/">Session complete</PageTitle>
        <div className="card mb-4 p-4">
          <p className="text-lg font-semibold">
            {c}/{n} correct ({n ? Math.round((100 * c) / n) : 0}%)
          </p>
          <p className="text-sm text-muted">Skill ratings and review dates were updated for every family you practised.</p>
        </div>
        <Link href={`/zap-n/${game.id}/`} className="btn btn-primary w-full">
          Finish with a Zap-N game: {game.name}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageTitle back="/">Today</PageTitle>
      <p className="mb-4 text-sm text-muted">
        Families are picked by weakness: low rating, slow answers, overdue reviews and families you have not tried yet. Each is practised in training mode at an adaptive difficulty.
      </p>
      {!blocks ? (
        <p className="text-muted">Planning…</p>
      ) : (
        <>
          {blocks.map((b) => (
            <Section key={b.module} title={`${MODULE_NAMES[b.module]} · ${b.count} items`}>
              <div className="flex flex-wrap gap-2">
                {b.families.map((f) => (
                  <span key={f.family} className="card flex items-center gap-2 px-3 py-2 text-sm">
                    {familyName(b.module, f.family)} <Pill tone={REASON_TONE[f.reason]}>{f.reason}</Pill>
                  </span>
                ))}
              </div>
            </Section>
          ))}
          <Section title="Then">
            <p className="text-sm">One Zap-N game: {game.name} (least recently played).</p>
          </Section>
          <label className="mb-4 flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={warmup} onChange={(e) => setWarmup(e.target.checked)} />
            Include the mental-math warm-up if it is weak
          </label>
          <button className="btn btn-primary w-full" onClick={() => setRun({ i: 0, results: [] })} data-testid="today-start">
            Start ({blocks.reduce((a, b) => a + b.count, 0)} items)
          </button>
        </>
      )}
    </div>
  );
}
