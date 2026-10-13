"use client";

import { useEffect, useRef } from "react";
import type { QuestionModule, ItemViewProps } from "@/components/exam/types";
import { checkWarmup, generateWarmup, WARMUP_FAMILIES, type WarmupItem } from "./logic";

function View({ item, draft, setDraft, submit, locked, response }: ItemViewProps<WarmupItem, string>) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [item]);
  const value = locked ? (response ?? "") : (draft ?? "");
  return (
    <div className="card p-5">
      <div className="mb-4 text-center font-mono text-3xl font-semibold tabular" data-testid="warmup-prompt">
        {item.prompt}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!locked && value.trim()) submit(value.trim());
        }}
        className="flex gap-2"
      >
        <input
          ref={ref}
          className="input text-center text-xl"
          inputMode={item.format === "fraction" ? "text" : "decimal"}
          autoComplete="off"
          autoCorrect="off"
          enterKeyHint="go"
          placeholder={item.format === "fraction" ? "a/b" : "answer"}
          value={value}
          disabled={locked}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Answer"
          data-testid="warmup-input"
        />
        {item.format === "fraction" && !locked && (
          <button type="button" className="btn" onClick={() => setDraft((draft ?? "") + "/")}>
            /
          </button>
        )}
      </form>
    </div>
  );
}

function Solution({ item }: { item: WarmupItem; response: string | null }) {
  return (
    <p className="text-sm">
      {item.prompt} = <b className="tabular">{item.display}</b>
      {item.tol > 0 ? " (rounded; ±0.0005 accepted)" : ""}
    </p>
  );
}

export const warmupModule: QuestionModule<WarmupItem, string> = {
  id: "warmup",
  title: "Mental-math warm-up",
  families: WARMUP_FAMILIES,
  generate: generateWarmup,
  score(item, r) {
    const c = checkWarmup(item, r);
    return { correct: c, score: c ? 1 : 0 };
  },
  // shared-clock module: an unsubmitted entry is not counted
  canSubmit: (d) => !!d && d.trim() !== "",
  View,
  Solution,
  hint: (item) =>
    item.family === "pct"
      ? "Convert the percentage to a fraction first (e.g. 12.5% = 1/8)."
      : item.family === "frac"
        ? "Memorise eighths (0.125 steps) and twelfths; scale numerator and denominator to a power of 10."
        : "Split into round numbers: a × b = a × (round − diff).",
  describe: (item) => item.prompt,
  answerLabel: (item) => item.display,
  responseLabel: (_i, r) => r ?? "—",
};
