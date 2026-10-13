"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { ExamRunner, type ExamResultBundle } from "@/components/exam/ExamRunner";
import { planFor, readQuery } from "@/components/exam/ModuleHome";
import { Review } from "@/components/exam/Review";
import { recordGameSession, type GameResult } from "@/components/zapn/GameShell";
import { GAME_COMPONENTS } from "@/components/zapn/registry";
import { Collapsible, PageTitle, Section, Stat, pct, secs } from "@/components/ui";
import { recordAttempt } from "@/lib/engine/record";
import { uuid } from "@/lib/ids";
import { randomSeed } from "@/lib/rng";
import { formatClock } from "@/lib/clock";
import { useExamClock, useTick } from "@/lib/hooks";
import type { QuestionModuleId } from "@/lib/engine/catalog";
import { EXAM_SETUP, QUESTION_MODULES } from "@/modules/registry";
import { MODULE_NAMES, type Attempt } from "@/modules/types";
import { GAMES, GAME_MAP, type GameId } from "@/modules/zapn/config";

const ORDER: QuestionModuleId[] = ["bto", "numberlogic", "likelihood", "intervals", "orderbooks"];

type StageResult =
  | { kind: "exam"; module: QuestionModuleId; bundle: ExamResultBundle<unknown, unknown> }
  | { kind: "game"; game: GameId; result: GameResult; ms: number };

type View = { kind: "intro" } | { kind: "stage"; i: number } | { kind: "break"; next: number } | { kind: "report" };

function BreakScreen({ next, onGo }: { next: string; onGo: () => void }) {
  const clock = useExamClock();
  const [t, setT] = useState(0);
  useTick(() => setT(clock.now()), 500);
  return (
    <div className="card p-6 text-center" data-testid="mock-break">
      <div className="text-sm text-muted">Optional break</div>
      <div className="tabular my-2 font-mono text-3xl">{formatClock(t)}</div>
      <p className="mb-4 text-sm">Next: {next}</p>
      <button className="btn btn-primary w-full" onClick={onGo} data-testid="mock-continue">
        Continue
      </button>
    </div>
  );
}

