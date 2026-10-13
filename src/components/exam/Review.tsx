"use client";

import Link from "next/link";
import type { Mode } from "@/modules/types";
import { Collapsible, ResultTag, Section, Stat, pct, secs } from "@/components/ui";
import type { QuestionModule } from "./types";
import type { ExamResultBundle } from "./ExamRunner";

export function Review<I, R>({
  mod,
  bundle,
  mode,
  endedBy,
  actions,
}: {
  mod: QuestionModule<I, R>;
  bundle: ExamResultBundle<I, R>;
  mode: Mode;
  endedBy?: string | null;
  actions?: React.ReactNode;
}) {
  const { results, attempt } = bundle;
  const answered = results.filter((r) => r.correct !== null);
  const correct = results.filter((r) => r.correct === true).length;
  const totalMs = results.reduce((a, r) => a + r.msTaken, 0);
  return (
    <div data-testid="review">
      <h1 className="mb-1 text-xl font-semibold">{mod.title} · review</h1>
      <p className="mb-4 text-sm text-muted">
        {mode === "exam" ? "Exam mode" : "Training"}
        {endedBy === "cap" ? " · ended by the overall time cap" : ""}
      </p>
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Score" value={<span data-testid="final-score">{fmtScore(attempt.score)}</span>} sub={`of ${attempt.max_score}`} />
        <Stat label="Accuracy (answered)" value={answered.length ? pct(correct / answered.length) : "–"} sub={`${correct}/${answered.length}`} />
        <Stat label="Skipped / unanswered" value={pct((results.length - answered.length) / Math.max(1, results.length))} sub={`${results.length - answered.length} items`} />
        <Stat label="Avg time / item" value={secs(totalMs / Math.max(1, results.length))} />
      </div>
      {mod.ReviewSummary && <mod.ReviewSummary results={results} mode={mode} />}
      <Section title="Items">
        <div className="space-y-2">
          {results.map((r, i) => (
            <Collapsible
              key={i}
              title={
                <div className="flex items-center gap-2">
                  <span className="tabular w-6 text-xs text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{mod.describe(r.item)}</span>
                  <ResultTag correct={r.correct} />
                </div>
              }
            >
              <div className="mb-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-muted">Your answer</div>
                  <div className="tabular">{mod.responseLabel(r.item, r.response)}{r.timedOut ? " (time ran out)" : ""}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Correct</div>
                  <div className="tabular">{mod.answerLabel(r.item)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Score</div>
                  <div className="tabular">{fmtScore(r.score)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Time</div>
                  <div className="tabular">{secs(r.msTaken)}</div>
                </div>
              </div>
              <mod.Solution item={r.item} response={r.response} />
            </Collapsible>
          ))}
        </div>
      </Section>
      <div className="flex flex-wrap gap-2">
        {actions ?? (
          <>
            <Link href="/" className="btn">
              Home
            </Link>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function fmtScore(x: number): string {
  return Number.isInteger(x) ? String(x) : x.toFixed(2);
}
