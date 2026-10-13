// Orderbook arbitrage solver.
//
// A board is a set of cards; each card holds a bundle of items and has a price at which the user
// can BUY it (pays `buy`) and a price at which the user can SELL it (receives `sell`).
// A trade plan is a signed click vector x (x > 0: buy clicks, x < 0: sell clicks).
// It is an arbitrage if every item nets to zero and cash = Σ sell·|x⁻| − Σ buy·x⁺ > 0.
//
// "Level" of an arbitrage:
//   1 = direct cross: two cards with identical contents, one click each
//   2 = every card used at most once (bundle vs. sum of parts)
//   3 = some card needs 2+ clicks (ratio arbitrage)

export interface Card {
  /** [itemIndex, quantity] pairs */
  comp: [number, number][];
  buy: number;
  sell: number;
}

export interface Board {
  nItems: number;
  cards: Card[];
}

export interface Plan {
  x: number[];
  clicks: number;
  profit: number;
  level: 1 | 2 | 3;
}

export function compKey(c: Card): string {
  return c.comp
    .slice()
    .sort((a, b) => a[0] - b[0])
    .map(([i, q]) => `${i}:${q}`)
    .join(",");
}

export function evaluate(board: Board, x: number[]): { inv: number[]; cash: number } {
  const inv = new Array(board.nItems).fill(0);
  let cash = 0;
  board.cards.forEach((c, k) => {
    const v = x[k];
    if (!v) return;
    for (const [i, q] of c.comp) inv[i] += v * q;
    cash += v > 0 ? -v * c.buy : -v * c.sell;
  });
  return { inv, cash };
}

/** Evaluate separate buy/sell click counts (what the UI stages). */
export function evaluateClicks(board: Board, buys: number[], sells: number[]): { inv: number[]; cash: number } {
  const inv = new Array(board.nItems).fill(0);
  let cash = 0;
  board.cards.forEach((c, k) => {
    const net = (buys[k] ?? 0) - (sells[k] ?? 0);
    for (const [i, q] of c.comp) inv[i] += net * q;
    cash += (sells[k] ?? 0) * c.sell - (buys[k] ?? 0) * c.buy;
  });
  return { inv, cash };
}

export function isArb(board: Board, x: number[]): boolean {
  const { inv, cash } = evaluate(board, x);
  return inv.every((v) => v === 0) && cash > 0 && x.some((v) => v !== 0);
}

export function levelOf(board: Board, x: number[]): 1 | 2 | 3 {
  const used = x.map((v, k) => [v, k]).filter(([v]) => v !== 0);
  if (used.some(([v]) => Math.abs(v) > 1)) return 3;
  if (used.length === 2 && compKey(board.cards[used[0][1]]) === compKey(board.cards[used[1][1]])) return 1;
  return 2;
}

function better(a: Plan | null, b: Plan): boolean {
  if (!a) return true;
  if (b.level !== a.level) return b.level < a.level;
  if (b.clicks !== a.clicks) return b.clicks < a.clicks;
  return b.profit > a.profit;
}

/** All plans with every |x| ≤ 1 (3^n enumeration). */
function searchUnit(board: Board): Plan | null {
  const n = board.cards.length;
  let best: Plan | null = null;
  const x = new Array(n).fill(0);
  const rec = (k: number) => {
    if (k === n) {
      if (!x.some((v) => v)) return;
      const { inv, cash } = evaluate(board, x);
      if (cash > 0 && inv.every((v) => v === 0)) {
        const p: Plan = { x: x.slice(), clicks: x.reduce((a, v) => a + Math.abs(v), 0), profit: cash, level: levelOf(board, x) };
        if (better(best, p)) best = p;
      }
      return;
    }
    for (const v of [0, 1, -1]) {
      x[k] = v;
      rec(k + 1);
    }
    x[k] = 0;
  };
  rec(0);
  return best;
}

/**
 * Minimal-click plan with some |x| ≥ 2, searched by iterative deepening on total clicks with
 * inventory-feasibility pruning. Bounded by maxPerCard clicks per card and maxTotal overall.
 */
function searchMulti(board: Board, maxPerCard: number, maxTotal: number): Plan | null {
  const n = board.cards.length;
  const m = board.nItems;
  // suffix capacity: max |quantity| per item contributable by one click of cards k..n-1
  const maxQ: number[][] = Array.from({ length: n + 1 }, () => new Array(m).fill(0));
  const reach: number[][] = Array.from({ length: n + 1 }, () => new Array(m).fill(0));
  for (let k = n - 1; k >= 0; k--) {
    for (let i = 0; i < m; i++) {
      maxQ[k][i] = maxQ[k + 1][i];
      reach[k][i] = reach[k + 1][i];
    }
    for (const [i, q] of board.cards[k].comp) {
      maxQ[k][i] = Math.max(maxQ[k][i], q);
      reach[k][i] += q * maxPerCard;
    }
  }
  const x = new Array(n).fill(0);
  const inv = new Array(m).fill(0);
  for (let T = 3; T <= maxTotal; T++) {
    let best: Plan | null = null;
    const rec = (k: number, budget: number) => {
      // prune: remaining cards must be able to cancel the inventory within the budget
      let need = 0;
      for (let i = 0; i < m; i++) {
        const a = Math.abs(inv[i]);
        if (!a) continue;
        if (a > reach[k][i] || maxQ[k][i] === 0) return;
        need = Math.max(need, Math.ceil(a / maxQ[k][i]));
      }
      if (need > budget) return;
      if (k === n) {
        if (budget !== 0) return;
        if (!x.some((v) => Math.abs(v) >= 2)) return;
        const { cash } = evaluate(board, x);
        if (cash > 0) {
          const p: Plan = { x: x.slice(), clicks: T, profit: cash, level: 3 };
          if (better(best, p)) best = p;
        }
        return;
      }
      const card = board.cards[k];
      for (let v = -Math.min(maxPerCard, budget); v <= Math.min(maxPerCard, budget); v++) {
        x[k] = v;
        for (const [i, q] of card.comp) inv[i] += v * q;
        rec(k + 1, budget - Math.abs(v));
        for (const [i, q] of card.comp) inv[i] -= v * q;
      }
      x[k] = 0;
    };
    rec(0, T);
    if (best) return best;
  }
  return null;
}

export interface SolveResult {
  /** simplest plan: lowest level, then fewest clicks, then highest profit */
  simplest: Plan | null;
  /** lowest arbitrage level present on the board (within bounds) */
  minLevel: 1 | 2 | 3 | null;
}

export function solve(board: Board, maxPerCard = 4, maxTotal = 12): SolveResult {
  const unit = searchUnit(board);
  if (unit) return { simplest: unit, minLevel: unit.level };
  const multi = searchMulti(board, maxPerCard, maxTotal);
  return { simplest: multi, minLevel: multi ? 3 : null };
}

/**
 * No-arbitrage certificate: if a price vector π has sell ≤ π·contents ≤ buy for every card, then no
 * trade plan of any size can make money (LP duality). Returns true if `prices` is such a vector.
 */
export function isNoArbCertificate(board: Board, prices: number[]): boolean {
  return board.cards.every((c) => {
    const v = c.comp.reduce((a, [i, q]) => a + q * prices[i], 0);
    return c.sell <= v && v <= c.buy;
  });
}
