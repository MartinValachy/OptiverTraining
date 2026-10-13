"use client";

import { useEffect, useRef, useState } from "react";
import type { Attempt, Difficulty, ItemKey, ItemResult, SkillRow } from "@/modules/types";
import { useExamClock, useHotkeys, useTick } from "@/lib/hooks";
import { randomSeed } from "@/lib/rng";
import { uuid } from "@/lib/ids";
import { getSkills } from "@/lib/db/local";
import { chooseDifficulty, familyKey, updateSkill, weakness } from "@/lib/engine/elo";
import { recordAttempt } from "@/lib/engine/record";
import { formatClock } from "@/lib/clock";
import { ExamHeader, Pill, ResultTag, secs } from "@/components/ui";
import type { QuestionModule, ScoreResult } from "./types";

interface Current<I, R> {
  key: ItemKey;
  item: I;
  draft: R | null;
  shownAt: number;
  hint: boolean;
  result: (ScoreResult & { response: R | null; ms: number }) | null;
  error: string | null;
}

export function TrainingRunner<I, R>({
  mod,
  families,
  difficulty = "auto",
  softLimitMs,
  count,
  onDone,
  onQuit,
  title,
}: {
  mod: QuestionModule<I, R>;
  families: string[];
  difficulty?: "auto" | Difficulty;
  softLimitMs?: number | null;
  /** stop after this many items (Today session); undefined = endless */
  count?: number;
  onDone?: (stats: { n: number; correct: number }) => void;
  onQuit?: () => void;
  title?: string;
}) {
  const clock = useExamClock();
  const skills = useRef<Map<string, SkillRow>>(new Map());
  const [attempt] = useState(() => ({ id: uuid(), started: new Date().toISOString() }));
  const [cur, setCur] = useState<Current<I, R> | null>(null);
  const [now, setNow] = useState(0);
  const [stats, setStats] = useState({ n: 0, correct: 0, score: 0 });
  const lastFamily = useRef<string | null>(null);

  function pickKey(): ItemKey {
    let fams = families;
    if (fams.length > 1 && lastFamily.current) fams = fams.filter((f) => f !== lastFamily.current);
    const weights = fams.map((f) => Math.max(0.2, weakness(skills.current.get(familyKey(mod.id, f)))));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let family = fams[fams.length - 1];
    for (let i = 0; i < fams.length; i++) {
      r -= weights[i];
      if (r < 0) {
        family = fams[i];
        break;
      }
    }
    lastFamily.current = family;
    const rating = skills.current.get(familyKey(mod.id, family))?.rating ?? 1000;
    const d = difficulty === "auto" ? chooseDifficulty(rating) : difficulty;
    return { module: mod.id, family, difficulty: d, seed: randomSeed() };
  }

  function load(): Current<I, R> {
    const key = pickKey();
    const item = mod.generate(key.family, key.difficulty, key.seed);
    return { key, item, draft: mod.initialDraft ? mod.initialDraft(item) : null, shownAt: clock.now(), hint: false, result: null, error: null };
  }

  useEffect(() => {
    let alive = true;
    getSkills()
      .then((rows) => {
        skills.current = new Map(rows.map((r) => [r.family, r]));
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setCur(load());
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useTick(() => setNow(clock.now()), 250, !!cur && !cur.result);

  function answer(response: R | null) {
    if (!cur || cur.result) return;
    if (response !== null && mod.validate) {
      const err = mod.validate(response, cur.item);
      if (err) {
        setCur({ ...cur, error: err });
        return;
      }
    }
    const ms = Math.round(clock.now() - cur.shownAt);
    const sc = mod.score(cur.item, response);
    setCur({ ...cur, result: { ...sc, response, ms }, error: null });
    const next = { n: stats.n + 1, correct: stats.correct + (sc.correct ? 1 : 0), score: stats.score + sc.score };
    setStats(next);
    const row: ItemResult = {
      id: uuid(),
      attempt_id: attempt.id,
      module: mod.id,
      family: cur.key.family,
      difficulty: cur.key.difficulty,
      seed: cur.key.seed,
      response,
      correct: sc.correct,
      score: sc.score,
      ms_taken: ms,
      created_at: new Date().toISOString(),
    };
    const a: Attempt = {
      id: attempt.id,
      module: mod.id,
      mode: "training",
      config: { families, difficulty },
      started_at: attempt.started,
      finished_at: row.created_at,
      score: Math.round(next.score * 1000) / 1000,
      max_score: next.n,
    };
    const k = familyKey(mod.id, cur.key.family);
    skills.current.set(k, updateSkill(skills.current.get(k), k, [row]));
    recordAttempt(a, [row]);
  }

  function nextItem() {
    if (count !== undefined && stats.n >= count) {
      onDone?.({ n: stats.n, correct: stats.correct });
      return;
    }
    setCur(load());
  }

  useHotkeys(
    (e) => {
      if (!cur) return;
      const k = e.key.toLowerCase();
      if (cur.result) {
        if (e.key === "Enter" || k === "n") {
          e.preventDefault();
          nextItem();
        }
        return;
      }
      if (k === "s") {
        e.preventDefault();
        answer(null);
      } else if (k === "h") {
        setCur({ ...cur, hint: true });
      } else if (e.key === "Enter" && mod.canSubmit?.(cur.draft, cur.item)) {
        e.preventDefault();
        answer(cur.draft);
      }
    },
    [cur, stats],
  );

  if (!cur) return <div className="py-10 text-center text-muted">Loading…</div>;
  const elapsed = Math.max(0, now - cur.shownAt);
  const over = softLimitMs ? elapsed > softLimitMs : false;
  const famName = mod.families.find((f) => f.id === cur.key.family)?.name ?? cur.key.family;

  return (
    <div>
      <ExamHeader
        title={title ?? `${mod.title} · training`}
        progress={`${stats.n} done · ${stats.correct} correct${count ? ` · ${Math.min(stats.n + (cur.result ? 0 : 1), count)}/${count}` : ""}`}
        onQuit={onQuit}
      >
        {softLimitMs ? (
          <div className={`tabular rounded-lg border px-2 py-1 font-mono text-sm ${over ? "border-warn text-warn" : "border-line text-muted"}`} aria-label="soft timer">
            {cur.result ? secs(cur.result.ms) : over ? `+${formatClock(elapsed - softLimitMs)}` : formatClock(softLimitMs - elapsed)}
          </div>
        ) : null}
      </ExamHeader>
      <div className="mb-2 flex flex-wrap items-center gap-1">
        <Pill>{famName}</Pill>
        <Pill>level {cur.key.difficulty}</Pill>
        <span className="ml-auto text-[10px] text-muted">seed {cur.key.seed}</span>
      </div>
      <mod.View
        key={`${cur.key.seed}-${cur.key.family}`}
        item={cur.item}
        mode="training"
        index={stats.n}
        response={cur.result ? cur.result.response : null}
        draft={cur.draft}
        setDraft={(d) => setCur((c) => (c && !c.result ? { ...c, draft: d, error: null } : c))}
        submit={answer}
        locked={!!cur.result}
        ctx={{ families, mode: "training" }}
      />
      {cur.error && (
        <div className="mt-3 rounded-lg border border-bad px-3 py-2 text-sm text-bad" role="alert">
          {cur.error}
        </div>
      )}
      {!cur.result ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn" onClick={() => setCur({ ...cur, hint: true })} disabled={cur.hint}>
            Hint <span className="kbd">H</span>
          </button>
          <button className="btn" onClick={() => answer(null)}>
            Skip <span className="kbd">S</span>
          </button>
          {mod.canSubmit && (
            <button className="btn btn-primary flex-1" disabled={!mod.canSubmit(cur.draft, cur.item)} onClick={() => answer(cur.draft)}>
              Check <span className="kbd">Enter</span>
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="card flex flex-wrap items-center gap-2 p-3">
            <ResultTag correct={cur.result.correct} />
            <span className="text-sm">
              Answer: <b className="tabular">{mod.answerLabel(cur.item)}</b>
            </span>
            {cur.result.correct === false && (
              <span className="text-sm text-muted">· you: {mod.responseLabel(cur.item, cur.result.response)}</span>
            )}
            <span className="ml-auto text-xs text-muted">{secs(cur.result.ms)}</span>
          </div>
          <div className="card p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Worked solution</div>
            <mod.Solution item={cur.item} response={cur.result.response} />
          </div>
          <button className="btn btn-primary w-full" onClick={nextItem} data-testid="next">
            {count !== undefined && stats.n >= count ? "Finish block" : "Next"} <span className="kbd">Enter</span>
          </button>
        </div>
      )}
      {cur.hint && !cur.result && (
        <div className="mt-3 rounded-lg border border-line bg-card2 px-3 py-2 text-sm">
          <span className="text-muted">Hint: </span>
          {mod.hint(cur.item)}
        </div>
      )}
    </div>
  );
}
