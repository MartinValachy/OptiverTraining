"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useExamClock, useHotkeys, useTick } from "@/lib/hooks";
import { uuid } from "@/lib/ids";
import { recordAttempt } from "@/lib/engine/record";
import type { Attempt, ItemResult } from "@/modules/types";
import { checkWarmup, generateWarmup, planEighty, scoreEighty, sprintItem, type WarmupItem } from "@/modules/warmup/logic";

export type DrillConfig =
  | { kind: "eighty"; count: number; totalSec: number; seed: number }
  | { kind: "sprint"; set: "eighty" | "zetamac"; totalSec: number; seed: number };

interface Answer {
  item: WarmupItem;
  /** sprint: typed value; eighty: option index */
  response: string | number | null;
  correct: boolean | null;
  ms: number;
}

/** Keeps the drill pinned to the visible area above the iOS keyboard. */
function useVisualViewport() {
  const [vv, setVV] = useState<{ h: number; top: number } | null>(null);
  useEffect(() => {
    const v = window.visualViewport;
    if (!v) return;
    const on = () => setVV({ h: v.height, top: v.offsetTop });
    queueMicrotask(on);
    v.addEventListener("resize", on);
    v.addEventListener("scroll", on);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      v.removeEventListener("resize", on);
      v.removeEventListener("scroll", on);
      document.body.style.overflow = prev;
    };
  }, []);
  return vv;
}

