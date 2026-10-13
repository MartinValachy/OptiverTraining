"use client";

import { useMemo, useRef, useState } from "react";
import { makeRng } from "@/lib/rng";
import { useExamClock, useHotkeys, useTick } from "@/lib/hooks";
import { PARAMS } from "@/modules/zapn/config";
import {
  consistentCount,
  dialHit,
  grillStatus,
  grillTap,
  heights,
  mmFeedback,
  shapeSequence,
  towerLevel,
  type GrillSlot,
  type Pegs,
  type ShapeName,
} from "@/modules/zapn/logic";
import { SessionBar, useSessionTimer, type GameProps } from "./GameShell";
import { LRButtons } from "./games1";

const pctStr = (x: number) => `${Math.round(x * 100)}%`;
const BLOCK_COLORS = ["#5b8cff", "#f0a030", "#2fbf71"];

// ===================== Skyscraper / Tower =====================

export function TowerGame({ tutorial, durationMs, seed, onDone }: GameProps) {
  const P = PARAMS.tower;
  const rng = useMemo(() => makeRng(seed), [seed]);
  const [level, setLevel] = useState(() => ({ n: 1, blocks: P.startBlocks, ...towerLevel(makeRng(seed + 5), P.startBlocks) }));
  const [pegs, setPegs] = useState<Pegs>(level.start);
  const [sel, setSel] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [solvedInfo, setSolvedInfo] = useState<null | { pts: number; moves: number; optimal: number }>(null);
  const [stats, setStats] = useState({ points: 0, levels: 0, eff: [] as number[] });
  const done = useRef(false);
  const finish = (s = stats) => {
    if (done.current) return;
    done.current = true;
    const eff = s.eff.length ? s.eff.reduce((a, b) => a + b, 0) / s.eff.length : 0;
    onDone({ score: s.points, perf: eff, metrics: [{ label: "Levels", value: String(s.levels) }, { label: "Move efficiency", value: pctStr(eff) }] });
  };
  const left = useSessionTimer(durationMs, true, () => finish());
  const tap = (k: number) => {
    if (solvedInfo) return;
    if (sel === null) {
      if (pegs[k].length) setSel(k);
      return;
    }
    if (sel === k) return setSel(null);
    const q = pegs.map((s) => s.slice());
    q[k].push(q[sel].pop()!);
    const m = moves + 1;
    setPegs(q);
    setMoves(m);
    setSel(null);
    if (heights(q).every((h, i) => h === level.target[i])) {
      const opt = level.optimal.length;
      const pts = Math.max(1, 10 - 2 * (m - opt));
      const s = { points: stats.points + pts, levels: stats.levels + 1, eff: [...stats.eff, opt / m] };
      setStats(s);
      setSolvedInfo({ pts, moves: m, optimal: opt });
    }
  };
  const nextLevel = () => {
    if (tutorial && stats.levels >= 2) return finish();
    const blocks = Math.min(P.maxBlocks, P.startBlocks + Math.floor(stats.levels / 2));
    const lv = { n: level.n + 1, blocks, ...towerLevel(rng, blocks) };
    setLevel(lv);
    setPegs(lv.start);
    setMoves(0);
    setSolvedInfo(null);
  };
  const reset = () => {
    setPegs(level.start);
    setMoves(0);
    setSel(null);
  };
  const unit = 18;
  const maxH = Math.max(8, ...heights(level.start), ...level.target);
  return (
    <div>
      <SessionBar left={left} label={`Level ${level.n} · moves ${moves} · points ${stats.points}`} />
      <div className="card grid grid-cols-3 gap-2 p-3">
        {pegs.map((stack, k) => (
          <button key={k} onClick={() => tap(k)} className={`relative flex flex-col-reverse items-center rounded-lg border p-1 ${sel === k ? "border-accent" : "border-line"}`} style={{ height: maxH * unit + 40 }} data-testid={`tower-peg-${k}`}>
            <div className="absolute left-0 right-0 border-t-2 border-dashed border-good" style={{ bottom: level.target[k] * unit + 4 + 20 }} />
            <span className="tabular absolute bottom-0.5 text-[11px] text-muted">
              {heights(pegs)[k]} / {level.target[k]}
            </span>
            <div className="h-5" />
            {stack.map((b, j) => (
              <div key={j} className={`w-4/5 rounded ${sel === k && j === stack.length - 1 ? "ring-2 ring-accent" : ""}`} style={{ height: b * unit - 2, marginTop: 2, background: BLOCK_COLORS[(b - 1) % 3] }} />
            ))}
          </button>
        ))}
      </div>
      {solvedInfo ? (
        <div className="card mt-3 p-3 text-sm">
          <p className="mb-1 font-medium text-good">
            Level done in {solvedInfo.moves} moves (optimal {solvedInfo.optimal}) · +{solvedInfo.pts}
          </p>
          <p className="text-muted">Optimal: {level.optimal.map(([a, b]) => `${a + 1}→${b + 1}`).join(", ")}</p>
          <button className="btn btn-primary mt-2 w-full" onClick={nextLevel} data-testid="tower-next">
            Next level
          </button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button className="btn" onClick={reset}>
            Reset level
          </button>
          <p className="self-center text-xs text-muted">Dashed line = target height. Tap a tower to lift its top block, tap another to drop it.</p>
        </div>
      )}
    </div>
  );
}

