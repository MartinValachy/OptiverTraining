"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { PageTitle, Section } from "@/components/ui";
import { listAttempts } from "@/lib/db/local";
import { buildSchedule, currentWeek, daysUntil } from "@/lib/engine/schedule";
import { startOfWeek } from "@/lib/engine/stats";
import { MODULE_NAMES, MODULE_PATHS, type Attempt, type ModuleId } from "@/modules/types";

const EXAM_MODULES: ModuleId[] = ["bto", "numberlogic", "likelihood", "intervals", "orderbooks", "zapn"];

export default function PlanPage() {
  const { prefs, prefsLoaded } = useApp();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  useEffect(() => {
    listAttempts()
      .then(setAttempts)
      .catch(() => {});
  }, []);
  if (!prefsLoaded) return <p className="text-muted">Loading…</p>;
  const start = prefs.startDate ?? new Date().toISOString().slice(0, 10);
  const weeks = buildSchedule(start, prefs.targetDate);
  const cur = currentWeek(weeks);
  const days = daysUntil(prefs.targetDate);
  const weekStart = startOfWeek(new Date()).getTime();
  const thisWeek = attempts.filter((a) => new Date(a.finished_at).getTime() >= weekStart);
  const examDone = new Set(thisWeek.filter((a) => a.mode === "exam").map((a) => a.module));
  const mocksThisWeek = thisWeek.filter((a) => a.module === "mock").length;
  return (
    <div>
      <PageTitle back="/">Plan</PageTitle>
      <div className="card mb-5 flex items-center justify-between p-4" data-testid="countdown">
        <div>
          <div className="text-xs text-muted">Target date</div>
          <div className="font-semibold">{new Date(prefs.targetDate + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</div>
          <Link href="/settings/" className="text-xs text-accent">
            change
          </Link>
        </div>
        <div className="text-right">
          <div className="tabular text-3xl font-bold">{days}</div>
          <div className="text-xs text-muted">days · {Math.ceil(days / 7)} weeks</div>
        </div>
      </div>

      {cur && (
        <Section title={`This week (week ${cur.index})`}>
          <div className="card space-y-2 p-4 text-sm">
            <ul className="list-disc space-y-1 pl-5">
              {cur.tasks.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            {cur.phase === "mixed" && (
              <div className="grid grid-cols-2 gap-1.5 pt-2 sm:grid-cols-3">
                {EXAM_MODULES.map((m) => (
                  <Link key={m} href={m === "zapn" ? "/zap-n/" : `${MODULE_PATHS[m]}?mode=exam`} className={`rounded-lg border px-2 py-2 text-xs ${examDone.has(m) ? "border-good text-good" : "border-line"}`}>
                    {examDone.has(m) ? "✓ " : ""}
                    {MODULE_NAMES[m]} exam
                  </Link>
                ))}
              </div>
            )}
            {cur.phase === "mock" && (
              <Link href="/mock/" className={`btn w-full ${mocksThisWeek >= 2 ? "border-good text-good" : "btn-primary"}`}>
                Full mock battery ({mocksThisWeek}/2 done)
              </Link>
            )}
            {cur.phase === "training" && (
              <Link href="/today/" className="btn btn-primary w-full">
                Today&apos;s session
              </Link>
            )}
          </div>
        </Section>
      )}

      <Section title="Schedule">
        <ol className="space-y-2">
          {weeks.map((w) => (
            <li key={w.index} className={`card p-3 text-sm ${cur?.index === w.index ? "border-accent" : ""}`}>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium">
                  Week {w.index} · {w.phase === "training" ? "Training on all families" : w.phase === "mixed" ? "Mixed: training + one exam per module" : "Full mock battery ×2"}
                </span>
                <span className="tabular text-xs text-muted">
                  {w.start.slice(5)} → {w.end.slice(5)}
                </span>
              </div>
              <ul className="list-disc pl-5 text-xs text-muted">
                {w.tasks.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
