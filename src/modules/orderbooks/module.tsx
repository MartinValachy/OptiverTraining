"use client";

import type { ItemViewProps, QuestionModule } from "@/components/exam/types";
import { makeRng, seedFor } from "@/lib/rng";
import type { Difficulty, ItemKey } from "@/modules/types";
import { COMMODITIES, OB_FAMILIES, checkResponse, describeComp, generateOB, scoreOB, type OBItem, type OBResponse } from "./generate";
import { evaluateClicks } from "./solver";

const empty = (n: number): OBResponse => ({ buys: new Array(n).fill(0), sells: new Array(n).fill(0) });

function signed(n: number) {
  return n > 0 ? `+${n}` : String(n);
}

function noArbEnabled(ctx: Record<string, unknown> | undefined): boolean {
  if (!ctx) return false;
  if (typeof ctx.noArbShare === "number") return ctx.noArbShare > 0;
  return Array.isArray(ctx.families) && (ctx.families as string[]).includes("none");
}

function View({ item, mode, draft, setDraft, submit, locked, response, ctx }: ItemViewProps<OBItem, OBResponse>) {
  const n = item.cards.length;
  const st = (locked ? response : draft) ?? empty(n);
  const buys = st.buys.length ? st.buys : new Array(n).fill(0);
  const sells = st.sells.length ? st.sells : new Array(n).fill(0);
  const { inv, cash } = evaluateClicks({ nItems: item.items.length, cards: item.cards }, buys, sells);
  const flat = inv.every((v) => v === 0);
  const click = (k: number, side: "buys" | "sells") => {
    if (locked) return;
    const next = { buys: buys.slice(), sells: sells.slice() };
    next[side][k]++;
    setDraft(next);
  };
  const plan = locked ? item.simplest : null;
  return (
    <div>
      <div className="sticky top-[46px] z-10 -mx-1 mb-3 rounded-xl border border-line bg-bg/95 p-2 backdrop-blur" data-testid="ob-panel">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {item.items.map((ci, i) => (
            <span key={ci} className={`tabular ${inv[i] === 0 ? "text-muted" : inv[i] > 0 ? "text-good" : "text-bad"}`} data-testid={`ob-inv-${i}`}>
              {COMMODITIES[ci].name} {signed(inv[i])}
            </span>
          ))}
          <span className={`tabular ml-auto font-semibold ${cash > 0 ? "text-good" : cash < 0 ? "text-bad" : "text-muted"}`} data-testid="ob-cash">
            Cash {signed(cash)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs text-muted">{flat && cash > 0 ? "Valid arbitrage staged — submit it." : flat ? "Items net to zero." : "Items must net to zero."}</span>
          {!locked && (
            <button className="btn ml-auto min-h-9 px-3 py-1 text-xs" onClick={() => setDraft(empty(n))} data-testid="ob-reset">
              Reset
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2" data-testid="ob-cards">
        {item.cards.map((c, k) => {
          const need = plan?.x[k] ?? 0;
          return (
            <div key={k} className={`card p-2 ${need ? "border-good" : ""}`} data-testid={`ob-card-${k}`}>
              <div className="mb-2 min-h-10 text-sm leading-snug">{describeComp(item, c.comp)}</div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  className="flex min-h-12 flex-col items-center justify-center rounded-lg border border-line bg-card2 px-1 active:scale-[0.97] disabled:opacity-60"
                  onClick={() => click(k, "buys")}
                  disabled={locked}
                  data-testid={`ob-buy-${k}`}
                  aria-label={`Buy for ${c.buy}`}
                >
                  <span className="text-[11px] text-muted">Buy</span>
                  <span className="tabular font-mono font-semibold">{c.buy}</span>
                  {mode === "training" && <span className="text-[10px] text-muted">you pay {c.buy}</span>}
                  {buys[k] > 0 && <span className="tabular text-[11px] text-accent">×{buys[k]}</span>}
                </button>
                <button
                  className="flex min-h-12 flex-col items-center justify-center rounded-lg border border-line bg-card2 px-1 active:scale-[0.97] disabled:opacity-60"
                  onClick={() => click(k, "sells")}
                  disabled={locked}
                  data-testid={`ob-sell-${k}`}
                  aria-label={`Sell for ${c.sell}`}
                >
                  <span className="text-[11px] text-muted">Sell</span>
                  <span className="tabular font-mono font-semibold">{c.sell}</span>
                  {mode === "training" && <span className="text-[10px] text-muted">you receive {c.sell}</span>}
                  {sells[k] > 0 && <span className="tabular text-[11px] text-accent">×{sells[k]}</span>}
                </button>
              </div>
              {need !== 0 && <div className="mt-1 text-center text-xs text-good">{need > 0 ? `buy ×${need}` : `sell ×${-need}`}</div>}
            </div>
          );
        })}
      </div>
      {!locked && noArbEnabled(ctx) && (
        <button className="btn mt-3 w-full" onClick={() => submit({ ...empty(n), noarb: true })} data-testid="ob-noarb">
          No opportunity
        </button>
      )}
    </div>
  );
}

function Solution({ item }: { item: OBItem; response: OBResponse | null }) {
  if (!item.hasArb) {
    return (
      <div className="space-y-1 text-sm">
        <p>No arbitrage exists on this board.</p>
        <p className="text-muted">
          Proof: with fair prices {item.items.map((ci, i) => `${COMMODITIES[ci].name} ${item.fair[i]}`).join(", ")} every card sells at or below and buys at or above its fair value, so no
          combination of trades can make money.
        </p>
      </div>
    );
  }
  const p = item.simplest!;
  return (
    <div className="space-y-1 text-sm">
      <p>Simplest arbitrage ({p.clicks} clicks, profit {p.profit}):</p>
      <ul className="list-disc space-y-0.5 pl-5">
        {p.x.map((v, k) =>
          v === 0 ? null : (
            <li key={k}>
              {v > 0 ? `Buy ×${v}` : `Sell ×${-v}`} {describeComp(item, item.cards[k].comp)} @ {v > 0 ? item.cards[k].buy : item.cards[k].sell}
            </li>
          ),
        )}
      </ul>
      <p className="text-muted">
        {p.level === 1 ? "Direct cross: the same contents can be bought below where they can be sold." : p.level === 2 ? "Bundle vs sum of parts." : "Ratio arbitrage: match quantities with multiple clicks."}
      </p>
    </div>
  );
}

/** 20 boards ramping through the three phases; optionally a share of no-arbitrage boards. */
export function planOrderbooks(count: number, seed: number, config: Record<string, unknown>): ItemKey[] {
  const r = makeRng(seedFor("orderbooks", "plan", seed));
  const share = typeof config.noArbShare === "number" ? config.noArbShare : 0;
  return Array.from({ length: count }, (_, i) => {
    const phase = Math.min(2, Math.floor((3 * i) / count));
    const third = Math.max(1, Math.ceil(count / 3));
    const difficulty = (1 + Math.min(2, Math.floor((3 * (i % third)) / third))) as Difficulty;
    const family = share > 0 && r.next() < share ? "none" : ["direct", "bundle", "ratio"][phase];
    return { module: "orderbooks" as const, family, difficulty, seed: Math.floor(r.next() * 2 ** 32) };
  });
}

export const orderbooksModule: QuestionModule<OBItem, OBResponse> = {
  id: "orderbooks",
  title: "Orderbooks",
  families: OB_FAMILIES,
  generate: generateOB,
  plan: planOrderbooks,
  score: (item, r) => scoreOB(item, r),
  initialDraft: (item) => empty(item.cards.length),
  // when the clock runs out, a staged (unsubmitted) plan does not count
  onTimeout: () => null,
  canSubmit: (d) => !!d && (d.buys.some((x) => x > 0) || d.sells.some((x) => x > 0)),
  validate: (d, item) => checkResponse(item, d).error,
  View,
  Solution,
  hint: (item) =>
    item.phase === 1
      ? "Look for two cards with identical contents: is one card's Buy below the other's Sell?"
      : item.phase === 2
        ? "Compare a bundle's prices with the sum of its parts' prices."
        : item.phase === 3
          ? "Compare per-unit prices of different pack sizes; match quantities with several clicks."
          : "Check every pair and every bundle; sometimes there really is nothing.",
  describe: (item) => item.cards.map((c) => describeComp(item, c.comp)).join(" · "),
  answerLabel: (item) => (item.hasArb ? `profit ${item.simplest!.profit} in ${item.simplest!.clicks} clicks` : "no opportunity"),
  responseLabel: (_item, r) => (!r ? "skipped" : r.noarb ? "no opportunity" : `${r.buys.reduce((a, b) => a + b, 0)} buys, ${r.sells.reduce((a, b) => a + b, 0)} sells`),
};