// ===================== Shapeshift =====================

function ShapeSvg({ s, color }: { s: ShapeName; color: string }) {
  const c = 50;
  return (
    <svg viewBox="0 0 100 100" className="h-32 w-32" aria-label={s}>
      {s === "circle" && <circle cx={c} cy={c} r={38} fill={color} />}
      {s === "square" && <rect x={14} y={14} width={72} height={72} fill={color} />}
      {s === "triangle" && <polygon points="50,10 90,88 10,88" fill={color} />}
      {s === "diamond" && <polygon points="50,6 92,50 50,94 8,50" fill={color} />}
      {s === "star" && <polygon points="50,6 61,38 95,38 67,58 78,92 50,72 22,92 33,58 5,38 39,38" fill={color} />}
    </svg>
  );
}

export function ShapeshiftGame({ tutorial, durationMs, seed, onDone }: GameProps) {
  const P = PARAMS.shapeshift;
  const seq = useMemo(() => shapeSequence(makeRng(seed), 400, P.sameProb), [seed, P.sameProb]);
  const colours = useMemo(() => {
    const r = makeRng(seed + 9);
    return seq.map((_, i) => (i >= P.colourDistractorFrom ? r.pick(["#5b8cff", "#f0a030", "#2fbf71", "#e05d9b"]) : "#5b8cff"));
  }, [seq, seed, P.colourDistractorFrom]);
  const clock = useExamClock();
  const [i, setI] = useState(0);
  const [start, setStart] = useState(0);
  const [fb, setFb] = useState<null | boolean>(null);
  const [res, setRes] = useState<{ correct: boolean; rt: number }[]>([]);
  const done = useRef(false);
  const finish = (rs = res) => {
    if (done.current) return;
    done.current = true;
    const c = rs.filter((x) => x.correct).length;
    onDone({ score: c - (rs.length - c), perf: rs.length ? c / rs.length : 0, metrics: [{ label: "Accuracy", value: rs.length ? pctStr(c / rs.length) : "–" }, { label: "Responses", value: String(rs.length) }], rts: rs.filter((x) => x.correct).map((x) => x.rt) });
  };
  const left = useSessionTimer(durationMs, true, () => finish());
  const advance = (rs: typeof res) => {
    setTimeout(() => {
      if (done.current) return;
      if (tutorial && rs.length >= 10) return finish(rs);
      setI((x) => x + 1);
      setFb(null);
      setStart(clock.now());
    }, 200);
  };
  const answer = (correct: boolean, rt: number) => {
    const rs = [...res, { correct, rt }];
    setRes(rs);
    setFb(correct);
    advance(rs);
  };
  useTick(
    () => {
      const t = clock.now() - start;
      if (i === 0 && t > 1000 && fb === null) {
        setFb(true);
        advance(res);
      } else if (i > 0 && fb === null && t > P.stimulusMs) answer(false, P.stimulusMs);
    },
    50,
    fb === null,
  );
  const pick = (side: "left" | "right") => {
    if (fb !== null || i === 0) return;
    answer((side === "left") === (seq[i] === seq[i - 1]), clock.now() - start);
  };
  useHotkeys(
    (e) => {
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "f") pick("left");
      else if (k === "arrowright" || k === "j") pick("right");
    },
    [fb, i, start, res],
  );
  return (
    <div>
      <SessionBar left={left} label={i === 0 ? "Remember this shape…" : `${res.filter((r) => r.correct).length}/${res.length} correct`} />
      <div className="card flex h-56 items-center justify-center" data-testid="shape-stage">
        <ShapeSvg s={seq[i]} color={colours[i]} />
      </div>
      <div className={`h-5 text-center text-sm ${fb === null || i === 0 ? "" : fb ? "text-good" : "text-bad"}`}>{fb === null || i === 0 ? "" : fb ? "✓" : "✗"}</div>
      <LRButtons left="Same" right="Different" onPick={pick} disabled={fb !== null || i === 0} />
    </div>
  );
}

