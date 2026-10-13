"use client";

import { useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Legend } from "recharts";
import { makeRng } from "@/lib/rng";
import { useExamClock, useHotkeys, useTick } from "@/lib/hooks";
import { PARAMS } from "@/modules/zapn/config";
import {
  balloonOptimalStop,
  balloonPopPoint,
  checkNumberBox,
  codePair,
  nextWindow,
  numberPuzzle,
  pinDigits,
  pinNextLength,
  switchAnswer,
  switchCost,
  switchTrials,
} from "@/modules/zapn/logic";
import { SessionBar, useSessionTimer, type GameProps, type GameResult } from "./GameShell";

const pctStr = (x: number) => `${Math.round(x * 100)}%`;

// ===================== Balloon =====================

interface BalloonRec {
  colour: number;
  pumps: number;
  popped: boolean;
  pop: number;
}

export function BalloonGame({ tutorial, durationMs, seed, onDone }: GameProps) {
  const P = PARAMS.balloon;
  const n = tutorial ? 6 : P.balloons;
  const plan = useMemo(() => {
    const r = makeRng(seed);
    const colours = r.shuffle(Array.from({ length: n }, (_, i) => i % P.colours.length));
    return colours.map((c) => ({ colour: c, pop: balloonPopPoint(r, P.colours[c].max) }));
  }, [seed, n, P.colours]);
  const [i, setI] = useState(0);
  const [pumps, setPumps] = useState(0);
  const [bank, setBank] = useState(0);
  const [recs, setRecs] = useState<BalloonRec[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const done = useRef(false);

  const finish = (records: BalloonRec[], total: number) => {
    if (done.current) return;
    done.current = true;
    const per = P.colours.map((c, ci) => {
      const mine = records.filter((x) => x.colour === ci);
      const collected = mine.filter((x) => !x.popped);
      const opt = balloonOptimalStop(c.max);
      return {
        name: c.name,
        max: c.max,
        optimalK: opt.k,
        optimalEv: opt.ev * P.pumpValue,
        avgPumpsCollected: collected.length ? collected.reduce((a, x) => a + x.pumps, 0) / collected.length : 0,
        avgEarned: mine.length ? mine.filter((x) => !x.popped).reduce((a, x) => a + x.pumps * P.pumpValue, 0) / mine.length : 0,
        pops: mine.map((x) => x.pop),
        n: mine.length,
      };
    });
    const optTotal = per.reduce((a, p) => a + p.optimalEv * p.n, 0);
    onDone({
      score: Math.round(total * 100) / 100,
      perf: optTotal ? Math.min(1, total / optTotal) : 0,
      metrics: [
        { label: "Balloons", value: String(records.length) },
        { label: "Popped", value: String(records.filter((x) => x.popped).length) },
      ],
      analysis: { per },
    });
  };
  const left = useSessionTimer(durationMs, true, () => finish(recs, bank));

  const cur = plan[i];
  const next = (rec: BalloonRec, newBank: number) => {
    const rs = [...recs, rec];
    setRecs(rs);
    setPumps(0);
    if (i + 1 >= plan.length) finish(rs, newBank);
    else setI(i + 1);
  };
  const pump = () => {
    if (!cur || flash) return;
    const p = pumps + 1;
    if (p >= cur.pop) {
      setFlash("POP!");
      setTimeout(() => {
        setFlash(null);
        next({ colour: cur.colour, pumps: p, popped: true, pop: cur.pop }, bank);
      }, 500);
      setPumps(p);
    } else setPumps(p);
  };
  const collect = () => {
    if (!cur || flash) return;
    const nb = bank + pumps * P.pumpValue;
    setBank(nb);
    next({ colour: cur.colour, pumps, popped: false, pop: cur.pop }, nb);
  };
  useHotkeys(
    (e) => {
      if (e.key === " ") {
        e.preventDefault();
        pump();
      } else if (e.key === "Enter") {
        e.preventDefault();
        collect();
      }
    },
    [pumps, i, flash, bank, recs],
  );
  if (!cur) return null;
  const colour = P.colours[cur.colour];
  const size = 60 + Math.min(1, pumps / 64) * 140;
  return (
    <div>
      <SessionBar left={left} label={`Balloon ${i + 1}/${plan.length} · banked $${bank.toFixed(2)}`} />
      <div className="card flex h-72 flex-col items-center justify-center gap-2">
        {flash ? (
          <div className="text-4xl font-black text-bad">{flash}</div>
        ) : (
          <div className="rounded-full transition-all duration-100" style={{ width: size, height: size * 1.15, background: colour.color, opacity: 0.9 }} aria-label={`${colour.name} balloon`} />
        )}
        <div className="tabular text-sm text-muted">
          {colour.name} · this balloon ${(pumps * P.pumpValue).toFixed(2)} ({pumps} pumps)
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button className="btn btn-primary min-h-14 text-base" onClick={pump} data-testid="balloon-pump">
          Pump <span className="kbd">Space</span>
        </button>
        <button className="btn min-h-14 text-base" onClick={collect} data-testid="balloon-collect">
          Collect <span className="kbd">Enter</span>
        </button>
      </div>
    </div>
  );
}

export function BalloonAnalysis({ result }: { result: GameResult }) {
  const per = (result.analysis?.per ?? []) as {
    name: string;
    max: number;
    optimalK: number;
    optimalEv: number;
    avgPumpsCollected: number;
    avgEarned: number;
    pops: number[];
  }[];
  const bins = Array.from({ length: 8 }, (_, b) => ({
    bin: `${b * 8 + 1}–${b * 8 + 8}`,
    ...Object.fromEntries(per.map((p) => [p.name, p.pops.filter((x) => x > b * 8 && x <= b * 8 + 8).length])),
  }));
  return (
    <div className="space-y-3">
      <div className="card p-3 text-sm">
        <div className="mb-2 font-medium">EV-optimal stopping rule vs you</div>
        <table className="tabular w-full text-xs">
          <thead className="text-muted">
            <tr>
              <th className="text-left font-normal">Colour</th>
              <th className="font-normal">Pops at</th>
              <th className="font-normal">Optimal pumps</th>
              <th className="font-normal">Your avg</th>
              <th className="font-normal">EV/balloon (opt)</th>
              <th className="font-normal">You</th>
            </tr>
          </thead>
          <tbody>
            {per.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td className="text-center">1–{p.max}</td>
                <td className="text-center">{p.optimalK}</td>
                <td className="text-center">{p.avgPumpsCollected.toFixed(1)}</td>
                <td className="text-center">${p.optimalEv.toFixed(2)}</td>
                <td className="text-center">${p.avgEarned.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">
          With the pop point uniform on 1..M, stopping after k pumps earns k·v with probability (M−k)/M, maximised at k = M/2. Pumping less leaves money on the table; pumping more costs more in pops than it adds.
        </p>
      </div>
      <div className="card h-48 p-2">
        <ResponsiveContainer>
          <BarChart data={bins} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="bin" tick={{ fill: "var(--muted)", fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 10 }} />
            {per.map((p, i) => (
              <Bar key={p.name} dataKey={p.name} fill={PARAMS.balloon.colours[i]?.color ?? "#888"} isAnimationActive={false} />
            ))}
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted">Pop points of this session&apos;s balloons.</p>
    </div>
  );
}

// ===================== Pincode =====================

export function PincodeGame({ tutorial, durationMs, seed, onDone }: GameProps) {
  const P = PARAMS.pincode;
  const rng = useMemo(() => makeRng(seed), [seed]);
  const [len, setLen] = useState(P.startLength);
  const [code, setCode] = useState(() => pinDigits(makeRng(seed + 1), P.startLength));
  const [phase, setPhase] = useState<"show" | "input" | "feedback">("show");
  const [input, setInput] = useState("");
  const [last, setLast] = useState<boolean | null>(null);
  const [stats, setStats] = useState({ tries: 0, correct: 0, best: 0 });
  const shownAt = useRef(0);
  const clock = useExamClock();
  const done = useRef(false);
  const finish = (s = stats) => {
    if (done.current) return;
    done.current = true;
    onDone({ score: s.best, perf: Math.max(0, Math.min(1, (s.best - 3) / 6)), metrics: [{ label: "Codes", value: String(s.tries) }, { label: "Correct", value: String(s.correct) }] });
  };
  const left = useSessionTimer(durationMs, true, () => finish());
  useTick(
    () => {
      if (phase === "show" && clock.now() - shownAt.current >= P.showMsBase + P.showMsPerDigit * code.length) setPhase("input");
    },
    50,
    phase === "show",
  );
  const submit = () => {
    if (phase !== "input" || done.current) return;
    const ok = input.trim() === code;
    const s = { tries: stats.tries + 1, correct: stats.correct + (ok ? 1 : 0), best: ok ? Math.max(stats.best, code.length) : stats.best };
    setStats(s);
    setLast(ok);
    setPhase("feedback");
    setTimeout(() => {
      if (done.current) return;
      if (tutorial && s.tries >= 4) return finish(s);
      const nl = pinNextLength(len, ok, P.minLength);
      setLen(nl);
      setCode(pinDigits(rng, nl));
      setInput("");
      shownAt.current = clock.now();
      setPhase("show");
    }, 700);
  };
  return (
    <div>
      <SessionBar left={left} label={`Length ${len} · best ${stats.best}`} />
      <div className="card flex h-40 items-center justify-center">
        {phase === "show" ? (
          <span className="tabular font-mono text-4xl tracking-[0.3em]" data-testid="pin-code">
            {code}
          </span>
        ) : phase === "feedback" ? (
          <span className={`text-xl font-semibold ${last ? "text-good" : "text-bad"}`}>{last ? "Correct" : `It was ${code}`}</span>
        ) : (
          <span className="text-muted">Type the code</span>
        )}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          className="input text-center font-mono text-2xl tracking-widest"
          inputMode="numeric"
          autoComplete="off"
          value={input}
          disabled={phase !== "input"}
          onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))}
          ref={(el) => {
            if (el && phase === "input") el.focus();
          }}
          aria-label="Code"
          data-testid="pin-input"
        />
        <button className="btn btn-primary" disabled={phase !== "input"}>
          OK
        </button>
      </form>
    </div>
  );
}

