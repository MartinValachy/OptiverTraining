"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "@/components/AppProvider";
import { PageTitle, Section, Stat } from "@/components/ui";
import { formatClock } from "@/lib/clock";
import { useExamClock, useTick } from "@/lib/hooks";
import { uuid } from "@/lib/ids";
import { randomSeed } from "@/lib/rng";
import { listAttempts } from "@/lib/db/local";
import { recordAttempt } from "@/lib/engine/record";
import type { Attempt } from "@/modules/types";
import type { GameMeta } from "@/modules/zapn/config";
import { rtStats } from "@/modules/zapn/logic";

export interface GameResult {
  score: number;
  /** normalised performance in [0, 1] for the skill engine */
  perf: number;
  metrics: { label: string; value: string }[];
  /** reaction times (ms) for reaction games */
  rts?: number[];
  /** game-specific analysis payload */
  analysis?: Record<string, unknown>;
}

export interface GameProps {
  tutorial: boolean;
  durationMs: number;
  seed: number;
  onDone: (r: GameResult) => void;
}

/** Countdown for a game session, driven by performance.now() deltas. */
/** Persist one Zap-N session (attempt + one item result for the skill engine). */
export function recordGameSession(game: string, result: GameResult, durationMs: number, startedAt: string, extraConfig: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  const id = uuid();
  const rt = result.rts?.length ? rtStats(result.rts) : null;
  const attempt: Attempt = {
    id,
    module: "zapn",
    mode: "exam",
    config: { game, sessionSec: durationMs / 1000, ...extraConfig },
    started_at: startedAt || now,
    finished_at: now,
    score: Math.round(result.score * 100) / 100,
    max_score: 0,
    meta: { perf: result.perf, metrics: result.metrics, rt, analysis: result.analysis ?? null },
  };
  recordAttempt(attempt, [
    {
      id: uuid(),
      attempt_id: id,
      module: "zapn",
      family: game,
      difficulty: 1,
      seed: 0,
      response: { metrics: result.metrics, rt },
      correct: result.perf >= 0.7,
      score: result.perf,
      ms_taken: durationMs,
      created_at: now,
    },
  ]);
  return attempt;
}

export function useSessionTimer(durationMs: number, active: boolean, onExpire: () => void): number {
  const clock = useExamClock();
  const [left, setLeft] = useState(durationMs);
  const fired = useRef(false);
  useTick(
    () => {
      const l = Math.max(0, durationMs - clock.now());
      setLeft(l);
      if (l <= 0 && !fired.current) {
        fired.current = true;
        onExpire();
      }
    },
    100,
    active,
  );
  return left;
}

export function SessionBar({ left, label }: { left: number; label?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className={`tabular rounded-md border px-2 py-0.5 font-mono ${left < 10_000 ? "border-bad text-bad" : "border-line"}`} role="timer">
        {formatClock(left)}
      </span>
    </div>
  );
}

type Phase = { kind: "intro" } | { kind: "tutorial"; seed: number } | { kind: "play"; seed: number } | { kind: "results"; result: GameResult; tutorial: boolean };

