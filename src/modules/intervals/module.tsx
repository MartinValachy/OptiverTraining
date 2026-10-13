"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis, Legend } from "recharts";
import type { ItemViewProps, QuestionModule, Scored } from "@/components/exam/types";
import { VisualView } from "@/components/VisualView";
import { Section, Stat, Steps, pct } from "@/components/ui";
import type { Mode } from "@/modules/types";
import { IV_FAMILIES, generateInterval, parseBound, scoreIfHit, scoreInterval, validateInterval, type IntervalItem, type IntervalResponse } from "./generate";

function unitSuffix(item: IntervalItem) {
  return item.unit === "num" ? "" : "%";
}

function View({ item, mode, draft, setDraft, submit, locked, response }: ItemViewProps<IntervalItem, IntervalResponse>) {
  const v = (locked ? response : draft) ?? { lower: "", upper: "" };
  const err = v.lower || v.upper ? validateInterval(v, item.unit) : null;
  const lo = parseBound(v.lower);
  const hi = parseBound(v.upper);
  const live = !err && lo && hi ? scoreIfHit(lo, hi) : null;
  const set = (k: keyof IntervalResponse, val: string) => setDraft({ ...v, [k]: val });
  return (
    <div>
      <div className="card mb-3 space-y-3 p-4">
        <p className="text-[15px] leading-relaxed" data-testid="iv-text">
          {item.text}
        </p>
        {item.visual && <VisualView v={item.visual} />}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!locked && !validateInterval(v, item.unit)) submit(v);
        }}
      >
        <div className="flex items-end gap-2">
          {(["lower", "upper"] as const).map((k) => (
            <label key={k} className="flex-1 text-xs text-muted">
              {k === "lower" ? "Lower" : "Upper"}
              {item.unit === "prob" ? " (0–100)" : ""}
              <div className="relative mt-1">
                <input
                  className="input pr-7"
                  inputMode="decimal"
                  autoComplete="off"
                  enterKeyHint={k === "lower" ? "next" : "go"}
                  value={v[k]}
                  disabled={locked}
                  onChange={(e) => set(k, e.target.value)}
                  aria-label={`${k} bound`}
                  data-testid={`iv-${k}`}
                />
                {unitSuffix(item) && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">%</span>}
              </div>
            </label>
          ))}
          <button type="submit" className="sr-only" tabIndex={-1}>
            submit
          </button>
        </div>
      </form>
      <div className="mt-2 flex min-h-6 items-center justify-between text-sm">
        {err ? (
          <span className="text-bad" role="alert">
            {err}
          </span>
        ) : (
          <span className="text-muted">
            Score if correct: <b className="tabular text-fg" data-testid="iv-live">{live === null ? "–" : pct(live, 1)}</b>
          </span>
        )}
        {locked && <span className="tabular text-muted">truth {item.truthLabel}</span>}
      </div>
      {mode === "training" && !locked && (
        <p className="mt-2 rounded-lg bg-card2 px-3 py-2 text-xs text-muted">
          Score = lower ÷ upper if the truth is inside, else 0. Lower = 0 always scores 0; [x, x] scores 100% only if exact; for equal width, a higher interval scores more.
        </p>
      )}
    </div>
  );
}

function Solution({ item, response }: { item: IntervalItem; response: IntervalResponse | null }) {
  const sc = scoreInterval(item, response);
  return (
    <div className="space-y-2 text-sm">
      <p>
        Truth: <b className="tabular">{item.truthLabel}</b>
        {response && (
          <span className="text-muted">
            {" "}
            · your interval [{response.lower}, {response.upper}]{unitSuffix(item)} → {sc.correct ? `hit, score ${pct(sc.score, 1)}` : "miss, score 0"}
          </span>
        )}
      </p>
      <Steps lines={item.solution} />
      <p className="text-xs text-muted">Tip: {item.hint}</p>
    </div>
  );
}

const BUCKETS = [
  { lo: 0, hi: 0.1, name: "<10%" },
  { lo: 0.1, hi: 0.25, name: "10–25%" },
  { lo: 0.25, hi: 0.5, name: "25–50%" },
  { lo: 0.5, hi: 1.01, name: "≥50%" },
];

