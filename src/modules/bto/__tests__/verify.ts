// Independent answer checks for Beat The Odds (test-only).
// Each check uses a different method from the generator: brute-force enumeration, a generic
// linear-system solve, sequential conditional products, value iteration, or series summation.

import { F, Fraction, fsum } from "@/lib/fraction";
import { absorptionProbabilities, cartesian, combinations, expectedHittingTimes, permutations } from "@/lib/math";
import type { Rng } from "@/lib/rng";

export type Checked = { kind: "exact"; v: Fraction } | { kind: "float"; v: number; tol: number } | { kind: "inf" } | { kind: "none" };

const ex = (v: Fraction): Checked => ({ kind: "exact", v });
const fl = (v: number, tol = 1e-9): Checked => ({ kind: "float", v, tol });
type P = Record<string, unknown>;
const fp = (s: unknown) => Fraction.parse(String(s));

// ---------- generic helpers ----------

function enumerateDice(n: number, s: number, pred: (xs: number[]) => boolean): Fraction {
  let c = 0n;
  let total = 0n;
  for (const xs of cartesian(n, s)) {
    total++;
    if (pred(xs.map((x) => x + 1))) c++;
  }
  return F(c, total);
}

function expectDice(n: number, s: number, f: (xs: number[]) => number): Fraction {
  let sum = Fraction.ZERO;
  let total = 0;
  for (const xs of cartesian(n, s)) {
    total++;
    sum = sum.add(Fraction.of(f(xs.map((x) => x + 1))));
  }
  return sum.div(total);
}

/** Sum of weights of binary sequences of length n satisfying pred (1 = success with prob p). */
function binarySeq(n: number, p: Fraction, pred: (bits: number[]) => boolean): Fraction {
  let s = Fraction.ZERO;
  const q = p.comp();
  for (const bits of cartesian(n, 2)) {
    if (!pred(bits)) continue;
    const k = bits.reduce((a, b) => a + b, 0);
    s = s.add(p.pow(k).mul(q.pow(n - k)));
  }
  return s;
}

function chainHit(n: number, edges: (i: number) => [number, Fraction][], targets: number[]): Fraction[] {
  const P = Array.from({ length: n }, (_, i) => new Map(targets.includes(i) ? [[i, Fraction.ONE]] : edges(i)));
  return expectedHittingTimes(P, new Set(targets));
}

/** Float Gaussian elimination for larger hitting-time systems. */
function chainHitFloat(n: number, edges: (i: number) => [number, number][], targets: number[]): number[] {
  const T = new Set(targets);
  const idx = Array.from({ length: n }, (_, i) => i).filter((i) => !T.has(i));
  const pos = new Map(idx.map((v, k) => [v, k]));
  const m = idx.length;
  const A = Array.from({ length: m }, () => new Float64Array(m + 1));
  idx.forEach((i, r) => {
    A[r][r] += 1;
    A[r][m] = 1;
    for (const [j, p] of edges(i)) {
      const c = pos.get(j);
      if (c !== undefined) A[r][c] -= p;
    }
  });
  for (let c = 0; c < m; c++) {
    let piv = c;
    for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < m; r++) {
      if (r === c || A[r][c] === 0) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= m; k++) A[r][k] -= f * A[c][k];
    }
  }
  const out = new Array(n).fill(0);
  idx.forEach((i, r) => (out[i] = A[r][m] / A[r][r]));
  return out;
}

function chainAbsorb(n: number, edges: (i: number) => [number, Fraction][], absorbing: number[], win: number[]): Fraction[] {
  const P = Array.from({ length: n }, (_, i) => new Map(absorbing.includes(i) ? [[i, Fraction.ONE]] : edges(i)));
  return absorptionProbabilities(P, new Set(absorbing), new Set(win));
}

/** Expected return time to v via first-step analysis on hitting times. */
function returnTime(adj: number[][], v: number): Fraction {
  const n = adj.length;
  const h = chainHit(n, (i) => adj[i].map((j) => [j, F(1, adj[i].length)] as [number, Fraction]), [v]);
  return Fraction.ONE.add(fsum(adj[v].map((j) => h[j].mul(F(1, adj[v].length)))));
}

const cards52 = Array.from({ length: 52 }, (_, i) => ({ rank: i % 13, suit: Math.floor(i / 13) }));

function orderedDraws<T>(xs: T[], k: number, pred: (d: T[]) => boolean): Fraction {
  let c = 0;
  let total = 0;
  const rec = (acc: T[], used: boolean[]) => {
    if (acc.length === k) {
      total++;
      if (pred(acc)) c++;
      return;
    }
    for (let i = 0; i < xs.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      acc.push(xs[i]);
      rec(acc, used);
      acc.pop();
      used[i] = false;
    }
  };
  rec([], new Array(xs.length).fill(false));
  return F(c, total);
}

const balls = (red: number, blue: number) => [...Array(red).fill("R"), ...Array(blue).fill("B")] as string[];

/** Conway correlation for fair coins. */
function corr(x: string, y: string): number {
  let s = 0;
  for (let k = 1; k <= Math.min(x.length, y.length); k++) if (x.slice(-k) === y.slice(0, k)) s += 2 ** (k - 1);
  return s;
}

function permsOf(n: number): number[][] {
  return [...permutations(Array.from({ length: n }, (_, i) => i))];
}

// ---------- brute-force answers ----------