// ===================== Left/right response helper =====================

function useLeftRight(handler: (side: "left" | "right") => void, deps: unknown[]) {
  useHotkeys((e) => {
    const k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "f") {
      e.preventDefault();
      handler("left");
    } else if (k === "arrowright" || k === "j") {
      e.preventDefault();
      handler("right");
    }
  }, deps);
}

export function LRButtons({ left, right, onPick, disabled }: { left: string; right: string; onPick: (s: "left" | "right") => void; disabled?: boolean }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button className="btn min-h-16 text-base" onPointerDown={() => !disabled && onPick("left")} disabled={disabled} data-testid="resp-left">
        {left} <span className="kbd">F</span>
      </button>
      <button className="btn min-h-16 text-base" onPointerDown={() => !disabled && onPick("right")} disabled={disabled} data-testid="resp-right">
        {right} <span className="kbd">J</span>
      </button>
    </div>
  );
}

// ===================== CodeCompare =====================

export function CodeCompareGame({ tutorial, durationMs, seed, onDone }: GameProps) {
  const P = PARAMS.codecompare;
  const rng = useMemo(() => makeRng(seed), [seed]);
  const clock = useExamClock();
  const [win, setWin] = useState(tutorial ? 4000 : P.startWindowMs);
  const [pair, setPair] = useState(() => codePair(makeRng(seed + 7), P.minLen, P.diffProb));
  const [start, setStart] = useState(0);
  const [gap, setGap] = useState<null | boolean>(null);
  const [res, setRes] = useState<{ correct: boolean; rt: number }[]>([]);
  const [now, setNow] = useState(0);
  const done = useRef(false);
  const finish = (rs = res) => {
    if (done.current) return;
    done.current = true;
    const c = rs.filter((x) => x.correct).length;
    onDone({
      score: c - (rs.length - c),
      perf: rs.length ? c / rs.length : 0,
      metrics: [
        { label: "Accuracy", value: rs.length ? pctStr(c / rs.length) : "–" },
        { label: "Final window", value: `${Math.round(win)} ms` },
      ],
      rts: rs.filter((x) => x.correct).map((x) => x.rt),
    });
  };
  const left = useSessionTimer(durationMs, true, () => finish());
  const answer = (correct: boolean, rt: number) => {
    const rs = [...res, { correct, rt }];
    setRes(rs);
    setGap(correct);
    setWin(nextWindow(win, correct, P));
    setTimeout(() => {
      if (done.current) return;
      if (tutorial && rs.length >= 10) return finish(rs);
      setPair(codePair(rng, rng.int(P.minLen, P.maxLen), P.diffProb));
      setGap(null);
      setStart(clock.now());
    }, 350);
  };
  useTick(
    () => {
      const t = clock.now();
      setNow(t);
      if (gap === null && t - start > win) answer(false, win);
    },
    50,
    gap === null,
  );
  const pick = (side: "left" | "right") => {
    if (gap !== null || done.current) return;
    answer((side === "left") === pair.same, clock.now() - start);
  };
  useLeftRight(pick, [gap, pair, start, win, res]);
  const frac = gap === null ? Math.max(0, 1 - (now - start) / win) : 0;
  return (
    <div>
      <SessionBar left={left} label={`window ${Math.round(win)} ms · ${res.filter((r) => r.correct).length}/${res.length}`} />
      <div className="card flex flex-col items-center gap-3 p-6">
        <div className="tabular font-mono text-3xl tracking-[0.25em]" data-testid="cc-a">
          {pair.a}
        </div>
        <div className="tabular font-mono text-3xl tracking-[0.25em]" data-testid="cc-b">
          {pair.b}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded bg-card2">
          <div className={`h-full ${gap === null ? "bg-accent" : gap ? "bg-good" : "bg-bad"}`} style={{ width: `${(gap === null ? frac : 1) * 100}%` }} />
        </div>
      </div>
      <LRButtons left="Same" right="Different" onPick={pick} disabled={gap !== null} />
    </div>
  );
}

