import { itemRng, type Rng } from "@/lib/rng";
import type { Difficulty, FamilyInfo } from "@/modules/types";
import { type Board, type Card, type Plan, compKey, evaluateClicks, isNoArbCertificate, solve } from "./solver";

export const OB_FAMILIES: FamilyInfo[] = [
  { id: "direct", name: "Phase 1: direct crosses", blurb: "same contents, one card's buy below another's sell" },
  { id: "bundle", name: "Phase 2: bundles vs parts", blurb: "synthesise or decompose a bundle" },
  { id: "ratio", name: "Phase 3: ratio arbitrage", blurb: "2–4 clicks on some cards" },
  { id: "none", name: "No-opportunity boards", blurb: "robustness: sometimes nothing works" },
];

export const COMMODITIES = [
  { name: "Oil", unit: "barrel", lo: 60, hi: 90 },
  { name: "Copper", unit: "coil", lo: 8, hi: 20 },
  { name: "Silver", unit: "ingot", lo: 20, hi: 40 },
  { name: "Gold", unit: "bar", lo: 120, hi: 180 },
  { name: "Wheat", unit: "bag", lo: 5, hi: 12 },
  { name: "Coffee", unit: "sack", lo: 25, hi: 45 },
];

export interface OBItem {
  family: string;
  difficulty: Difficulty;
  seed: number;
  /** commodity indices (into COMMODITIES) used on this board, in board item order */
  items: number[];
  cards: Card[];
  hasArb: boolean;
  simplest: Plan | null;
  phase: 0 | 1 | 2 | 3;
  /** fair prices (no-arbitrage certificate for "none" boards) */
  fair: number[];
}

export interface OBResponse {
  buys: number[];
  sells: number[];
  noarb?: boolean;
}

function spreadFor(r: Rng, value: number, d: Difficulty): [number, number] {
  const u = d === 3 ? 0.01 : d === 2 ? 0.02 : 0.03;
  const s1 = Math.max(1, Math.round(value * u * (0.6 + r.next() * 0.8)));
  const s2 = Math.max(1, Math.round(value * u * (0.6 + r.next() * 0.8)));
  return [s1, s2];
}

function fairCard(r: Rng, comp: [number, number][], fair: number[], d: Difficulty): Card {
  const v = comp.reduce((a, [i, q]) => a + q * fair[i], 0);
  const [s1, s2] = spreadFor(r, v, d);
  return { comp, buy: v + s2, sell: v - s1 };
}

function randomComp(r: Rng, nItems: number, used: Set<string>): [number, number][] | null {
  for (let t = 0; t < 30; t++) {
    const kind = r.int(0, 2);
    let comp: [number, number][];
    if (kind === 0) comp = [[r.int(0, nItems - 1), 1]];
    else if (kind === 1) comp = [[r.int(0, nItems - 1), r.int(2, 6)]];
    else {
      const [a, b] = r.sample(Array.from({ length: nItems }, (_, i) => i), 2);
      comp = [
        [a, r.int(1, 3)],
        [b, r.int(1, 3)],
      ];
    }
    const key = compKey({ comp, buy: 0, sell: 0 });
    if (!used.has(key)) {
      used.add(key);
      return comp;
    }
  }
  return null;
}

function decoyCount(d: Difficulty, base: number): number {
  return Math.max(0, (d === 1 ? 4 : d === 2 ? 6 : 7) - base);
}

type Built = { cards: Card[]; nItems: number; fair: number[]; commodities: number[] };

