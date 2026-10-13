"use client";

import type { ItemViewProps, QuestionModule } from "@/components/exam/types";
import { useHotkeys } from "@/lib/hooks";
import { Steps } from "@/components/ui";
import { generateNL, NL_FAMILIES, scoreNL, type NLItem } from "./generate";

function View({ item, mode, response, submit, locked }: ItemViewProps<NLItem, number>) {
  useHotkeys(
    (e) => {
      if (locked) return;
      const k = Number(e.key);
      if (k >= 1 && k <= 5) {
        e.preventDefault();
        submit(k - 1);
      }
    },
    [locked, submit],
  );
  return (
    <div>
      <div className="card mb-3 p-4">
        <div className="mb-2 text-xs text-muted">What comes next?</div>
        <div className="flex flex-wrap items-center gap-2" data-testid="nl-terms">
          {item.terms.map((t, i) => (
            <span key={i} className="tabular rounded-md bg-card2 px-2 py-1 font-mono text-lg">
              {t}
            </span>
          ))}
          <span className="rounded-md border border-dashed border-accent px-3 py-1 font-mono text-lg text-accent">?</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {item.options.map((o, i) => {
          const committed = response === i;
          const isCorrect = locked && i === item.correctIndex;
          const isWrong = locked && committed && i !== item.correctIndex;
          return (
            <button
              key={i}
              disabled={locked}
              onClick={() => submit(i)}
              data-testid={`card-${i}`}
              className={`tabular flex min-h-14 flex-col items-center justify-center rounded-xl border font-mono text-lg ${
                isCorrect ? "border-good bg-good/10" : isWrong ? "border-bad bg-bad/10" : committed ? "border-accent bg-accent/10" : "border-line bg-card"
              }`}
            >
              {o.label}
              <span className="kbd">{i + 1}</span>
            </button>
          );
        })}
      </div>
      {mode === "exam" && <p className="mt-2 text-xs text-muted">Tapping a card saves it and moves on. You can come back until you submit.</p>}
    </div>
  );
}

function Solution({ item }: { item: NLItem; response: number | null }) {
  return (
    <div className="space-y-2 text-sm">
      <p>
        Rule: <b>{item.rule}</b>
      </p>
      <Steps lines={item.derivation} />
    </div>
  );
}

export const numberLogicModule: QuestionModule<NLItem, number> = {
  id: "numberlogic",
  title: "NumberLogic",
  families: NL_FAMILIES,
  generate: generateNL,
  score: (item, r) => scoreNL(item, r),
  View,
  Solution,
  hint: (item) => item.hint,
  describe: (item) => `${item.terms.join(", ")}, ?`,
  answerLabel: (item) => item.answerLabel,
  responseLabel: (item, r) => (r === null ? "skipped" : item.options[r].label),
};