// ===================== The Switch =====================

export function SwitchGame({ tutorial, durationMs, seed, onDone }: GameProps) {
  const P = PARAMS.switch;
  const trials = useMemo(() => switchTrials(makeRng(seed), tutorial ? 12 : P.trials, P.randomSwitch, P.switchProb), [seed, tutorial, P]);
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
    const sc = switchCost(trials.slice(0, rs.length), rs);
    onDone({
      score: c,
      perf: rs.length ? c / rs.length : 0,
      metrics: [
        { label: "Accuracy", value: rs.length ? pctStr(c / rs.length) : "–" },
        { label: "Switch cost", value: `${Math.round(sc.cost)} ms` },
        { label: "Switch / repeat RT", value: `${Math.round(sc.switchRt)} / ${Math.round(sc.repeatRt)} ms` },
      ],
      rts: rs.filter((x) => x.correct).map((x) => x.rt),
      analysis: sc,
    });
  };
  const left = useSessionTimer(durationMs, true, () => finish());
  const t = trials[i];
  const answer = (correct: boolean, rt: number) => {
    const rs = [...res, { correct, rt }];
    setRes(rs);
    setFb(correct);
    setTimeout(() => {
      if (done.current) return;
      if (i + 1 >= trials.length) return finish(rs);
      setI(i + 1);
      setFb(null);
      setStart(clock.now());
    }, 250);
  };
  useTick(
    () => {
      if (fb === null && clock.now() - start > P.timeoutMs) answer(false, P.timeoutMs);
    },
    50,
    fb === null,
  );
  const pick = (side: "left" | "right") => {
    if (fb !== null || !t || done.current) return;
    answer(side === switchAnswer(t), clock.now() - start);
  };
  useLeftRight(pick, [fb, i, start, res]);
  if (!t) return null;
  return (
    <div>
      <SessionBar left={left} label={`trial ${i + 1}/${trials.length}`} />
      <div className="card flex flex-col items-center gap-4 p-6">
        <div className={`rounded-full px-4 py-1 text-sm font-bold tracking-widest ${t.rule === "number" ? "bg-accent/20 text-accent" : "bg-warn/20 text-warn"}`} data-testid="switch-cue">
          {t.rule === "number" ? "NUMBER" : "ARROW"}
        </div>
        <div className="flex items-center gap-6 text-5xl">
          <span className="tabular font-mono">{t.n}</span>
          <span>{t.arrow === "left" ? "←" : "→"}</span>
        </div>
        <div className={`h-5 text-sm ${fb === null ? "" : fb ? "text-good" : "text-bad"}`}>{fb === null ? "" : fb ? "✓" : "✗"}</div>
      </div>
      <LRButtons left={t.rule === "number" ? "Odd / ←" : "←"} right={t.rule === "number" ? "Even / →" : "→"} onPick={pick} disabled={fb !== null} />
    </div>
  );
}