// ===================== Grill Master =====================

export function GrillGame({ tutorial, durationMs, seed, onDone }: GameProps) {
  const P = PARAMS.grill;
  const rng = useMemo(() => makeRng(seed), [seed]);
  const clock = useExamClock();
  const [slots, setSlots] = useState<GrillSlot[]>(() => Array.from({ length: P.grills }, () => ({ item: null, start: 0, flipped: false, flippedAt: 0 })));
  const [orders, setOrders] = useState<number[]>([0]);
  const [lastOrder, setLastOrder] = useState(0);
  const [now, setNow] = useState(0);
  const [st, setSt] = useState({ served: 0, burnt: 0, early: 0, good: 0, taps: 0, points: 0 });
  const [toast, setToast] = useState<string | null>(null);
  const done = useRef(false);
  const finish = (s = st) => {
    if (done.current) return;
    done.current = true;
    const minutes = durationMs / 60_000;
    const possible = Math.max(1, durationMs / P.orderEveryMs);
    onDone({
      score: s.points,
      perf: Math.min(1, s.served / possible),
      metrics: [
        { label: "Served", value: String(s.served) },
        { label: "Throughput", value: `${(s.served / minutes).toFixed(1)}/min` },
        { label: "Accuracy", value: s.taps ? pctStr(s.good / s.taps) : "–" },
        { label: "Burnt", value: String(s.burnt) },
      ],
    });
  };
  const left = useSessionTimer(tutorial ? Math.min(durationMs, 45_000) : durationMs, true, () => finish());
  useTick(
    () => {
      const t = clock.now();
      setNow(t);
      if (t - lastOrder >= (tutorial ? P.orderEveryMs * 1.5 : P.orderEveryMs) && orders.length < 6) {
        setOrders((o) => [...o, rng.int(0, P.items.length - 1)]);
        setLastOrder(t);
      }
      // burnt items are removed automatically
      let burntNow = 0;
      const ns = slots.map((s) => {
        if (grillStatus(s, t, P) === "burnt") {
          burntNow++;
          return { item: null, start: 0, flipped: false, flippedAt: 0 };
        }
        return s;
      });
      if (burntNow) {
        setSlots(ns);
        setSt((x) => ({ ...x, burnt: x.burnt + burntNow, points: x.points - 5 * burntNow }));
        setToast("Burnt! −5");
      }
    },
    100,
    true,
  );
  const tap = (k: number) => {
    const t = clock.now();
    const { slot, event } = grillTap(slots[k], t, P, orders.length ? orders[0] : null);
    if (event === "none") return;
    const ns = slots.slice();
    ns[k] = slot;
    setSlots(ns);
    if (event === "placed") setOrders(orders.slice(1));
    const good = event === "placed" || event === "flipped" || event === "served";
    setSt((x) => ({
      ...x,
      taps: x.taps + 1,
      good: x.good + (good ? 1 : 0),
      served: x.served + (event === "served" ? 1 : 0),
      early: x.early + (event === "early" ? 1 : 0),
      points: x.points + (event === "served" ? 10 : event === "flipped" ? 1 : event === "early" ? -2 : 0),
    }));
    setToast(event === "served" ? "Served +10" : event === "flipped" ? "Flipped +1" : event === "early" ? "Too early −2" : null);
  };
  return (
    <div>
      <SessionBar left={left} label={`points ${st.points} · served ${st.served}`} />
      <div className="mb-2 flex min-h-8 flex-wrap items-center gap-1 text-xs">
        <span className="text-muted">Orders:</span>
        {orders.map((o, k) => (
          <span key={k} className={`rounded-full border px-2 py-0.5 ${k === 0 ? "border-accent" : "border-line text-muted"}`}>
            {P.items[o].name}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {slots.map((s, k) => {
          const status = grillStatus(s, now, P);
          const cook = s.item === null ? 1 : P.items[s.item].cookMs;
          const prog = s.item === null ? 0 : Math.min(1, (now - s.start) / cook);
          return (
            <button
              key={k}
              onClick={() => tap(k)}
              className={`card flex min-h-36 flex-col items-center justify-center gap-1 p-2 ${status === "flip" ? "border-warn" : status === "serve" ? "border-good" : ""}`}
              data-testid={`grill-${k}`}
            >
              <span className="text-xs text-muted">Grill {k + 1}</span>
              <span className="text-sm font-medium">{s.item === null ? "empty" : P.items[s.item].name}</span>
              {s.item !== null && (
                <div className="h-1.5 w-full overflow-hidden rounded bg-card2">
                  <div className="h-full bg-accent" style={{ width: `${prog * 100}%` }} />
                </div>
              )}
              <span className={`text-xs font-bold ${status === "flip" ? "text-warn" : status === "serve" ? "text-good" : "text-muted"}`}>
                {status === "flip" ? "FLIP!" : status === "serve" ? "SERVE!" : status === "empty" ? "tap to start" : s.flipped ? "side 2" : "side 1"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 h-5 text-center text-sm text-muted">{toast}</div>
    </div>
  );
}

// ===================== Pattern Guess (Mastermind) =====================

const SYMBOL_COLORS = ["#5b8cff", "#f0a030", "#2fbf71", "#e05d9b", "#a070ff", "#e5e5e5"];

export function PatternGame({ tutorial, durationMs, seed, onDone }: GameProps) {
  const P = PARAMS.pattern;
  const rng = useMemo(() => makeRng(seed), [seed]);
  const newCode = () => Array.from({ length: P.length }, () => rng.int(0, P.symbols - 1));
  const [code, setCode] = useState(() => {
    const r = makeRng(seed + 11);
    return Array.from({ length: P.length }, () => r.int(0, P.symbols - 1));
  });
  const [guess, setGuess] = useState<number[]>([]);
  const [hist, setHist] = useState<{ guess: number[]; exact: number; partial: number; remaining: number }[]>([]);
  const [stats, setStats] = useState({ points: 0, solved: 0, codes: 0, guesses: 0 });
  const [reveal, setReveal] = useState<string | null>(null);
  const done = useRef(false);
  const finish = (s = stats) => {
    if (done.current) return;
    done.current = true;
    onDone({ score: s.points, perf: s.codes ? Math.min(1, s.points / s.codes / 7) : 0, metrics: [{ label: "Codes cracked", value: `${s.solved}/${s.codes}` }, { label: "Avg guesses", value: s.solved ? (s.guesses / s.solved).toFixed(1) : "–" }] });
  };
  const left = useSessionTimer(durationMs, true, () => finish());
  const submit = () => {
    if (guess.length !== P.length || reveal) return;
    const f = mmFeedback(code, guess);
    const h = [...hist, { guess, ...f, remaining: 0 }];
    h[h.length - 1].remaining = consistentCount(h, P.length, P.symbols);
    setHist(h);
    setGuess([]);
    const solved = f.exact === P.length;
    if (solved || h.length >= P.maxGuesses) {
      const pts = solved ? P.maxGuesses + 1 - h.length : 0;
      const s = { points: stats.points + pts, solved: stats.solved + (solved ? 1 : 0), codes: stats.codes + 1, guesses: stats.guesses + (solved ? h.length : 0) };
      setStats(s);
      setReveal(solved ? `Cracked in ${h.length}! +${pts}` : "Out of guesses.");
      setTimeout(() => {
        if (done.current) return;
        if (tutorial && s.codes >= 1) return finish(s);
        setCode(newCode());
        setHist([]);
        setReveal(null);
      }, 1800);
    }
  };
  const Peg = ({ s }: { s: number }) => <span className="inline-block h-6 w-6 rounded-full" style={{ background: SYMBOL_COLORS[s] }} />;
  return (
    <div>
      <SessionBar left={left} label={`points ${stats.points} · code ${stats.codes + 1}`} />
      <div className="card mb-3 space-y-1.5 p-3" data-testid="pattern-history">
        {hist.length === 0 && <p className="text-sm text-muted">Make your first guess.</p>}
        {hist.map((h, k) => (
          <div key={k} className="flex items-center gap-2">
            <span className="tabular w-5 text-xs text-muted">{k + 1}</span>
            {h.guess.map((s, j) => (
              <Peg key={j} s={s} />
            ))}
            <span className="ml-2 font-mono text-sm">
              {"●".repeat(h.exact)}
              {"○".repeat(h.partial)}
            </span>
            <span className="ml-auto text-xs text-muted">{h.remaining} codes still possible</span>
          </div>
        ))}
        {reveal && (
          <div className="flex items-center gap-2 pt-1 text-sm">
            <span className="text-muted">Code:</span>
            {code.map((s, j) => (
              <Peg key={j} s={s} />
            ))}
            <span className="ml-2">{reveal}</span>
          </div>
        )}
      </div>
      <div className="mb-2 flex min-h-8 items-center gap-2">
        {Array.from({ length: P.length }, (_, j) => (
          <span key={j} className="inline-block h-8 w-8 rounded-full border border-line" style={{ background: guess[j] !== undefined ? SYMBOL_COLORS[guess[j]] : "transparent" }} />
        ))}
      </div>
      <div className="grid grid-cols-6 gap-2">
        {SYMBOL_COLORS.slice(0, P.symbols).map((c, s) => (
          <button key={s} className="h-12 rounded-lg border border-line" style={{ background: c }} onClick={() => guess.length < P.length && setGuess([...guess, s])} aria-label={`symbol ${s + 1}`} data-testid={`pattern-sym-${s}`} />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button className="btn" onClick={() => setGuess(guess.slice(0, -1))}>
          ⌫
        </button>
        <button className="btn btn-primary col-span-2" disabled={guess.length !== P.length || !!reveal} onClick={submit} data-testid="pattern-submit">
          Guess
        </button>
      </div>
    </div>
  );
}

// ===================== Stock Indicator / Dial =====================

export function DialGame({ tutorial, durationMs, seed, onDone }: GameProps) {
  const P = PARAMS.dial;
  const rng = useMemo(() => makeRng(seed), [seed]);
  const clock = useExamClock();
  const [round, setRound] = useState(() => ({ n: 0, start: 0, speed: P.startDegPerSec, zone: makeRng(seed + 2).int(60, 300), from: 0 }));
  const [now, setNow] = useState(0);
  const [fb, setFb] = useState<null | { hit: boolean; err: number }>(null);
  const [res, setRes] = useState<{ hit: boolean; errMs: number }[]>([]);
  const done = useRef(false);
  const rounds = tutorial ? 6 : P.rounds;
  const finish = (rs = res) => {
    if (done.current) return;
    done.current = true;
    const hits = rs.filter((x) => x.hit).length;
    onDone({
      score: hits,
      perf: rs.length ? hits / rs.length : 0,
      metrics: [
        { label: "Hit rate", value: rs.length ? pctStr(hits / rs.length) : "–" },
        { label: "Final speed", value: `${Math.round(round.speed)}°/s` },
        { label: "Mean signed error", value: rs.length ? `${Math.round(rs.reduce((a, x) => a + x.errMs, 0) / rs.length)} ms` : "–" },
      ],
      rts: rs.map((x) => Math.abs(x.errMs)),
    });
  };
  const left = useSessionTimer(durationMs, true, () => finish());
  const angle = round.from + ((now - round.start) / 1000) * round.speed;
  const record = (hit: boolean, errDeg: number) => {
    const rs = [...res, { hit, errMs: (errDeg / round.speed) * 1000 }];
    setRes(rs);
    setFb({ hit, err: errDeg });
    setTimeout(() => {
      if (done.current) return;
      if (rs.length >= rounds) return finish(rs);
      setFb(null);
      setRound({ n: round.n + 1, start: clock.now(), speed: round.speed * P.speedUp, zone: rng.int(0, 359), from: rng.int(0, 359) });
    }, 600);
  };
  useTick(
    () => {
      const t = clock.now();
      setNow(t);
      // missed: two full sweeps without a tap
      if (fb === null && ((t - round.start) / 1000) * round.speed > 720 + 360) record(false, 180);
    },
    16,
    fb === null,
  );
  const tap = () => {
    if (fb !== null) return;
    const a = round.from + ((clock.now() - round.start) / 1000) * round.speed;
    const h = dialHit(a, round.zone, P.zoneDeg);
    record(h.hit, h.error);
  };
  useHotkeys(
    (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        tap();
      }
    },
    [fb, round],
  );
  const R = 90;
  const pt = (deg: number, r: number) => [100 + r * Math.sin((deg * Math.PI) / 180), 100 - r * Math.cos((deg * Math.PI) / 180)];
  const [zx1, zy1] = pt(round.zone - P.zoneDeg / 2, R);
  const [zx2, zy2] = pt(round.zone + P.zoneDeg / 2, R);
  const [nx, ny] = pt(angle, R - 8);
  return (
    <div>
      <SessionBar left={left} label={`round ${Math.min(res.length + 1, rounds)}/${rounds} · ${res.filter((x) => x.hit).length} hits`} />
      <button className="card mx-auto block w-full max-w-xs p-2" onPointerDown={tap} data-testid="dial">
        <svg viewBox="0 0 200 200" className="w-full" aria-label="dial">
          <circle cx={100} cy={100} r={R} fill="none" stroke="var(--border)" strokeWidth={8} />
          <path d={`M ${zx1} ${zy1} A ${R} ${R} 0 0 1 ${zx2} ${zy2}`} fill="none" stroke="#2fbf71" strokeWidth={10} />
          <line x1={100} y1={100} x2={nx} y2={ny} stroke="var(--fg)" strokeWidth={3} strokeLinecap="round" />
          <circle cx={100} cy={100} r={5} fill="var(--fg)" />
        </svg>
      </button>
      <div className={`mt-2 h-5 text-center text-sm ${fb ? (fb.hit ? "text-good" : "text-bad") : ""}`}>{fb ? (fb.hit ? "Hit" : `Miss by ${Math.abs(Math.round(fb.err))}°`) : "Tap when the needle is in the green zone"}</div>
    </div>
  );
}