export function bruteForce(family: string, p: P): Checked {
  const sub = p.sub as string;
  switch (family) {
    case "dice": {
      if (sub === "atleast" || sub === "atleast2") {
        const m = p.m as number;
        const s = p.s as number;
        const need = sub === "atleast" ? 1 : 2;
        return ex(binarySeq(m, F(1, s), (b) => b.reduce((a, x) => a + x, 0) >= need));
      }
      const n = p.n as number;
      const s = p.s as number;
      const k = p.k as number;
      const pred: Record<string, (xs: number[]) => boolean> = {
        sum_eq: (xs) => xs.reduce((a, b) => a + b, 0) === k,
        sum_ge: (xs) => xs.reduce((a, b) => a + b, 0) >= k,
        max_le: (xs) => Math.max(...xs) <= k,
        max_eq: (xs) => Math.max(...xs) === k,
        min_ge: (xs) => Math.min(...xs) >= k,
        min_eq: (xs) => Math.min(...xs) === k,
      };
      return ex(enumerateDice(n, s, pred[sub]));
    }
    case "coins": {
      if (sub === "k_heads" || sub === "atleast_k") {
        const n = p.n as number;
        const k = p.k as number;
        return ex(binarySeq(n, fp(p.p), (b) => (sub === "k_heads" ? b.reduce((a, x) => a + x, 0) === k : b.reduce((a, x) => a + x, 0) >= k)));
      }
      if (sub === "exp_pattern") {
        const pat = p.pattern as string;
        const ph = fp(p.p);
        let e = Fraction.ZERO;
        for (let k = 1; k <= pat.length; k++) {
          if (pat.slice(0, k) !== pat.slice(-k)) continue;
          const pr = [...pat.slice(0, k)].reduce((a, c) => a.mul(c === "H" ? ph : ph.comp()), Fraction.ONE);
          e = e.add(pr.inv());
        }
        return ex(e);
      }
      if (sub === "first_pattern") {
        const a = p.a as string;
        const b = p.b as string;
        const oddsA = corr(b, b) - corr(b, a);
        const oddsB = corr(a, a) - corr(a, b);
        return ex(F(oddsA, oddsA + oddsB));
      }
      const n = p.n as number;
      const r = p.r as number;
      return ex(
        binarySeq(n, F(1, 2), (b) => {
          let run = 0;
          for (const x of b) {
            run = x ? run + 1 : 0;
            if (run >= r) return true;
          }
          return false;
        }),
      );
    }
    case "cards": {
      if (sub === "same_suit") return ex(orderedDraws(cards52, 2, (d) => d[0].suit === d[1].suit));
      if (sub === "pair") return ex(orderedDraws(cards52, 2, (d) => d[0].rank === d[1].rank));
      if (sub === "two_of_rank") return ex(orderedDraws(cards52, p.n as number, (d) => d.every((c) => c.rank === 0)));
      if (sub === "diff_suits") return ex(orderedDraws(cards52, 3, (d) => new Set(d.map((c) => c.suit)).size === 3));
      if (sub === "k_suit") {
        // sum over orderings of sequential conditional probabilities
        const n = p.n as number;
        const k = p.k as number;
        let tot = Fraction.ZERO;
        for (const bits of cartesian(n, 2)) {
          if (bits.reduce((a, b) => a + b, 0) !== k) continue;
          let h = 13;
          let o = 39;
          let pr = Fraction.ONE;
          for (const b of bits) {
            pr = pr.mul(F(b ? h : o, h + o));
            if (b) h--;
            else o--;
          }
          tot = tot.add(pr);
        }
        return ex(tot);
      }
      if (sub === "first_ace_pos" || sub === "first_ace_pos_gen") {
        const N = p.N as number;
        const K = p.K as number;
        let e = Fraction.ZERO;
        let none = Fraction.ONE;
        for (let j = 1; j <= N - K + 1; j++) {
          const here = none.mul(F(K, N - j + 1));
          e = e.add(here.mul(j));
          none = none.mul(F(N - j + 1 - K, N - j + 1));
        }
        return ex(e);
      }
      if (sub === "group_before") {
        const a = p.a as number;
        const b = p.b as number;
        let c = 0;
        let t = 0;
        for (const pos of combinations(Array.from({ length: a + b }, (_, i) => i), a)) {
          t++;
          if (pos[0] === 0) c++;
        }
        return ex(F(c, t));
      }
      if (sub === "first_ace_at") {
        const j = p.j as number;
        let pr = Fraction.ONE;
        for (let i = 0; i < j - 1; i++) pr = pr.mul(F(48 - i, 52 - i));
        return ex(pr.mul(F(4, 52 - (j - 1))));
      }
      if (sub === "flush") return ex(F(12, 51).mul(F(11, 50)).mul(F(10, 49)).mul(F(9, 48)));
      break;
    }
    case "urns": {
      const red = p.red as number;
      const blue = p.blue as number;
      const bs = balls(red, blue);
      if (sub === "both_red") return ex(orderedDraws(bs, 2, (d) => d.every((x) => x === "R")));
      if (sub === "same_color") return ex(orderedDraws(bs, 2, (d) => d[0] === d[1]));
      if (sub === "one_each") return ex(orderedDraws(bs, 2, (d) => d[0] !== d[1]));
      if (sub === "second_red") return ex(orderedDraws(bs, 2, (d) => d[1] === "R"));
      if (sub === "k_red") return ex(orderedDraws(bs, p.n as number, (d) => d.filter((x) => x === "R").length === p.k));
      if (sub === "last_ball") {
        const memo = new Map<string, Fraction>();
        const last = (r: number, b: number): Fraction => {
          if (b === 0) return Fraction.ONE;
          if (r === 0) return Fraction.ZERO;
          const key = `${r},${b}`;
          if (!memo.has(key)) memo.set(key, F(r, r + b).mul(last(r - 1, b)).add(F(b, r + b).mul(last(r, b - 1))));
          return memo.get(key)!;
        };
        return ex(last(red, blue));
      }
      if (sub === "polya") {
        const c = p.c as number;
        const N = red + blue;
        const rr = F(red, N);
        const both = rr.mul(F(red + c, N + c));
        const second = both.add(F(blue, N).mul(F(red, N + c)));
        return ex(p.both ? both : second);
      }
      if (sub === "transfer") {
        const r2 = p.r2 as number;
        const b2 = p.b2 as number;
        let c = 0;
        let t = 0;
        for (const moved of bs) {
          const urnB = [...balls(r2, b2), moved];
          for (const x of urnB) {
            t++;
            if (x === "R") c++;
          }
        }
        return ex(F(c, t));
      }
      break;
    }
    case "birthday": {
      if (sub === "share_small" || sub === "share_365") {
        const D = p.D as number;
        const n = p.n as number;
        if (D ** n <= 2_000_000) {
          let c = 0;
          let t = 0;
          for (const xs of cartesian(n, D)) {
            t++;
            if (new Set(xs).size < n) c++;
          }
          return ex(F(c, t));
        }
        // DP over number of distinct days used
        let dist: Fraction[] = [Fraction.ONE];
        for (let i = 0; i < n; i++) {
          const nd: Fraction[] = new Array(dist.length + 1).fill(Fraction.ZERO);
          dist.forEach((pr, used) => {
            if (pr.isZero()) return;
            nd[used] = nd[used].add(pr.mul(F(used, D)));
            nd[used + 1] = nd[used + 1].add(pr.mul(F(D - used, D)));
          });
          dist = nd;
        }
        return ex(dist[n].comp());
      }
      if (sub === "share_mine") {
        let none = Fraction.ONE;
        for (let i = 0; i < (p.n as number); i++) none = none.mul(F(364, 365));
        return ex(none.comp());
      }
      if (sub === "exp_pairs") return { kind: "none" };
      if (sub === "min_n") {
        const D = p.D as number;
        let allDiff = Fraction.ONE;
        for (let n = 1; n <= D + 1; n++) {
          allDiff = allDiff.mul(F(D - (n - 1), D));
          if (allDiff.cmp(F(1, 2)) <= 0) return ex(F(n));
        }
      }
      break;
    }
    case "bayes": {
      if (sub === "test" || sub === "test_twice") {
        const prev = fp(p.prev);
        const sens = fp(p.sens);
        const fpr = fp(p.fpr);
        const tests = p.twice ? 2 : 1;
        let sickPos = Fraction.ZERO;
        let allPos = Fraction.ZERO;
        for (const sick of [true, false]) {
          for (const res of cartesian(tests, 2)) {
            let pr = sick ? prev : prev.comp();
            for (const x of res) {
              const pp = sick ? sens : fpr;
              pr = pr.mul(x ? pp : pp.comp());
            }
            if (res.every((x) => x === 1)) {
              allPos = allPos.add(pr);
              if (sick) sickPos = sickPos.add(pr);
            }
          }
        }
        return ex(sickPos.div(allPos));
      }
      if (sub === "two_coins") {
        const m = p.m as number;
        const k = p.k as number;
        let dh = Fraction.ZERO;
        let all = Fraction.ZERO;
        for (let coin = 0; coin <= m; coin++) {
          for (const flips of cartesian(k, 2)) {
            const isDH = coin === m;
            const pr = F(1, m + 1).mul(isDH ? (flips.every((x) => x === 1) ? 1 : 0) : F(1, 2 ** k));
            if (flips.every((x) => x === 1)) {
              all = all.add(pr);
              if (isDH) dh = dh.add(pr);
            }
          }
        }
        return ex(dh.div(all));
      }
      if (sub === "two_child" || sub === "two_child_tuesday") {
        const v = p.variant as string;
        let both = 0;
        let cond = 0;
        const kids: { boy: boolean; day: number }[] = [];
        for (let sex = 0; sex < 2; sex++) for (let day = 0; day < 7; day++) kids.push({ boy: sex === 1, day });
        for (const older of kids)
          for (const younger of kids) {
            const ok =
              v === "atleast" ? older.boy || younger.boy : v === "older" ? older.boy : (older.boy && older.day === 2) || (younger.boy && younger.day === 2);
            if (!ok) continue;
            cond++;
            if (older.boy && younger.boy) both++;
          }
        return ex(F(both, cond));
      }
      if (sub === "monty") {
        const n = p.n as number;
        const k = p.k as number;
        let win = Fraction.ZERO;
        for (let car = 0; car < n; car++)
          for (let pick = 0; pick < n; pick++) {
            const goats = Array.from({ length: n }, (_, i) => i).filter((i) => i !== car && i !== pick);
            const opens = [...combinations(goats, k)];
            for (const o of opens) {
              const rest = Array.from({ length: n }, (_, i) => i).filter((i) => i !== pick && !o.includes(i));
              const pr = F(1, n * n).mul(F(1, opens.length)).mul(F(1, rest.length));
              for (const sw of rest) if (sw === car) win = win.add(pr);
            }
          }
        return ex(win);
      }
      if (sub === "monty_ignorant") {
        const n = p.n as number;
        let win = Fraction.ZERO;
        let cond = Fraction.ZERO;
        for (let car = 0; car < n; car++)
          for (let pick = 0; pick < n; pick++)
            for (let open = 0; open < n; open++) {
              if (open === pick) continue;
              const pr = F(1, n * n * (n - 1));
              if (open === car) continue;
              cond = cond.add(pr);
              const rest = Array.from({ length: n }, (_, i) => i).filter((i) => i !== pick && i !== open);
              for (const sw of rest) if (sw === car) win = win.add(pr.mul(F(1, rest.length)));
            }
        return ex(win.div(cond));
      }
      if (sub === "urn_bayes") {
        const prior = fp(p.prior);
        const pa = orderedDraws(balls(p.rA as number, p.bA as number), 2, (d) => d.every((x) => x === "R"));
        const pb = orderedDraws(balls(p.rB as number, p.bB as number), 2, (d) => d.every((x) => x === "R"));
        const a = prior.mul(pa);
        return ex(a.div(a.add(prior.comp().mul(pb))));
      }
      break;
    }
    case "waiting": {
      if (sub === "geom_mean") {
        const pr = fp(p.p);
        return ex(chainHit(2, () => [[0, pr.comp()], [1, pr]], [1])[0]);
      }
      if (sub === "geom_pmf") {
        const k = p.k as number;
        return ex(binarySeq(k, fp(p.p), (b) => b.indexOf(1) === k - 1));
      }
      if (sub === "geom_tail") return ex(binarySeq(p.k as number, fp(p.p), (b) => b.every((x) => x === 0)));
      if (sub === "negbin_mean") {
        const r = p.r as number;
        const pr = fp(p.p);
        return ex(chainHit(r + 1, (i) => [[i, pr.comp()], [i + 1, pr]], [r])[0]);
      }
      if (sub === "coupon" || sub === "coupon_partial") {
        const s = p.s as number;
        const k = p.k as number;
        return ex(chainHit(k + 1, (i) => [[i, F(i, s)], [i + 1, F(s - i, s)]], [k])[0]);
      }
      if (sub === "negbin_pmf") {
        const k = p.k as number;
        const r = p.r as number;
        return ex(binarySeq(k, fp(p.p), (b) => b[k - 1] === 1 && b.reduce((a, x) => a + x, 0) === r));
      }
      if (sub === "geom_set") {
        const s = p.s as number;
        const m = p.m as number;
        const full = (1 << m) - 1;
        return ex(
          chainHit(
            1 << m,
            (mask) => {
              const out = new Map<number, Fraction>();
              for (let f = 0; f < s; f++) {
                const nm = f < m ? mask | (1 << f) : mask;
                out.set(nm, (out.get(nm) ?? Fraction.ZERO).add(F(1, s)));
              }
              return [...out];
            },
            [full],
          )[0],
        );
      }
      break;
    }
    case "ev": {
      const s = p.s as number;
      if (sub === "payout") {
        const kind = p.kind as string;
        return ex(expectDice(1, s, ([x]) => (kind === "square" ? x * x : kind === "double_plus" ? 2 * x + 1 : (x * (x + 1)) / 2)));
      }
      if (sub === "max2" || sub === "max_n") return ex(expectDice(p.n as number, s, (xs) => Math.max(...xs)));
      if (sub === "product") return ex(expectDice(2, s, ([a, b]) => a * b));
      if (sub === "reroll" || sub === "reroll_k") {
        const rolls = p.rolls as number;
        let best = Fraction.ZERO;
        for (const th of cartesian(rolls - 1, s)) {
          // th[j] + 1 = keep threshold at roll j (keep if x >= threshold)
          const val = (j: number): Fraction => {
            if (j === rolls - 1) return F(s + 1, 2);
            const cont = val(j + 1);
            return fsum(Array.from({ length: s }, (_, i) => (i + 1 >= th[j] + 1 ? F(i + 1) : cont))).div(s);
          };
          const v = val(0);
          if (v.gt(best)) best = v;
        }
        return ex(best);
      }
      if (sub === "game") return ex(expectDice(1, 6, ([x]) => (x === 6 ? (p.a as number) : x === 5 ? (p.b as number) : -(p.c as number))));
      if (sub === "until_tails") {
        const pr = fp(p.p).toNumber();
        let e = 0;
        for (let k = 0; k < 2000; k++) e += k * pr ** k * (1 - pr);
        return fl(e, 1e-9);
      }
      break;
    }
    case "ruin": {
      const N = p.N as number;
      const i = p.i as number;
      const pr = fp(p.p);
      const edges = (x: number): [number, Fraction][] => [
        [x + 1, pr],
        [x - 1, pr.comp()],
      ];
      if (sub.startsWith("win")) return ex(chainAbsorb(N + 1, edges, [0, N], [N])[i]);
      return ex(chainHit(N + 1, edges, [0, N])[i]);
    }
    case "walk": {
      if (sub === "cycle_return") {
        const n = p.n as number;
        return ex(returnTime(Array.from({ length: n }, (_, i) => [(i + 1) % n, (i + n - 1) % n]), 0));
      }
      if (sub === "line_hit") {
        const a = p.a as number;
        const b = p.b as number;
        // states 0..a+b, start at b
        const half = F(1, 2);
        return ex(chainAbsorb(a + b + 1, (x) => [[x + 1, half], [x - 1, half]], [0, a + b], [a + b])[b]);
      }
      if (sub === "cycle_hit") {
        const n = p.n as number;
        const k = p.k as number;
        const half = F(1, 2);
        return ex(chainHit(n, (x) => [[(x + 1) % n, half], [(x + n - 1) % n, half]], [k])[0]);
      }
      if (sub === "cover_cycle") {
        const n = p.n as number;
        // state: (left extent L, right extent R, position x in [-L, R]); absorbing when L + R + 1 = n
        const states: [number, number, number][] = [];
        const id = new Map<string, number>();
        for (let L = 0; L < n; L++)
          for (let R = 0; L + R < n; R++)
            for (let x = -L; x <= R; x++) {
              id.set(`${L},${R},${x}`, states.length);
              states.push([L, R, x]);
            }
        const done = states.map((s, i) => (s[0] + s[1] + 1 === n ? i : -1)).filter((i) => i >= 0);
        const h = chainHitFloat(
          states.length,
          (i) => {
            const [L, R, x] = states[i];
            return [x + 1, x - 1].map((y) => {
              const nL = Math.max(L, -y);
              const nR = Math.max(R, y);
              return [id.get(`${nL},${nR},${y}`)!, 0.5] as [number, number];
            });
          },
          done,
        );
        return fl(h[id.get("0,0,0")!], 1e-7);
      }
      if (sub === "graph_return") return ex(returnTime(p.adj as number[][], p.v as number));
      break;
    }
    case "markov": {
      if (sub === "deuce") {
        const pr = fp(p.p);
        // lead -2..2 -> states 0..4, start 2
        return ex(chainAbsorb(5, (x) => [[x + 1, pr], [x - 1, pr.comp()]], [0, 4], [4])[2]);
      }
      if (sub === "race") {
        const n = p.n as number;
        return ex(
          binarySeq(2 * n - 1, fp(p.p), (b) => {
            let a = 0;
            let c = 0;
            for (const x of b) {
              if (x) a++;
              else c++;
              if (a === n) return true;
              if (c === n) return false;
            }
            return false;
          }),
        );
      }
      if (sub === "craps") {
        let w = 0;
        for (let d1 = 1; d1 <= 6; d1++)
          for (let d2 = 1; d2 <= 6; d2++) {
            const s = d1 + d2;
            if (s === 7 || s === 11) w += 1 / 36;
            else if ([2, 3, 12].includes(s)) continue;
            else {
              const ps = (6 - Math.abs(s - 7)) / 36;
              // series: sum_k (1 - ps - 1/6)^k * ps
              let acc = 0;
              let stay = 1;
              for (let k = 0; k < 5000; k++) {
                acc += stay * ps;
                stay *= 1 - ps - 1 / 6;
              }
              w += acc / 36;
            }
          }
        return fl(w, 1e-12);
      }
      if (sub === "chain_prob" || sub === "chain_steps") {
        const rows = (p.P as [number, string][][]).map((r) => r.map(([j, s]) => [j, Number(Fraction.parse(s).toNumber())] as [number, number]));
        const t = p.t as number;
        const n = rows.length;
        let v = new Array(n).fill(0);
        for (let it = 0; it < 200000; it++) {
          const nv = v.slice();
          let delta = 0;
          for (let i = 0; i < t; i++) {
            let x = sub === "chain_steps" ? 1 : 0;
            for (const [j, pr] of rows[i]) x += pr * (j === t ? (sub === "chain_steps" ? 0 : 1) : j === t + 1 ? 0 : v[j]);
            delta = Math.max(delta, Math.abs(x - nv[i]));
            nv[i] = x;
          }
          v = nv;
          if (delta < 1e-14) break;
        }
        return fl(v[0], 1e-9);
      }
      break;
    }
    case "linearity": {
      const n = p.n as number;
      if (sub === "fixed_points" && n <= 8) {
        const ps = permsOf(n);
        return ex(F(ps.reduce((a, pm) => a + pm.filter((x, i) => x === i).length, 0), ps.length));
      }
      if (sub === "records" && n <= 8) {
        const ps = permsOf(n);
        let c = 0;
        for (const pm of ps) {
          let mx = -1;
          for (const x of pm)
            if (x > mx) {
              c++;
              mx = x;
            }
        }
        return ex(F(c, ps.length));
      }
      if (sub === "couples" && n <= 4) {
        const ps = permsOf(2 * n);
        let c = 0;
        for (const pm of ps)
          for (let i = 0; i < 2 * n; i++) {
            const j = i + 1;
            if (j === 2 * n && !p.round) continue;
            const a = pm[i];
            const b = pm[j % (2 * n)];
            if (Math.floor(a / 2) === Math.floor(b / 2)) c++;
          }
        return ex(F(c, ps.length));
      }
      if ((sub === "adjacent_equal" || sub === "runs") && n <= 16) {
        let tot = 0;
        for (const b of cartesian(n, 2)) {
          let eq = 0;
          for (let i = 0; i + 1 < n; i++) if (b[i] === b[i + 1]) eq++;
          tot += sub === "runs" ? n - eq : eq;
        }
        return ex(F(tot, 2 ** n));
      }
      if (sub === "distinct_values" && (p.s as number) ** n <= 1_000_000) {
        const s = p.s as number;
        let tot = 0;
        let c = 0;
        for (const xs of cartesian(n, s)) {
          c++;
          tot += new Set(xs).size;
        }
        return ex(F(tot, c));
      }
      if (sub === "empty_boxes" && (p.m as number) ** n <= 1_000_000) {
        const m = p.m as number;
        let tot = 0;
        let c = 0;
        for (const xs of cartesian(n, m)) {
          c++;
          tot += m - new Set(xs).size;
        }
        return ex(F(tot, c));
      }
      return { kind: "none" };
    }
    case "martingale": {
      const pr = fp(p.p);
      const q = pr.comp();
      if (sub.startsWith("doubling")) {
        const B = p.B as number;
        // enumerate explicit paths: lose j bets then win, or lose until the next bet is unaffordable
        let ev = Fraction.ZERO;
        let pwin = Fraction.ZERO;
        let wealth = B;
        let bet = 1;
        let pathP = Fraction.ONE;
        for (;;) {
          if (bet > wealth) {
            ev = ev.add(pathP.mul(wealth - B));
            break;
          }
          ev = ev.add(pathP.mul(pr).mul(wealth + bet - B));
          pwin = pwin.add(pathP.mul(pr));
          pathP = pathP.mul(q);
          wealth -= bet;
          bet *= 2;
        }
        return ex(sub === "doubling_pwin" ? pwin : ev);
      }
      const B = p.B as number;
      const t = p.t as number;
      const win = chainAbsorb(B + t + 1, (x) => [[x + 1, pr], [x - 1, q]], [0, B + t], [B + t])[B];
      return ex(win.mul(B + t));
    }
    case "divergent": {
      if (sub === "st_pete") {
        let e = Fraction.ZERO;
        for (let k = 1; k <= 60; k++) e = e.add(F(1, 2).pow(k).mul(2n ** BigInt(k)));
        return e.eq(60) ? { kind: "inf" } : { kind: "none" }; // partial sums grow linearly
      }
      if (sub === "st_pete_capped") {
        const c = p.c as number;
        let e = 0;
        for (let k = 1; k < 200; k++) e += 0.5 ** k * Math.min(2 ** k, 2 ** c);
        return fl(e, 1e-9);
      }
      if (sub === "exceed_first") {
        // E[min(N, T)] = sum_{n<T} 1/(n+1) is unbounded
        const part = (T: number) => {
          let s = 0;
          for (let n = 0; n < T; n++) s += 1 / (n + 1);
          return s;
        };
        return part(1e6) - part(1e3) > 6 ? { kind: "inf" } : { kind: "none" };
      }
      if (sub === "exceed_fixed") {
        const t = fp(p.t).toNumber();
        let e = 0;
        for (let k = 1; k < 5000; k++) e += k * t ** (k - 1) * (1 - t);
        return fl(e, 1e-9);
      }
      if (sub === "die_strict") {
        // first roll 6 has probability 1/6 and success probability 0 thereafter
        const pSuccessAfter6 = F(6 - 6, 6);
        return pSuccessAfter6.isZero() ? { kind: "inf" } : { kind: "none" };
      }
      if (sub === "die_atleast") {
        let e = 0;
        for (let f = 1; f <= 6; f++) {
          const ps = (7 - f) / 6;
          let ee = 0;
          for (let k = 1; k < 3000; k++) ee += k * (1 - ps) ** (k - 1) * ps;
          e += ee / 6;
        }
        return fl(e, 1e-9);
      }
      if (sub === "return_line") {
        // partial expectation of the first-return time grows like sqrt(T)
        let pr = 0.5; // P(first return at 2) = 1/2
        let s1 = 0;
        let s2 = 0;
        for (let n = 1; n <= 200000; n++) {
          if (n > 1) pr *= (2 * n - 3) / (2 * n);
          if (n <= 2000) s1 += 2 * n * pr;
          s2 += 2 * n * pr;
        }
        return s2 > 5 * s1 ? { kind: "inf" } : { kind: "none" };
      }
      break;
    }
  }
  return { kind: "none" };
}