export function Drill({ config, onExit, onAgain }: { config: DrillConfig; onExit: () => void; onAgain: () => void }) {
  const vv = useVisualViewport();
  const clock = useExamClock();
  const [phase, setPhase] = useState<"ready" | "run" | "done">("ready");
  const [t0, setT0] = useState(0);
  const [now, setNow] = useState(0);
  const [idx, setIdx] = useState(0);
  const [shownAt, setShownAt] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [typed, setTyped] = useState("");
  const [flash, setFlash] = useState(false);
  const [startedIso, setStartedIso] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const saved = useRef(false);

  const keys = useMemo(() => (config.kind === "eighty" ? planEighty(config.count, config.seed) : []), [config]);
  const itemAt = (i: number): WarmupItem =>
    config.kind === "eighty" ? generateWarmup(keys[i].family, keys[i].difficulty, keys[i].seed) : sprintItem(config.set, config.seed, i);
  const item = useMemo(() => (phase === "done" ? null : itemAt(idx)), [idx, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const left = Math.max(0, config.totalSec * 1000 - (now - t0));
  useTick(
    () => {
      const t = clock.now();
      setNow(t);
      if (t - t0 >= config.totalSec * 1000) {
        inputRef.current?.blur();
        setPhase("done");
      }
    },
    100,
    phase === "run",
  );

  const start = () => {
    // focus inside the tap handler so iOS opens the keyboard
    if (config.kind === "sprint") inputRef.current?.focus();
    const t = clock.now();
    setT0(t);
    setNow(t);
    setShownAt(t);
    setStartedIso(new Date().toISOString());
    setPhase("run");
  };

  const next = (a: Answer) => {
    const all = [...answers, a];
    setAnswers(all);
    setShownAt(clock.now());
    if (config.kind === "eighty" && idx + 1 >= config.count) {
      setPhase("done");
      return;
    }
    setIdx(idx + 1);
  };

  const onType = (v: string) => {
    if (phase !== "run" || !item) return;
    const clean = v.replace(/[^0-9.,]/g, "");
    if (checkWarmup(item, clean)) {
      next({ item, response: clean, correct: true, ms: clock.now() - shownAt });
      setTyped("");
      setFlash(true);
      setTimeout(() => setFlash(false), 120);
    } else setTyped(clean);
  };

  const pick = (i: number) => {
    if (phase !== "run" || !item) return;
    next({ item, response: i, correct: scoreEighty(item, i).correct, ms: clock.now() - shownAt });
  };

  useHotkeys(
    (e) => {
      if (config.kind === "eighty" && phase === "run") {
        const k = Number(e.key);
        if (k >= 1 && k <= 4) {
          e.preventDefault();
          pick(k - 1);
        }
      }
      if (phase === "ready" && e.key === "Enter") {
        e.preventDefault();
        start();
      }
      if (e.key === "Escape") onExit();
    },
    [phase, idx, answers, shownAt],
  );

  // persist once at the end
  useEffect(() => {
    if (phase !== "done" || saved.current) return;
    saved.current = true;
    const id = uuid();
    const finished = new Date().toISOString();
    const correct = answers.filter((a) => a.correct).length;
    const wrong = answers.filter((a) => a.correct === false).length;
    const score = config.kind === "eighty" ? correct - wrong : correct;
    const attempt: Attempt = {
      id,
      module: "warmup",
      mode: "exam",
      config: config.kind === "eighty" ? { format: "eighty", count: config.count, totalSec: config.totalSec } : { format: "sprint", set: config.set, totalSec: config.totalSec },
      started_at: startedIso || finished,
      finished_at: finished,
      score,
      // 80 in 8 is scored out of the question count; a sprint has no maximum
      max_score: config.kind === "eighty" ? config.count : 0,
      meta: { correct, wrong, answered: answers.length },
    };
    const rows: ItemResult[] = answers.map((a) => ({
      id: uuid(),
      attempt_id: id,
      module: "warmup",
      family: a.item.family,
      difficulty: a.item.difficulty,
      seed: a.item.seed,
      response: a.response,
      correct: a.correct,
      score: config.kind === "eighty" ? (a.correct ? 1 : -1) : 1,
      ms_taken: Math.round(a.ms),
      created_at: finished,
    }));
    recordAttempt(attempt, rows);
  }, [phase, answers, config, startedIso]);

  const secsLeft = Math.ceil(left / 1000);
  const timeLabel = config.kind === "eighty" ? `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, "0")}` : String(secsLeft);
  const correctCount = answers.filter((a) => a.correct).length;

  return (
    <div
      className="fixed inset-x-0 z-50 flex flex-col bg-bg text-fg"
      style={{ top: vv?.top ?? 0, height: vv ? vv.h : "100dvh", paddingTop: "max(env(safe-area-inset-top), 8px)" }}
      data-testid="drill"
    >
      <div className="flex items-center justify-between px-4 py-1">
        <span className="text-lg font-semibold tracking-tight">{config.kind === "eighty" ? "80 in 8" : "Sprint"}</span>
        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-card2 text-muted" onClick={onExit} aria-label="Close" data-testid="drill-close">
          ✕
        </button>
      </div>

      {/* the input stays mounted so the keyboard stays open between problems */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        {phase === "ready" && (
          <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
            {config.kind === "eighty" ? (
              <>
                <p className="text-2xl font-semibold">{config.count} questions · {Math.round(config.totalSec / 60)} minutes</p>
                <p className="text-sm text-muted">Tap the right option (or press 1–4). Each tap moves on: no skipping, no going back. +1 right, −1 wrong.</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-semibold">{config.totalSec} seconds</p>
                <p className="text-sm text-muted">Type the answer — it moves on by itself as soon as it is right. {config.set === "eighty" ? "80-in-8 style questions." : "Zetamac default ranges."}</p>
              </>
            )}
            <button className="btn btn-primary min-h-14 w-full text-lg" onClick={start} data-testid="drill-start">
              Start
            </button>
          </div>
        )}

        {phase === "run" && item && (
          <>
            <div className="text-center text-xl font-semibold leading-snug tabular" data-testid="drill-status">
              <div>Time: {timeLabel}</div>
              <div className={`transition-colors ${flash ? "text-good" : ""}`}>{config.kind === "eighty" ? `${idx + 1} / ${config.count}` : `Score: ${correctCount}`}</div>
            </div>
            <div
              className={`tabular whitespace-nowrap text-center font-semibold tracking-tight ${item.prompt.length <= 9 ? "text-5xl" : item.prompt.length <= 13 ? "text-4xl" : "text-3xl"}`}
              data-testid="drill-prompt"
            >
              {item.prompt.split("?").map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && <span className="mx-1 inline-block min-w-10 rounded-md border-2 border-dashed border-accent px-1 text-accent">?</span>}
                </span>
              ))}
            </div>
            {config.kind === "eighty" && (
              <div className="grid w-full max-w-sm grid-cols-2 gap-3 pt-2">
                {item.options.map((o, i) => (
                  <button
                    key={`${idx}-${i}`}
                    className="tabular flex min-h-16 items-center justify-center rounded-2xl border border-line bg-card text-2xl font-semibold active:scale-[0.97] active:bg-card2"
                    onClick={() => pick(i)}
                    data-testid={`drill-opt-${i}`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {config.kind === "sprint" && phase !== "done" && (
          <input
            ref={inputRef}
            className={`tabular w-44 rounded-xl border-2 bg-card px-3 py-2 text-center text-3xl outline-none focus:border-accent ${phase === "run" ? "border-line" : "pointer-events-none absolute opacity-0"}`}
            inputMode="decimal"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            placeholder="Answer"
            value={typed}
            onChange={(e) => onType(e.target.value)}
            onBlur={() => phase === "run" && setTimeout(() => inputRef.current?.focus(), 0)}
            aria-label="Answer"
            data-testid="drill-input"
          />
        )}

        {phase === "done" && <Results config={config} answers={answers} onAgain={onAgain} onExit={onExit} />}
      </div>
    </div>
  );
}

function Results({ config, answers, onAgain, onExit }: { config: DrillConfig; answers: Answer[]; onAgain: () => void; onExit: () => void }) {
  const correct = answers.filter((a) => a.correct).length;
  const wrong = answers.filter((a) => a.correct === false).length;
  const avg = answers.length ? answers.reduce((s, a) => s + a.ms, 0) / answers.length / 1000 : 0;
  const review = config.kind === "eighty" ? answers.filter((a) => a.correct === false) : [...answers].sort((a, b) => b.ms - a.ms).slice(0, 5);
  return (
    <div className="flex w-full max-w-sm flex-1 flex-col overflow-y-auto py-2" data-testid="drill-results">
      <div className="text-center">
        <div className="text-sm text-muted">{config.kind === "eighty" ? "Net score" : "Score"}</div>
        <div className="tabular text-6xl font-bold" data-testid="drill-score">
          {config.kind === "eighty" ? correct - wrong : correct}
        </div>
        <div className="tabular mt-1 text-sm text-muted">
          {config.kind === "eighty"
            ? `${correct} right · ${wrong} wrong · ${config.count - answers.length} not reached · ${avg.toFixed(1)} s each`
            : `${avg.toFixed(1)} s per answer`}
        </div>
        {config.kind === "eighty" && config.count === 80 && (
          <p className="mt-2 text-xs text-muted">Reported pass lines are ~55 net, with 70+ competitive (candidate reports, unconfirmed).</p>
        )}
      </div>
      {review.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{config.kind === "eighty" ? "Mistakes" : "Slowest"}</div>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card text-sm">
            {review.map((a, i) => (
              <li key={i} className="flex items-center gap-3 px-3 py-2">
                <span className="tabular flex-1">
                  {a.item.prompt} = <b>{a.item.display}</b>
                </span>
                <span className="tabular text-xs text-muted">
                  {config.kind === "eighty" ? `you: ${a.item.options[a.response as number]}` : `${(a.ms / 1000).toFixed(1)} s`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
        <button className="btn min-h-12" onClick={onExit}>
          Done
        </button>
        <button className="btn btn-primary min-h-12" onClick={onAgain} data-testid="drill-again">
          Again
        </button>
      </div>
    </div>
  );
}