export function calibration(results: { response: IntervalResponse | null; correct: boolean | null; score: number }[]) {
  const pts = results
    .filter((r) => r.response && r.correct !== null)
    .map((r) => {
      const lo = parseBound(r.response!.lower)!.toNumber();
      const hi = parseBound(r.response!.upper)!.toNumber();
      return { width: hi > 0 ? (hi - lo) / hi : 1, hit: !!r.correct, score: r.score };
    });
  const buckets = BUCKETS.map((b) => {
    const xs = pts.filter((p) => p.width >= b.lo && p.width < b.hi);
    return { name: b.name, n: xs.length, hitRate: xs.length ? xs.filter((p) => p.hit).length / xs.length : 0, avgScore: xs.length ? xs.reduce((a, p) => a + p.score, 0) / xs.length : 0 };
  });
  const hitRate = pts.length ? pts.filter((p) => p.hit).length / pts.length : 0;
  const avgWidth = pts.length ? pts.reduce((a, p) => a + p.width, 0) / pts.length : 0;
  let advice: string;
  if (pts.length < 3) advice = "Answer more questions to get calibration advice.";
  else if (hitRate >= 0.85 && avgWidth > 0.3) advice = `Too wide: you hit ${pct(hitRate)} of the time with intervals ${pct(avgWidth)} wide on average. Tighten them — every 10 points narrower is worth ~10% per hit.`;
  else if (hitRate < 0.6) advice = `Too narrow: only ${pct(hitRate)} of your intervals contained the truth. A miss scores 0, so widen until you hit about 75–85% of the time.`;
  else advice = `Reasonably calibrated: ${pct(hitRate)} hits at ${pct(avgWidth)} average width. Push widths down slightly while keeping hits ≥ 75%.`;
  return { pts, buckets, hitRate, avgWidth, advice };
}

function ReviewSummary({ results }: { results: Scored<IntervalItem, IntervalResponse>[]; mode: Mode }) {
  const c = calibration(results);
  return (
    <Section title="Calibration">
      <div className="mb-3 grid grid-cols-3 gap-2">
        <Stat label="Hit rate" value={pct(c.hitRate)} />
        <Stat label="Avg width" value={pct(c.avgWidth)} sub="(upper − lower) ÷ upper" />
        <Stat label="Mean score" value={pct(results.reduce((a, r) => a + r.score, 0) / Math.max(1, results.length))} />
      </div>
      <div className="card mb-2 h-56 p-2" data-testid="calibration-chart">
        <ResponsiveContainer>
          <ComposedChart data={c.buckets} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 11 }} />
            <YAxis domain={[0, 1]} tickFormatter={(x) => `${Math.round(x * 100)}%`} tick={{ fill: "var(--muted)", fontSize: 11 }} />
            <Bar dataKey="hitRate" name="hit rate" fill="#5b8cff" isAnimationActive={false} />
            <Line dataKey="avgScore" name="avg score" stroke="#2fbf71" strokeWidth={2} isAnimationActive={false} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="card p-3 text-sm" data-testid="calibration-advice">
        {c.advice}
      </p>
    </Section>
  );
}

export const intervalsModule: QuestionModule<IntervalItem, IntervalResponse> = {
  id: "intervals",
  title: "Intervals",
  families: IV_FAMILIES,
  generate: generateInterval,
  score: (item, r) => scoreInterval(item, r),
  // on timeout a valid typed interval is submitted, otherwise the question scores 0
  onTimeout: (draft, item) => (draft && !validateInterval(draft, item.unit) ? draft : null),
  canSubmit: (d, item) => !!d && !validateInterval(d, item.unit),
  View,
  Solution,
  ReviewSummary,
  hint: (item) => item.hint,
  describe: (item) => item.text,
  answerLabel: (item) => item.truthLabel,
  responseLabel: (item, r) => (r ? `[${r.lower}, ${r.upper}]${item.unit === "num" ? "" : "%"}` : "no answer"),
};