// ---------- Monte Carlo ----------

/** One sample of the quantity whose mean is the answer (indicator for probabilities). null = not simulable. */
export function simulate(family: string, p: P, r: Rng): number | null {
  const sub = p.sub as string;
  const die = (s: number) => r.int(1, s);
  const coin = (pr: number) => (r.next() < pr ? 1 : 0);
  switch (family) {
    case "dice": {
      if (sub === "atleast" || sub === "atleast2") {
        let c = 0;
        for (let i = 0; i < (p.m as number); i++) if (die(p.s as number) === p.s) c++;
        return c >= (sub === "atleast" ? 1 : 2) ? 1 : 0;
      }
      const xs = Array.from({ length: p.n as number }, () => die(p.s as number));
      const k = p.k as number;
      const sum = xs.reduce((a, b) => a + b, 0);
      const m = { sum_eq: sum === k, sum_ge: sum >= k, max_le: Math.max(...xs) <= k, max_eq: Math.max(...xs) === k, min_ge: Math.min(...xs) >= k, min_eq: Math.min(...xs) === k }[sub];
      return m ? 1 : 0;
    }
    case "coins": {
      const ph = p.p ? fp(p.p).toNumber() : 0.5;
      if (sub === "k_heads" || sub === "atleast_k") {
        let h = 0;
        for (let i = 0; i < (p.n as number); i++) h += coin(ph);
        return (sub === "k_heads" ? h === p.k : h >= (p.k as number)) ? 1 : 0;
      }
      if (sub === "exp_pattern" || sub === "first_pattern") {
        let s = "";
        let t = 0;
        for (;;) {
          s = (s + (coin(ph) ? "H" : "T")).slice(-6);
          t++;
          if (sub === "exp_pattern" && s.endsWith(p.pattern as string)) return t;
          if (sub === "first_pattern") {
            if (s.endsWith(p.a as string)) return 1;
            if (s.endsWith(p.b as string)) return 0;
          }
        }
      }
      let run = 0;
      for (let i = 0; i < (p.n as number); i++) {
        run = coin(0.5) ? run + 1 : 0;
        if (run >= (p.r as number)) return 1;
      }
      return 0;
    }
    case "cards": {
      const deck = r.shuffle(cards52);
      if (sub === "same_suit") return deck[0].suit === deck[1].suit ? 1 : 0;
      if (sub === "pair") return deck[0].rank === deck[1].rank ? 1 : 0;
      if (sub === "two_of_rank") return deck.slice(0, p.n as number).every((c) => c.rank === 0) ? 1 : 0;
      if (sub === "diff_suits") return new Set(deck.slice(0, 3).map((c) => c.suit)).size === 3 ? 1 : 0;
      if (sub === "k_suit") return deck.slice(0, p.n as number).filter((c) => c.suit === 0).length === p.k ? 1 : 0;
      if (sub === "first_ace_pos") return deck.findIndex((c) => c.rank === 0) + 1;
      if (sub === "first_ace_pos_gen") {
        const d = r.shuffle(Array.from({ length: p.N as number }, (_, i) => i < (p.K as number)));
        return d.indexOf(true) + 1;
      }
      if (sub === "group_before") {
        const d = r.shuffle(Array.from({ length: 52 }, (_, i) => (i < (p.a as number) ? 1 : i < (p.a as number) + (p.b as number) ? 2 : 0)));
        return d.find((x) => x > 0) === 1 ? 1 : 0;
      }
      if (sub === "first_ace_at") return deck.findIndex((c) => c.rank === 0) + 1 === p.j ? 1 : 0;
      if (sub === "flush") return new Set(deck.slice(0, 5).map((c) => c.suit)).size === 1 ? 1 : 0;
      return null;
    }
    case "urns": {
      const red = p.red as number;
      const blue = p.blue as number;
      const d = r.shuffle(balls(red, blue));
      if (sub === "both_red") return d[0] === "R" && d[1] === "R" ? 1 : 0;
      if (sub === "same_color") return d[0] === d[1] ? 1 : 0;
      if (sub === "one_each") return d[0] !== d[1] ? 1 : 0;
      if (sub === "second_red") return d[1] === "R" ? 1 : 0;
      if (sub === "k_red") return d.slice(0, p.n as number).filter((x) => x === "R").length === p.k ? 1 : 0;
      if (sub === "last_ball") return d[d.length - 1] === "R" ? 1 : 0;
      if (sub === "polya") {
        const N = red + blue;
        const first = r.next() < red / N;
        const r2 = red + (first ? (p.c as number) : 0);
        const second = r.next() < r2 / (N + (p.c as number));
        return (p.both ? first && second : second) ? 1 : 0;
      }
      if (sub === "transfer") {
        const moved = d[0];
        const urnB = [...balls(p.r2 as number, p.b2 as number), moved];
        return r.pick(urnB) === "R" ? 1 : 0;
      }
      return null;
    }
    case "birthday": {
      if (sub === "share_mine") {
        for (let i = 0; i < (p.n as number); i++) if (r.int(1, 365) === 1) return 1;
        return 0;
      }
      if (sub === "min_n") return null;
      const D = (p.D as number) ?? 365;
      const n = p.n as number;
      const days = Array.from({ length: n }, () => r.int(1, D));
      if (sub === "exp_pairs") {
        let c = 0;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (days[i] === days[j]) c++;
        return c;
      }
      return new Set(days).size < n ? 1 : 0;
    }
    case "bayes": {
      if (sub === "test" || sub === "test_twice") {
        // rejection sampling: returns NaN when the conditioning event fails
        const sick = r.next() < fp(p.prev).toNumber();
        const pp = sick ? fp(p.sens).toNumber() : fp(p.fpr).toNumber();
        const pos = Array.from({ length: p.twice ? 2 : 1 }, () => r.next() < pp).every(Boolean);
        return pos ? (sick ? 1 : 0) : NaN;
      }
      if (sub === "two_coins") {
        const m = p.m as number;
        const coinIdx = r.int(0, m);
        const dh = coinIdx === m;
        const allH = Array.from({ length: p.k as number }, () => dh || r.next() < 0.5).every(Boolean);
        return allH ? (dh ? 1 : 0) : NaN;
      }
      if (sub === "two_child" || sub === "two_child_tuesday") {
        const kids = [0, 1].map(() => ({ boy: r.next() < 0.5, day: r.int(0, 6) }));
        const v = p.variant;
        const ok = v === "atleast" ? kids.some((k) => k.boy) : v === "older" ? kids[0].boy : kids.some((k) => k.boy && k.day === 2);
        return ok ? (kids.every((k) => k.boy) ? 1 : 0) : NaN;
      }
      if (sub === "monty") {
        const n = p.n as number;
        const car = r.int(0, n - 1);
        const pick = r.int(0, n - 1);
        const goats = r.shuffle(Array.from({ length: n }, (_, i) => i).filter((i) => i !== car && i !== pick));
        const opened = new Set(goats.slice(0, p.k as number));
        const rest = Array.from({ length: n }, (_, i) => i).filter((i) => i !== pick && !opened.has(i));
        return r.pick(rest) === car ? 1 : 0;
      }
      if (sub === "monty_ignorant") {
        const n = p.n as number;
        const car = r.int(0, n - 1);
        const pick = r.int(0, n - 1);
        const open = r.pick(Array.from({ length: n }, (_, i) => i).filter((i) => i !== pick));
        if (open === car) return NaN;
        const rest = Array.from({ length: n }, (_, i) => i).filter((i) => i !== pick && i !== open);
        return r.pick(rest) === car ? 1 : 0;
      }
      if (sub === "urn_bayes") {
        const a = r.next() < fp(p.prior).toNumber();
        const d = r.shuffle(a ? balls(p.rA as number, p.bA as number) : balls(p.rB as number, p.bB as number));
        return d[0] === "R" && d[1] === "R" ? (a ? 1 : 0) : NaN;
      }
      return null;
    }
    case "waiting": {
      if (sub === "coupon" || sub === "coupon_partial") {
        const seen = new Set<number>();
        let t = 0;
        while (seen.size < (p.k as number)) {
          seen.add(die(p.s as number));
          t++;
        }
        return t;
      }
      if (sub === "geom_set") {
        const seen = new Set<number>();
        let t = 0;
        while (seen.size < (p.m as number)) {
          const x = die(p.s as number);
          if (x <= (p.m as number)) seen.add(x);
          t++;
        }
        return t;
      }
      const pr = fp(p.p).toNumber();
      if (sub === "geom_mean") {
        let t = 1;
        while (r.next() >= pr) t++;
        return t;
      }
      if (sub === "geom_pmf" || sub === "geom_tail") {
        let t = 1;
        while (r.next() >= pr) t++;
        return sub === "geom_pmf" ? (t === p.k ? 1 : 0) : t > (p.k as number) ? 1 : 0;
      }
      let succ = 0;
      let t = 0;
      while (succ < (p.r as number)) {
        t++;
        if (r.next() < pr) succ++;
      }
      return sub === "negbin_mean" ? t : t === p.k ? 1 : 0;
    }
    case "ev": {
      const s = p.s as number;
      if (sub === "payout") {
        const x = die(s);
        return p.kind === "square" ? x * x : p.kind === "double_plus" ? 2 * x + 1 : (x * (x + 1)) / 2;
      }
      if (sub === "max2" || sub === "max_n") return Math.max(...Array.from({ length: p.n as number }, () => die(s)));
      if (sub === "product") return die(s) * die(s);
      if (sub === "game") {
        const x = die(6);
        return x === 6 ? (p.a as number) : x === 5 ? (p.b as number) : -(p.c as number);
      }
      if (sub === "until_tails") {
        let h = 0;
        while (r.next() < fp(p.p).toNumber()) h++;
        return h;
      }
      return null; // reroll checked by strategy enumeration
    }
    case "ruin": {
      let x = p.i as number;
      const N = p.N as number;
      const pr = fp(p.p).toNumber();
      let t = 0;
      while (x > 0 && x < N) {
        x += r.next() < pr ? 1 : -1;
        t++;
      }
      return sub.startsWith("win") ? (x === N ? 1 : 0) : t;
    }
    case "walk": {
      if (sub === "line_hit") {
        let x = 0;
        while (x < (p.a as number) && x > -(p.b as number)) x += r.next() < 0.5 ? 1 : -1;
        return x > 0 ? 1 : 0;
      }
      if (sub === "graph_return") {
        const adj = p.adj as number[][];
        let v = p.v as number;
        let t = 0;
        do {
          v = r.pick(adj[v]);
          t++;
        } while (v !== p.v);
        return t;
      }
      const n = p.n as number;
      let x = 0;
      let t = 0;
      const seen = new Set([0]);
      for (;;) {
        x = (x + (r.next() < 0.5 ? 1 : n - 1)) % n;
        t++;
        seen.add(x);
        if (sub === "cycle_return" && x === 0) return t;
        if (sub === "cycle_hit" && x === p.k) return t;
        if (sub === "cover_cycle" && seen.size === n) return t;
      }
    }
    case "markov": {
      if (sub === "craps") {
        const roll = () => die(6) + die(6);
        const s = roll();
        if (s === 7 || s === 11) return 1;
        if (s === 2 || s === 3 || s === 12) return 0;
        for (;;) {
          const x = roll();
          if (x === s) return 1;
          if (x === 7) return 0;
        }
      }
      const pr = p.p ? fp(p.p).toNumber() : 0;
      if (sub === "deuce") {
        let lead = 0;
        while (Math.abs(lead) < 2) lead += r.next() < pr ? 1 : -1;
        return lead > 0 ? 1 : 0;
      }
      if (sub === "race") {
        let a = 0;
        let b = 0;
        while (a < (p.n as number) && b < (p.n as number)) {
          if (r.next() < pr) a++;
          else b++;
        }
        return a === p.n ? 1 : 0;
      }
      const rows = (p.P as [number, string][][]).map((row) => row.map(([j, s]) => [j, Fraction.parse(s).toNumber()] as [number, number]));
      const t = p.t as number;
      let st = 0;
      let steps = 0;
      while (st < t) {
        let u = r.next();
        let nx = rows[st][rows[st].length - 1][0];
        for (const [j, pp] of rows[st]) {
          u -= pp;
          if (u < 0) {
            nx = j;
            break;
          }
        }
        st = nx;
        steps++;
      }
      return sub === "chain_steps" ? steps : st === t ? 1 : 0;
    }
    case "linearity": {
      const n = p.n as number;
      if (sub === "fixed_points") return r.shuffle(Array.from({ length: n }, (_, i) => i)).filter((x, i) => x === i).length;
      if (sub === "records") {
        let mx = -1;
        let c = 0;
        for (const x of r.shuffle(Array.from({ length: n }, (_, i) => i)))
          if (x > mx) {
            c++;
            mx = x;
          }
        return c;
      }
      if (sub === "couples") {
        const pm = r.shuffle(Array.from({ length: 2 * n }, (_, i) => i));
        let c = 0;
        for (let i = 0; i < 2 * n; i++) {
          if (i + 1 === 2 * n && !p.round) continue;
          if (Math.floor(pm[i] / 2) === Math.floor(pm[(i + 1) % (2 * n)] / 2)) c++;
        }
        return c;
      }
      if (sub === "adjacent_equal" || sub === "runs") {
        const b = Array.from({ length: n }, () => coin(0.5));
        let eq = 0;
        for (let i = 0; i + 1 < n; i++) if (b[i] === b[i + 1]) eq++;
        return sub === "runs" ? n - eq : eq;
      }
      if (sub === "distinct_values") return new Set(Array.from({ length: n }, () => die(p.s as number))).size;
      if (sub === "empty_boxes") return (p.m as number) - new Set(Array.from({ length: n }, () => die(p.m as number))).size;
      return null;
    }
    case "martingale": {
      const pr = fp(p.p).toNumber();
      const B = p.B as number;
      if (sub.startsWith("doubling")) {
        let w = B;
        let bet = 1;
        while (bet <= w) {
          if (r.next() < pr) {
            w += bet;
            return sub === "doubling_pwin" ? 1 : w - B;
          }
          w -= bet;
          bet *= 2;
        }
        return sub === "doubling_pwin" ? 0 : w - B;
      }
      let w = B;
      while (w > 0 && w < B + (p.t as number)) w += r.next() < pr ? 1 : -1;
      return w;
    }
    case "divergent": {
      if (sub === "st_pete_capped") {
        let k = 1;
        while (r.next() < 0.5) k++;
        return Math.min(2 ** k, 2 ** (p.c as number));
      }
      if (sub === "exceed_fixed") {
        const t = fp(p.t).toNumber();
        let k = 1;
        while (r.next() <= t) k++;
        return k;
      }
      if (sub === "die_atleast") {
        const f = die(6);
        let k = 1;
        while (die(6) < f) k++;
        return k;
      }
      return null;
    }
  }
  return null;
}