function buildArbBoard(r: Rng, phase: 1 | 2 | 3, d: Difficulty): Built | null {
  const nItems = d === 1 ? 3 : d === 2 ? r.int(3, 4) : r.int(4, 5);
  const fair = Array.from({ length: nItems }, () => 0);
  const commodities = r.sample(COMMODITIES.map((_, i) => i), nItems);
  commodities.forEach((ci, k) => (fair[k] = r.int(COMMODITIES[ci].lo, COMMODITIES[ci].hi)));
  const used = new Set<string>();
  const cards: Card[] = [];
  const profitMax = d === 1 ? 6 : d === 2 ? 4 : 2;
  const profit = () => r.int(1, profitMax);

  if (phase === 1) {
    const comp: [number, number][] = [[r.int(0, nItems - 1), r.chance(0.6) ? 1 : r.int(2, 4)]];
    used.add(compKey({ comp, buy: 0, sell: 0 }));
    const B = fairCard(r, comp, fair, d);
    const spread = B.buy - B.sell;
    const aBuy = B.sell - profit();
    const A: Card = { comp, buy: aBuy, sell: aBuy - spread };
    if (A.sell <= 0) return null;
    cards.push(A, B);
  } else if (phase === 2) {
    const k = r.int(2, Math.min(3, nItems));
    const parts = r.sample(Array.from({ length: nItems }, (_, i) => i), k).map((i) => [i, r.int(1, 2)] as [number, number]);
    const partCards = parts.map((p) => {
      used.add(compKey({ comp: [p], buy: 0, sell: 0 }));
      return fairCard(r, [p], fair, d);
    });
    used.add(compKey({ comp: parts, buy: 0, sell: 0 }));
    const v = parts.reduce((a, [i, q]) => a + q * fair[i], 0);
    const [s1, s2] = spreadFor(r, v, d);
    let bundle: Card;
    if (r.chance(0.5)) {
      // synthesis: buy the parts, sell the bundle
      const sell = partCards.reduce((a, c) => a + c.buy, 0) + profit();
      bundle = { comp: parts, sell, buy: sell + s1 + s2 };
    } else {
      // decomposition: buy the bundle, sell the parts
      const buy = partCards.reduce((a, c) => a + c.sell, 0) - profit();
      bundle = { comp: parts, buy, sell: buy - s1 - s2 };
    }
    if (bundle.sell <= 0) return null;
    cards.push(bundle, ...partCards);
  } else {
    const kind = r.pick(["packs", "proportional", "multi_parts"]);
    if (kind === "packs") {
      const pairs = [
        [2, 3],
        [3, 4],
        [4, 6],
        [2, 5],
        [3, 2],
        [4, 3],
        [6, 4],
        [5, 2],
        [2, 4],
        [4, 2],
        [3, 6],
      ];
      const [a, b] = r.pick(pairs);
      const it = r.int(0, nItems - 1);
      const A = fairCard(r, [[it, a]], fair, d);
      const g = gcd(a, b);
      const na = b / g; // clicks on A
      const nb = a / g; // clicks on B
      // buy na × A, sell nb × B: need nb·B.sell > na·A.buy
      const sell = Math.ceil((na * A.buy + profit()) / nb);
      const B: Card = { comp: [[it, b]], sell, buy: sell + spreadFor(r, b * fair[it], d).reduce((x, y) => x + y, 0) };
      used.add(compKey(A));
      used.add(compKey(B));
      cards.push(A, B);
    } else if (kind === "proportional") {
      const [i, j] = r.sample(Array.from({ length: nItems }, (_, q) => q), 2);
      const qi = r.int(1, 2);
      const qj = r.int(1, 2);
      const m = r.int(2, 3);
      const small: [number, number][] = [
        [i, qi],
        [j, qj],
      ];
      const big: [number, number][] = [
        [i, qi * m],
        [j, qj * m],
      ];
      const S = fairCard(r, small, fair, d);
      const vb = big.reduce((a, [x, q]) => a + q * fair[x], 0);
      const [s1, s2] = spreadFor(r, vb, d);
      let Bg: Card;
      if (r.chance(0.5)) {
        const sell = m * S.buy + profit();
        Bg = { comp: big, sell, buy: sell + s1 + s2 };
      } else {
        const buy = m * S.sell - profit();
        Bg = { comp: big, buy, sell: buy - s1 - s2 };
      }
      used.add(compKey(S));
      used.add(compKey(Bg));
      cards.push(S, Bg);
    } else {
      // bundle with a multiplicity, parts sold one unit per card
      const [i, j] = r.sample(Array.from({ length: nItems }, (_, q) => q), 2);
      const qi = r.int(2, 3);
      const bundleComp: [number, number][] = [
        [i, qi],
        [j, 1],
      ];
      const Pi = fairCard(r, [[i, 1]], fair, d);
      const Pj = fairCard(r, [[j, 1]], fair, d);
      const vb = qi * fair[i] + fair[j];
      const [s1, s2] = spreadFor(r, vb, d);
      let Bd: Card;
      if (r.chance(0.5)) {
        const sell = qi * Pi.buy + Pj.buy + profit();
        Bd = { comp: bundleComp, sell, buy: sell + s1 + s2 };
      } else {
        const buy = qi * Pi.sell + Pj.sell - profit();
        Bd = { comp: bundleComp, buy, sell: buy - s1 - s2 };
      }
      for (const c of [Pi, Pj, Bd]) used.add(compKey(c));
      cards.push(Bd, Pi, Pj);
    }
  }
  for (let k = 0; k < decoyCount(d, cards.length); k++) {
    const comp = randomComp(r, nItems, used);
    if (comp) cards.push(fairCard(r, comp, fair, d));
  }
  if (cards.some((c) => c.sell <= 0 || c.buy <= c.sell)) return null;
  return { cards: r.shuffle(cards), nItems, fair, commodities };
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

function buildNoArbBoard(r: Rng, d: Difficulty): Built {
  const nItems = d === 1 ? 3 : r.int(3, 5);
  const commodities = r.sample(COMMODITIES.map((_, i) => i), nItems);
  const fair = commodities.map((ci) => r.int(COMMODITIES[ci].lo, COMMODITIES[ci].hi));
  const used = new Set<string>();
  const cards: Card[] = [];
  // tempting near-misses: same contents whose prices touch but do not cross
  const comp: [number, number][] = [[r.int(0, nItems - 1), r.int(1, 3)]];
  used.add(compKey({ comp, buy: 0, sell: 0 }));
  const v = comp[0][1] * fair[comp[0][0]];
  const s = r.int(1, 3);
  cards.push({ comp, buy: v + s, sell: v - r.int(1, 3) }, { comp, buy: v + r.int(1, 3), sell: v });
  const n = d === 1 ? 5 : d === 2 ? 6 : 8;
  while (cards.length < n) {
    const c = randomComp(r, nItems, used);
    if (!c) break;
    cards.push(fairCard(r, c, fair, d));
  }
  return { cards: r.shuffle(cards), nItems, fair, commodities };
}

export function generateOB(family: string, difficulty: Difficulty, seed: number): OBItem {
  const r = itemRng("orderbooks", family, difficulty, seed);
  if (family === "none") {
    const b = buildNoArbBoard(r, difficulty);
    const board: Board = { nItems: b.nItems, cards: b.cards };
    if (!isNoArbCertificate(board, b.fair)) throw new Error("no-arb board without certificate");
    return { family, difficulty, seed, items: b.commodities, cards: b.cards, hasArb: false, simplest: null, phase: 0, fair: b.fair };
  }
  const phase = family === "direct" ? 1 : family === "bundle" ? 2 : 3;
  for (let attempt = 0; attempt < 300; attempt++) {
    const b = buildArbBoard(r, phase, difficulty);
    if (!b) continue;
    const board: Board = { nItems: b.nItems, cards: b.cards };
    const res = solve(board);
    // the planted opportunity must exist, and decoys must not create a simpler one
    if (!res.simplest || res.minLevel !== phase) continue;
    return { family, difficulty, seed, items: b.commodities, cards: b.cards, hasArb: true, simplest: res.simplest, phase, fair: b.fair };
  }
  throw new Error(`Orderbooks ${family}/${difficulty}/${seed}: no valid board`);
}

export function checkResponse(item: Pick<OBItem, "cards" | "items" | "hasArb">, resp: OBResponse | null): { valid: boolean; error: string | null; cash: number; inv: number[] } {
  if (!resp) return { valid: false, error: null, cash: 0, inv: [] };
  if (resp.noarb) return { valid: !item.hasArb, error: item.hasArb ? "Not quite: there is an opportunity on this board." : null, cash: 0, inv: [] };
  const board: Board = { nItems: item.items.length, cards: item.cards };
  const { inv, cash } = evaluateClicks(board, resp.buys, resp.sells);
  const any = resp.buys.some((x) => x > 0) || resp.sells.some((x) => x > 0);
  if (!any) return { valid: false, error: "Stage some trades first.", cash, inv };
  if (inv.some((v) => v !== 0)) return { valid: false, error: "Every item must net to zero before you submit.", cash, inv };
  if (cash <= 0) return { valid: false, error: `Inventory is flat but cash is ${cash}: you need a strictly positive profit.`, cash, inv };
  return { valid: true, error: null, cash, inv };
}

export function scoreOB(item: OBItem, resp: OBResponse | null): { correct: boolean | null; score: number } {
  if (!resp) return { correct: null, score: 0 };
  const c = checkResponse(item, resp);
  return { correct: c.valid, score: c.valid ? 1 : 0 };
}

export function describeComp(item: Pick<OBItem, "items">, comp: [number, number][]): string {
  return comp
    .map(([i, q]) => {
      const c = COMMODITIES[item.items[i]];
      return `${q} ${c.name} ${c.unit}${q > 1 ? "s" : ""}`;
    })
    .join(" + ");
}
