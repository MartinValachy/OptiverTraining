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
    <div className="card px-4 py-6">
      <div className="tabular mb-5 text-center text-4xl font-semibold tracking-tight" data-testid="warmup-prompt">
        {item.prompt}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!locked && value.trim()) submit(value.trim());
        }}
        className="flex justify-center gap-2"
      >
        <input
          ref={ref}
          className="tabular w-48 rounded-xl border-2 border-line bg-card px-3 py-2 text-center text-3xl outline-none focus:border-accent"
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          enterKeyHint="go"
          placeholder="Answer"
          value={value}
          disabled={locked}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Answer"
          data-testid="warmup-input"
        />
        {!item.typeable && !locked && (
          <button type="button" className="btn text-xl" onClick={() => setDraft((draft ?? "") + "/")} aria-label="fraction bar">
            /
          </button>
        )}
      </form>
    </div>
  );
}

function Solution({ item }: { item: WarmupItem; response: string | null }) {
  return (
    <div className="space-y-1 text-sm">
      <p>
        {item.prompt.includes("?") ? item.prompt.replace("?", `[${item.display}]`) : `${item.prompt} = `}
        {!item.prompt.includes("?") && <b className="tabular">{item.display}</b>}
      </p>
      <p className="text-muted">{item.method}</p>
    </div>
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
  canSubmit: (d) => !!d && d.trim() !== "",
  View,
  Solution,
  hint: (item) =>
    item.family === "missing"
      ? "Turn it around: a missing factor is a division, a missing addend is a subtraction."
      : item.family === "frac"
        ? "“a/b of N”: divide by b first, then multiply by a."
        : item.family === "div"
          ? "Dividing by a decimal: scale both numbers by 10 until the divisor is whole."
          : "Split into round numbers and adjust.",
  describe: (item) => item.prompt,
  answerLabel: (item) => item.display,
  responseLabel: (_i, r) => r ?? "—",
};