export function GameShell({ meta, Game, Analysis }: { meta: GameMeta; Game: ComponentType<GameProps>; Analysis?: ComponentType<{ result: GameResult }> }) {
  const { prefs } = useApp();
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [history, setHistory] = useState<Attempt[]>([]);
  const started = useRef<string>("");
  const [secOverride, setSecOverride] = useState<number | null>(null);
  const durationMs = (secOverride ?? prefs.zapnSessionSec) * 1000;

  useEffect(() => {
    listAttempts("zapn")
      .then((a) => setHistory(a.filter((x) => x.config.game === meta.id)))
      .catch(() => {});
  }, [meta.id, phase.kind]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("sec")) queueMicrotask(() => setSecOverride(Number(q.get("sec"))));
    if (q.get("start") === "1") queueMicrotask(() => setPhase({ kind: "play", seed: q.get("seed") ? Number(q.get("seed")) : randomSeed() }));
  }, []);

  function finish(result: GameResult, tutorial: boolean) {
    setPhase({ kind: "results", result, tutorial });
    if (!tutorial) recordGameSession(meta.id, result, durationMs, started.current);
  }

  if (phase.kind === "tutorial" || phase.kind === "play") {
    const tutorial = phase.kind === "tutorial";
    return (
      <div>
        <div className="mb-2 flex items-center gap-2">
          <h1 className="flex-1 font-semibold">
            {meta.name} {tutorial && <span className="text-sm font-normal text-warn">· tutorial (not recorded)</span>}
          </h1>
          <button className="btn btn-ghost px-2 text-muted" onClick={() => setPhase({ kind: "intro" })} aria-label="Quit">
            ✕
          </button>
        </div>
        <Game key={phase.seed} tutorial={tutorial} durationMs={tutorial ? Math.min(60_000, durationMs) : durationMs} seed={phase.seed} onDone={(r) => finish(r, tutorial)} />
      </div>
    );
  }

  const sorted = [...history].sort((a, b) => (meta.higherIsBetter ? b.score - a.score : a.score - b.score));
  const trend = history.map((a, i) => ({ n: i + 1, score: a.score, date: a.finished_at.slice(5, 10) }));

  return (
    <div>
      <PageTitle back="/zap-n/">{meta.name}</PageTitle>
      {phase.kind === "results" && (
        <Section title={phase.tutorial ? "Tutorial result" : "Session result"}>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="game-results">
            <Stat label={meta.scoreLabel} value={<span data-testid="game-score">{fmt(phase.result.score)}</span>} />
            {phase.result.metrics.map((m) => (
              <Stat key={m.label} label={m.label} value={m.value} />
            ))}
            {phase.result.rts && phase.result.rts.length > 0 && <RtStats rts={phase.result.rts} />}
          </div>
          {Analysis && <Analysis result={phase.result} />}
        </Section>
      )}
      {phase.kind === "intro" && (
        <div className="card mb-4 p-4 text-sm leading-relaxed">
          <p className="mb-2">
            <b>{meta.skill}</b> — {meta.blurb}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            {meta.tutorial.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mb-5 flex gap-2">
        <button className="btn" onClick={() => setPhase({ kind: "tutorial", seed: randomSeed() })}>
          Tutorial
        </button>
        <button
          className="btn btn-primary flex-1"
          onClick={() => {
            started.current = new Date().toISOString();
            setPhase({ kind: "play", seed: randomSeed() });
          }}
          data-testid="game-start"
        >
          {phase.kind === "results" ? "Play again" : `Start ${Math.round(durationMs / 60_000)}-min session`}
        </button>
      </div>
      <Section title="Personal bests">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted">No sessions yet.</p>
        ) : (
          <ol className="card divide-y divide-line text-sm">
            {sorted.slice(0, 5).map((a, i) => (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2">
                <span className="w-5 text-muted">{i + 1}</span>
                <span className="tabular flex-1 font-semibold">{fmt(a.score)}</span>
                <span className="text-xs text-muted">{new Date(a.finished_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>
      {trend.length > 1 && (
        <Section title="Trend">
          <div className="card h-48 p-2">
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="n" tick={{ fill: "var(--muted)", fontSize: 11 }} />
                <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                <Line dataKey="score" stroke="#5b8cff" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}
      <Link href="/zap-n/" className="text-sm text-muted">
        ← All games
      </Link>
    </div>
  );
}

function RtStats({ rts }: { rts: number[] }) {
  const s = rtStats(rts);
  return (
    <>
      <Stat label="Mean RT" value={`${Math.round(s.mean)} ms`} sub={`median ${Math.round(s.median)} ms`} />
      <Stat label="RT variability" value={`± ${Math.round(s.sd)} ms`} sub={`variance ${Math.round(s.sd * s.sd).toLocaleString()} ms²`} />
    </>
  );
}

export function fmt(x: number): string {
  return Number.isInteger(x) ? String(x) : x.toFixed(2);
}
