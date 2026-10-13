"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Attempt, ItemKey, ItemResult } from "@/modules/types";
import { useExamClock, useHotkeys, useTick } from "@/lib/hooks";
import { uuid } from "@/lib/ids";
import { recordAttempt } from "@/lib/engine/record";
import { ConfirmQuit, ExamHeader, TimerBadge } from "@/components/ui";
import type { QuestionModule, Scored } from "./types";
import { Review } from "./Review";

export interface ExamTiming {
  perQuestionMs: number | null;
  totalMs: number | null;
}

interface RunState<R> {
  index: number;
  enteredAt: number;
  responses: (R | null)[];
  drafts: (R | null)[];
  answered: boolean[];
  ms: number[];
  timedOut: boolean[];
  done: boolean;
  endedBy: "complete" | "cap" | "submit" | null;
  now: number;
  error: string | null;
}

export interface ExamResultBundle<I, R> {
  attempt: Attempt;
  results: Scored<I, R>[];
}

/**
 * Generic exam runner.
 * - navigation "forward": no going back; per-question and/or total timers (BTO, Likelihood, Intervals, Orderbooks, warm-up)
 * - navigation "free": BACK/SKIP, answers changeable until "Save and submit" (NumberLogic)
 */
export function ExamRunner<I, R>({
  mod,
  keys,
  timing,
  navigation = "forward",
  config,
  onFinished,
  onQuit,
  persist = true,
  showReview = true,
  startedAt,
}: {
  mod: QuestionModule<I, R>;
  keys: ItemKey[];
  timing: ExamTiming;
  navigation?: "forward" | "free";
  config: Record<string, unknown>;
  onFinished?: (b: ExamResultBundle<I, R>) => void;
  onQuit?: () => void;
  persist?: boolean;
  showReview?: boolean;
  startedAt?: string;
}) {
  const items = useMemo(() => keys.map((k) => mod.generate(k.family, k.difficulty, k.seed)), [keys, mod]);
  const n = keys.length;
  const clock = useExamClock();
  const [st, setSt] = useState<RunState<R>>(() => ({
    index: 0,
    enteredAt: 0,
    responses: new Array(n).fill(null),
    drafts: items.map((it) => (mod.initialDraft ? mod.initialDraft(it) : null)),
    answered: new Array(n).fill(false),
    ms: new Array(n).fill(0),
    timedOut: new Array(n).fill(false),
    done: false,
    endedBy: null,
    now: 0,
    error: null,
  }));
  const [startIso] = useState(() => startedAt ?? new Date().toISOString());
  const [quitting, setQuitting] = useState(false);
  const [bundle, setBundle] = useState<ExamResultBundle<I, R> | null>(null);
  const saved = useRef(false);

  const timeout = (draft: R | null, item: I) => (mod.onTimeout ? mod.onTimeout(draft, item) : null);

  function process(s: RunState<R>, now: number): RunState<R> {
    if (s.done) return s.now === now ? s : { ...s, now };
    const x = { ...s, responses: s.responses.slice(), ms: s.ms.slice(), timedOut: s.timedOut.slice(), answered: s.answered.slice(), now };
    if (navigation === "forward" && timing.perQuestionMs !== null) {
      while (!x.done && now >= x.enteredAt + timing.perQuestionMs && (timing.totalMs === null || x.enteredAt + timing.perQuestionMs <= timing.totalMs)) {
        const i = x.index;
        x.responses[i] = timeout(x.drafts[i], items[i]);
        x.answered[i] = x.responses[i] !== null;
        x.ms[i] += timing.perQuestionMs;
        x.timedOut[i] = true;
        x.enteredAt += timing.perQuestionMs;
        x.index++;
        x.error = null;
        if (x.index >= n) {
          x.done = true;
          x.endedBy = "complete";
        }
      }
    }
    if (!x.done && timing.totalMs !== null && now >= timing.totalMs) {
      const i = Math.min(x.index, n - 1);
      if (navigation === "forward") {
        x.responses[i] = timeout(x.drafts[i], items[i]);
        x.answered[i] = x.responses[i] !== null;
        x.timedOut[i] = true;
      }
      x.ms[i] += Math.max(0, timing.totalMs - x.enteredAt);
      x.done = true;
      x.endedBy = "cap";
    }
    return x;
  }

  useTick(() => setSt((s) => process(s, clock.now())), 200, !st.done);

  function advance(s: RunState<R>, now: number, to: number): RunState<R> {
    const x = { ...s, ms: s.ms.slice(), now, error: null };
    if (x.index < n) x.ms[x.index] += now - x.enteredAt;
    x.index = to;
    x.enteredAt = now;
    if (navigation === "forward" && to >= n) {
      x.done = true;
      x.endedBy = "complete";
    }
    return x;
  }

  const submit = (r: R | null) =>
    setSt((s0) => {
      const s = process(s0, clock.now());
      if (s.done || s.index >= n) return s;
      const err = r !== null && mod.validate ? mod.validate(r, items[s.index]) : null;
      if (err) return { ...s, error: err };
      const responses = s.responses.slice();
      const answered = s.answered.slice();
      responses[s.index] = r;
      answered[s.index] = r !== null;
      return advance({ ...s, responses, answered }, s.now, s.index + 1);
    });

  const skip = () =>
    setSt((s0) => {
      const s = process(s0, clock.now());
      if (s.done || s.index >= n) return s;
      if (navigation === "forward") {
        const responses = s.responses.slice();
        responses[s.index] = null;
        return advance({ ...s, responses }, s.now, s.index + 1);
      }
      return advance(s, s.now, Math.min(n, s.index + 1));
    });

  const go = (i: number) =>
    setSt((s0) => {
      const s = process(s0, clock.now());
      if (s.done || navigation !== "free") return s;
      return advance(s, s.now, Math.max(0, Math.min(n, i)));
    });

  const finishNow = () =>
    setSt((s0) => {
      const s = process(s0, clock.now());
      if (s.done) return s;
      const x = advance(s, s.now, s.index);
      return { ...x, done: true, endedBy: "submit" };
    });

  const setDraft = (r: R | null) =>
    setSt((s) => {
      if (s.done || s.index >= n) return s;
      const drafts = s.drafts.slice();
      drafts[s.index] = r;
      return { ...s, drafts, error: null };
    });

  useHotkeys(
    (e) => {
      if (st.done || quitting) return;
      const k = e.key.toLowerCase();
      if (k === "s") {
        e.preventDefault();
        skip();
      } else if (e.key === "Enter" && mod.canSubmit && st.index < n) {
        const d = st.drafts[st.index];
        if (mod.canSubmit(d, items[st.index])) {
          e.preventDefault();
          submit(d);
        }
      } else if (navigation === "free" && e.key === "ArrowLeft") {
        go(st.index - 1);
      } else if (navigation === "free" && e.key === "ArrowRight") {
        go(st.index + 1);
      }
    },
    [st, quitting],
  );

  // Persist once when done.
  useEffect(() => {
    if (!st.done || saved.current) return;
    saved.current = true;
    const attemptId = uuid();
    const finished = new Date().toISOString();
    const results: Scored<I, R>[] = keys.map((key, i) => {
      const response = st.responses[i];
      const sc = mod.score(items[i], response);
      return { key, item: items[i], response, correct: sc.correct, score: sc.score, msTaken: Math.round(st.ms[i]), timedOut: st.timedOut[i] };
    });
    const score = results.reduce((a, r) => a + r.score, 0);
    const attempt: Attempt = {
      id: attemptId,
      module: mod.id,
      mode: "exam",
      config: { ...config, endedBy: st.endedBy },
      started_at: startIso,
      finished_at: finished,
      score: Math.round(score * 1000) / 1000,
      max_score: n,
    };
    const rows: ItemResult[] = results.map((r) => ({
      id: uuid(),
      attempt_id: attemptId,
      module: mod.id,
      family: r.key.family,
      difficulty: r.key.difficulty,
      seed: r.key.seed,
      response: r.response,
      correct: r.correct,
      score: r.score,
      ms_taken: r.msTaken,
      created_at: finished,
    }));
    const b = { attempt, results };
    queueMicrotask(() => setBundle(b));
    if (persist) recordAttempt(attempt, rows);
    onFinished?.(b);
  }, [st.done, st.endedBy, st.responses, st.ms, st.timedOut, keys, items, mod, config, persist, onFinished, startIso, n]);

  if (st.done) {
    if (!showReview) return <div className="py-10 text-center text-muted">Saving…</div>;
    return bundle ? <Review mod={mod} bundle={bundle} mode="exam" endedBy={st.endedBy} /> : null;
  }

  const qRemain = timing.perQuestionMs !== null && navigation === "forward" ? Math.max(0, st.enteredAt + timing.perQuestionMs - st.now) : null;
  const totalRemain = timing.totalMs !== null ? Math.max(0, timing.totalMs - st.now) : null;
  const atSummary = navigation === "free" && st.index >= n;
  const i = Math.min(st.index, n - 1);
  const draft = st.drafts[i];
  const answeredCount = st.answered.filter(Boolean).length;

  return (
    <div>
      <ExamHeader
        title={mod.title}
        progress={atSummary ? `Review answers · ${answeredCount}/${n} answered` : `Question ${i + 1} / ${n}`}
        onQuit={onQuit ? () => setQuitting(true) : undefined}
      >
        {qRemain !== null && <TimerBadge ms={qRemain} label="Question" testId="timer-question" />}
        {totalRemain !== null && <TimerBadge ms={totalRemain} label="Total" warnBelowMs={60_000} testId="timer-total" />}
      </ExamHeader>

      {navigation === "free" && (
        <div className="mb-3 flex gap-1 overflow-x-auto pb-1" aria-label="Question navigator">
          {keys.map((_, j) => (
            <button
              key={j}
              onClick={() => go(j)}
              className={`tabular flex h-8 min-w-8 items-center justify-center rounded-md border text-xs ${
                j === st.index ? "border-accent text-accent" : st.answered[j] ? "border-line bg-card2" : "border-line text-muted"
              }`}
              aria-label={`Go to question ${j + 1}`}
            >
              {j + 1}
            </button>
          ))}
        </div>
      )}

      {atSummary ? (
        <div className="card p-4">
          <p className="mb-2 text-sm">
            {answeredCount} of {n} answered. You can still go back and change answers until you submit.
          </p>
          <p className="mb-4 text-xs text-muted">Unanswered sequences score 0; wrong answers score −1.</p>
          <div className="flex gap-2">
            <button className="btn" onClick={() => go(n - 1)}>
              ← Back
            </button>
            <button className="btn btn-primary flex-1" onClick={finishNow} data-testid="save-submit">
              Save and submit
            </button>
          </div>
        </div>
      ) : (
        <>
          <mod.View
            key={i}
            item={items[i]}
            mode="exam"
            index={i}
            response={st.responses[i]}
            draft={draft}
            setDraft={setDraft}
            submit={submit}
            locked={false}
          />
          {st.error && (
            <div className="mt-3 rounded-lg border border-bad px-3 py-2 text-sm text-bad" role="alert" data-testid="exam-error">
              {st.error}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            {navigation === "free" && (
              <button className="btn" onClick={() => go(st.index - 1)} disabled={st.index === 0} data-testid="back">
                ← Back
              </button>
            )}
            <button className="btn" onClick={skip} data-testid="skip">
              Skip <span className="kbd">S</span>
            </button>
            {mod.canSubmit && (
              <button
                className="btn btn-primary flex-1"
                disabled={!mod.canSubmit(draft, items[i])}
                onClick={() => submit(draft)}
                data-testid="submit"
              >
                Submit <span className="kbd">Enter</span>
              </button>
            )}
            {navigation === "free" && (
              <button className="btn ml-auto" onClick={() => go(n)} data-testid="to-summary">
                Finish…
              </button>
            )}
          </div>
        </>
      )}
      {quitting && (
        <ConfirmQuit
          onCancel={() => setQuitting(false)}
          onConfirm={() => {
            setQuitting(false);
            onQuit?.();
          }}
        />
      )}
    </div>
  );
}