export default function MockPage() {
  const { prefs, prefsLoaded } = useApp();
  const [view, setView] = useState<View>({ kind: "intro" });
  const [games, setGames] = useState<GameId[]>(["balloon", "codecompare"]);
  const [breaks, setBreaks] = useState(prefs.mockBreaks);
  const [quick, setQuick] = useState(false);
  const [results, setResults] = useState<StageResult[]>([]);
  const [mockId] = useState(() => uuid());
  const [seed] = useState(() => randomSeed());
  const startedAt = useRef<string>("");
  const saved = useRef(false);

  useEffect(() => {
    const q = readQuery();
    if (q.get("quick") === "1") queueMicrotask(() => setQuick(true));
    if (q.get("breaks") === "0") queueMicrotask(() => setBreaks(false));
  }, []);

  const stages = useMemo(() => [...ORDER.map((m) => ({ kind: "exam" as const, module: m })), ...games.map((g) => ({ kind: "game" as const, game: g }))], [games]);
  const setups = useMemo(() => Object.fromEntries(ORDER.map((m) => [m, EXAM_SETUP[m](prefs, { quick, preset: null })])), [prefs, quick]);
  const keys = useMemo(() => Object.fromEntries(ORDER.map((m, k) => [m, planFor(QUESTION_MODULES[m], setups[m], seed + k)])), [setups, seed]);
  const gameMs = quick ? 5000 : prefs.zapnSessionSec * 1000;

  const stageLabel = (i: number) => {
    const s = stages[i];
    return s.kind === "exam" ? MODULE_NAMES[s.module] : `Zap-N: ${GAME_MAP.get(s.game)!.name}`;
  };
  const advance = (i: number, res: StageResult) => {
    setResults((r) => [...r, res]);
    const next = i + 1;
    if (next >= stages.length) setView({ kind: "report" });
    else if (breaks) setView({ kind: "break", next });
    else setView({ kind: "stage", i: next });
  };

  // save the combined report once
  useEffect(() => {
    if (view.kind !== "report" || saved.current) return;
    saved.current = true;
    const exams = results.filter((r): r is Extract<StageResult, { kind: "exam" }> => r.kind === "exam");
    const parts = [...exams.map((e) => Math.max(0, e.bundle.attempt.score / Math.max(1, e.bundle.attempt.max_score))), ...results.filter((r) => r.kind === "game").map((g) => (g as { result: GameResult }).result.perf)];
    const attempt: Attempt = {
      id: mockId,
      module: "mock",
      mode: "exam",
      config: { games, quick, breaks },
      started_at: startedAt.current,
      finished_at: new Date().toISOString(),
      score: Math.round(parts.reduce((a, b) => a + b, 0) * 1000) / 1000,
      max_score: parts.length,
      meta: {
        modules: exams.map((e) => ({ module: e.module, score: e.bundle.attempt.score, max: e.bundle.attempt.max_score, attemptId: e.bundle.attempt.id })),
        games: results.filter((r) => r.kind === "game").map((g) => ({ game: (g as { game: string }).game, score: (g as { result: GameResult }).result.score })),
      },
    };
    recordAttempt(attempt, []);
  }, [view.kind, results, mockId, games, quick, breaks]);

  if (!prefsLoaded) return <p className="text-muted">Loading…</p>;

  if (view.kind === "break") return <BreakScreen next={stageLabel(view.next)} onGo={() => setView({ kind: "stage", i: view.next })} />;

  if (view.kind === "stage") {
    const s = stages[view.i];
    return (
      <div>
        <div className="mb-2 text-xs text-muted" data-testid="mock-stage">
          Mock battery · stage {view.i + 1}/{stages.length}
        </div>
        {s.kind === "exam" ? (
          <ExamRunner
            key={s.module}
            mod={QUESTION_MODULES[s.module]}
            keys={keys[s.module]}
            timing={setups[s.module].timing}
            navigation={setups[s.module].navigation}
            config={{ ...setups[s.module].config, mockId }}
            showReview={false}
            onFinished={(b) => advance(view.i, { kind: "exam", module: s.module, bundle: b as ExamResultBundle<unknown, unknown> })}
          />
        ) : (
          <MockGame key={s.game} game={s.game} ms={gameMs} onDone={(r) => {
            recordGameSession(s.game, r, gameMs, new Date().toISOString(), { mockId });
            advance(view.i, { kind: "game", game: s.game, result: r, ms: gameMs });
          }} />
        )}
      </div>
    );
  }

  if (view.kind === "report") {
    const exams = results.filter((r): r is Extract<StageResult, { kind: "exam" }> => r.kind === "exam");
    const gameRes = results.filter((r): r is Extract<StageResult, { kind: "game" }> => r.kind === "game");
    const parts = [...exams.map((e) => Math.max(0, e.bundle.attempt.score / Math.max(1, e.bundle.attempt.max_score))), ...gameRes.map((g) => g.result.perf)];
    const overall = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
    return (
      <div data-testid="mock-report">
        <PageTitle back="/">Mock battery report</PageTitle>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <Stat label="Overall" value={pct(overall)} sub="mean of module scores (negative clipped at 0)" />
          <Stat label="Time" value={formatClock(exams.reduce((a, e) => a + e.bundle.results.reduce((x, r) => x + r.msTaken, 0), 0) + gameRes.reduce((a, g) => a + g.ms, 0))} />
        </div>
        <Section title="Modules">
          <div className="card divide-y divide-line text-sm">
            {exams.map((e) => (
              <div key={e.module} className="flex items-center gap-2 px-3 py-2">
                <span className="flex-1">{MODULE_NAMES[e.module]}</span>
                <span className="tabular">
                  {e.bundle.attempt.score} / {e.bundle.attempt.max_score}
                </span>
                <span className="tabular w-14 text-right font-semibold">{pct(e.bundle.attempt.score / Math.max(1, e.bundle.attempt.max_score))}</span>
              </div>
            ))}
            {gameRes.map((g) => (
              <div key={g.game} className="flex items-center gap-2 px-3 py-2">
                <span className="flex-1">Zap-N · {GAME_MAP.get(g.game)!.name}</span>
                <span className="tabular">{g.result.score}</span>
                <span className="tabular w-14 text-right font-semibold">{pct(g.result.perf)}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Details">
          <div className="space-y-2">
            {exams.map((e) => (
              <Collapsible key={e.module} title={`${MODULE_NAMES[e.module]} review · avg ${secs(e.bundle.results.reduce((a, r) => a + r.msTaken, 0) / Math.max(1, e.bundle.results.length))}/item`}>
                <Review mod={QUESTION_MODULES[e.module]} bundle={e.bundle} mode="exam" actions={<span />} />
              </Collapsible>
            ))}
          </div>
        </Section>
        <Link href="/dashboard/" className="btn btn-primary w-full">
          Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageTitle back="/">Full mock battery</PageTitle>
      <div className="card mb-4 p-4 text-sm">
        <p className="mb-2">All six modules in order with exam-mode rules, then one combined report:</p>
        <ol className="list-decimal space-y-1 pl-5 text-muted">
          {ORDER.map((m) => (
            <li key={m}>
              {MODULE_NAMES[m]} — {setups[m].summary}
            </li>
          ))}
          <li>Zap-N — {games.length} game{games.length === 1 ? "" : "s"}, {Math.round(gameMs / 60000)} min each</li>
        </ol>
      </div>
      <Section title="Zap-N games in this mock">
        <div className="flex flex-wrap gap-2">
          {GAMES.map((g) => {
            const on = games.includes(g.id);
            return (
              <button key={g.id} className={`min-h-11 rounded-lg border px-3 text-sm ${on ? "border-accent" : "border-line text-muted"}`} onClick={() => setGames(on ? games.filter((x) => x !== g.id) : [...games, g.id])} aria-pressed={on}>
                {g.name}
              </button>
            );
          })}
        </div>
      </Section>
      <label className="mb-4 flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" className="h-5 w-5" checked={breaks} onChange={(e) => setBreaks(e.target.checked)} />
        Offer a break between modules
      </label>
      <button
        className="btn btn-primary w-full"
        onClick={() => {
          startedAt.current = new Date().toISOString();
          setView({ kind: "stage", i: 0 });
        }}
        data-testid="mock-start"
      >
        Start mock {quick ? "(quick)" : ""}
      </button>
    </div>
  );
}

function MockGame({ game, ms, onDone }: { game: GameId; ms: number; onDone: (r: GameResult) => void }) {
  const { Game } = GAME_COMPONENTS[game];
  const [seed] = useState(() => randomSeed());
  return (
    <div>
      <h1 className="mb-2 font-semibold">{GAME_MAP.get(game)!.name}</h1>
      <Game tutorial={false} durationMs={ms} seed={seed} onDone={onDone} />
    </div>
  );
}