// ===================== NumberBox =====================

type Tok = { t: string; idx?: number };

export function NumberBoxGame({ tutorial, durationMs, seed, onDone }: GameProps) {
  const P = PARAMS.numberbox;
  const rng = useMemo(() => makeRng(seed), [seed]);
  const [puz, setPuz] = useState(() => numberPuzzle(makeRng(seed + 3), P.targets, P.minN, P.maxN));
  const [toks, setToks] = useState<Tok[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [stats, setStats] = useState({ solved: 0, skipped: 0 });
  const done = useRef(false);
  const finish = (s = stats) => {
    if (done.current) return;
    done.current = true;
    const minutes = durationMs / 60_000;
    onDone({ score: s.solved, perf: Math.min(1, s.solved / Math.max(1, minutes * 2)), metrics: [{ label: "Skipped", value: String(s.skipped) }] });
  };
  const left = useSessionTimer(durationMs, true, () => finish());
  const used = new Set(toks.filter((x) => x.idx !== undefined).map((x) => x.idx));
  const expr = toks.map((x) => x.t).join(" ");
  const nextPuzzle = (s: typeof stats) => {
    if (tutorial && s.solved + s.skipped >= 3) return finish(s);
    setPuz(numberPuzzle(rng, P.targets, P.minN, P.maxN));
    setToks([]);
    setMsg(null);
  };
  const check = () => {
    const c = checkNumberBox(expr, puz.nums, puz.target);
    if (c.ok) {
      const s = { ...stats, solved: stats.solved + 1 };
      setStats(s);
      setMsg("✓ Solved!");
      setTimeout(() => !done.current && nextPuzzle(s), 600);
    } else setMsg(c.reason ?? "Not yet");
  };
  const skip = () => {
    const s = { ...stats, skipped: stats.skipped + 1 };
    setStats(s);
    setMsg(`One solution: ${puz.solution}`);
    setTimeout(() => !done.current && nextPuzzle(s), 2200);
  };
  const push = (t: Tok) => {
    setToks([...toks, t]);
    setMsg(null);
  };
  return (
    <div>
      <SessionBar left={left} label={`solved ${stats.solved}`} />
      <div className="card p-4 text-center">
        <div className="text-xs text-muted">Make</div>
        <div className="tabular text-4xl font-bold" data-testid="nb-target">
          {puz.target}
        </div>
        <div className="tabular mt-3 min-h-10 rounded-lg bg-card2 px-2 py-2 font-mono text-xl" data-testid="nb-expr">
          {expr || " "}
        </div>
        <div className={`mt-2 min-h-5 text-sm ${msg?.startsWith("✓") ? "text-good" : "text-muted"}`}>{msg}</div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {puz.nums.map((n, k) => (
          <button key={k} className="btn min-h-14 text-xl" disabled={used.has(k)} onClick={() => push({ t: String(n), idx: k })} data-testid={`nb-num-${k}`}>
            {n}
          </button>
        ))}
        {["+", "−", "×", "÷", "(", ")"].map((op) => (
          <button key={op} className="btn min-h-12 text-xl" onClick={() => push({ t: op })}>
            {op}
          </button>
        ))}
        <button className="btn min-h-12" onClick={() => setToks(toks.slice(0, -1))} aria-label="Backspace">
          ⌫
        </button>
        <button className="btn min-h-12" onClick={() => setToks([])}>
          Clear
        </button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button className="btn" onClick={skip}>
          Skip
        </button>
        <button className="btn btn-primary col-span-2" onClick={check} disabled={used.size < 4} data-testid="nb-check">
          Check
        </button>
      </div>
    </div>
  );
}
