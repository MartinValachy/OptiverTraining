"use client";

import type { ItemViewProps, QuestionModule, Scored } from "@/components/exam/types";
import { useHotkeys } from "@/lib/hooks";
import { Section, Stat, Steps, pct } from "@/components/ui";
import type { Mode } from "@/modules/types";
import { generateBto, BTO_FAMILY_INFO } from "./index";
import { scoreBto, type BtoItem } from "./core";

const LETTERS = ["A", "B", "C", "D", "E"];

function View({ item, mode, draft, setDraft, locked, response }: ItemViewProps<BtoItem, number>) {
  useHotkeys(
    (e) => {
      if (locked) return;
      const k = Number(e.key);
      if (k >= 1 && k <= 5) {
        e.preventDefault();
        setDraft(k - 1);
      }
    },
    [locked, setDraft],
  );
  const sel = locked ? response : draft;
  return (
    <div>
      <div className="card mb-3 p-4">
        <p className="text-[15px] leading-relaxed" data-testid="bto-text">
          {item.text}
        </p>
        <p className="mt-3 text-xs text-muted">Select the answer that is closest.</p>
      </div>
      <div className="grid gap-2" role="radiogroup" aria-label="Options">
        {item.options.map((o, i) => {
          const isSel = sel === i;
          const isCorrect = locked && i === item.correctIndex;
          const isWrong = locked && isSel && i !== item.correctIndex;
          return (
            <button
              key={i}
              role="radio"
              aria-checked={isSel}
              disabled={locked}
              onClick={() => setDraft(i)}
              data-testid={`option-${i}`}
              className={`flex min-h-12 items-center gap-3 rounded-lg border px-4 text-left transition-colors ${
                isCorrect ? "border-good bg-good/10" : isWrong ? "border-bad bg-bad/10" : isSel ? "border-accent bg-accent/10" : "border-line bg-card"
              }`}
            >
              <span className="w-5 text-xs text-muted">{mode === "exam" ? LETTERS[i] : i + 1}</span>
              <span className="tabular font-mono text-base">{o.label}</span>
              <span className="kbd ml-auto">{i + 1}</span>
            </button>
          );
        })}
      </div>
      {mode === "training" && !locked && (
        <p className="mt-2 text-xs text-muted">Pick an option, then Check. +1 correct, −1 wrong, 0 skip.</p>
      )}
      {draft !== null && !locked && mode === "exam" && <span className="sr-only">Selected {LETTERS[draft]}</span>}
    </div>
  );
}

function Solution({ item, response }: { item: BtoItem; response: number | null }) {
  return (
    <div className="space-y-3 text-sm">
      <p>
        Exact answer: <b className="tabular">{item.exactLabel}</b>
        {!item.exactIncluded && <span className="text-warn"> — not among the options; the closest option is correct.</span>}
      </p>
      <Steps lines={item.solution} />
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Where the other options come from</div>
        <ul className="space-y-1">
          {item.options.map((o, i) => (
            <li key={i} className={`flex gap-2 ${i === item.correctIndex ? "text-good" : i === response ? "text-bad" : ""}`}>
              <span className="tabular w-20 shrink-0 font-mono">{o.label}</span>
              <span className="text-muted">{i === item.correctIndex ? (item.exactIncluded ? "correct" : "closest to the exact value") : (o.why ?? "")}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ReviewSummary({ results, mode }: { results: Scored<BtoItem, number>[]; mode: Mode }) {
  const answered = results.filter((r) => r.correct !== null);
  const correct = answered.filter((r) => r.correct).length;
  const wrong = answered.length - correct;
  const acc = answered.length ? correct / answered.length : 0;
  const evPer = answered.length ? (correct - wrong) / answered.length : 0;
  const timedOutWithSel = results.filter((r) => r.timedOut && r.response === null).length;
  const rushed = answered.filter((r) => r.msTaken > 75_000);
  const rushedAcc = rushed.length ? rushed.filter((r) => r.correct).length / rushed.length : null;
  // EV of guessing after eliminating k options
  const elim = [0, 1, 2, 3].map((k) => ({ k, ev: 2 / (5 - k) - 1 }));
  return (
    <Section title="Guessing & EV analysis">
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Net score" value={correct - wrong} sub={`${correct} right − ${wrong} wrong`} />
        <Stat label="EV per answer" value={evPer.toFixed(2)} tone={evPer > 0 ? "good" : "bad"} sub="vs −0.60 blind guess" />
        <Stat label="Accuracy" value={pct(acc)} sub="break-even is 50%" tone={acc >= 0.5 ? "good" : "bad"} />
        <Stat label="Expired unanswered" value={timedOutWithSel} sub={mode === "exam" ? "a selection without Submit counts as skip" : ""} />
      </div>
      <div className="card p-3 text-sm leading-relaxed">
        <p className="mb-2">
          With +1 / −1 / 0 scoring, answering is worth it only when P(correct) &gt; 50%. A blind guess among 5 options has EV = 1/5 − 4/5 = <b>−0.60</b>.
        </p>
        <table className="mb-2 w-full text-xs">
          <thead>
            <tr className="text-muted">
              <th className="text-left font-normal">Options eliminated</th>
              {elim.map((e) => (
                <th key={e.k} className="font-normal">
                  {e.k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>EV of guessing the rest</td>
              {elim.map((e) => (
                <td key={e.k} className={`tabular text-center ${e.ev >= 0 ? "text-good" : "text-bad"}`}>
                  {e.ev.toFixed(2)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="text-muted">
          {answered.length === 0
            ? "You skipped everything: score 0. Answer the ones you can compute."
            : acc >= 0.75
              ? "Your answers are strongly +EV. Consider attempting more of the questions you skipped."
              : acc >= 0.5
                ? "Your answers are mildly +EV. Skip only when you cannot narrow to two options."
                : "Your answers are −EV: you would have scored more by skipping some. Only answer when you can eliminate at least three options or have computed the result."}
          {rushedAcc !== null && ` Answers given after 75 s: ${pct(rushedAcc)} accurate (${rushed.length}).`}
        </p>
      </div>
    </Section>
  );
}

export const btoModule: QuestionModule<BtoItem, number> = {
  id: "bto",
  title: "Beat The Odds",
  families: BTO_FAMILY_INFO,
  generate: generateBto,
  score: (item, r) => scoreBto(item, r),
  onTimeout: () => null, // an unsubmitted selection counts as a skip
  canSubmit: (d) => d !== null,
  View,
  Solution,
  ReviewSummary,
  hint: (item) => item.hint,
  describe: (item) => item.text,
  answerLabel: (item) => `${item.options[item.correctIndex].label}${item.exactIncluded ? "" : ` (exact ${item.exactLabel})`}`,
  responseLabel: (item, r) => (r === null ? "skipped" : item.options[r].label),
};
