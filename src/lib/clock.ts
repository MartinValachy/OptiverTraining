// Monotonic exam clock driven by performance.now() deltas.
//
// Browsers (notably iOS Safari) may freeze performance.now() while a page is suspended in the
// background. On returning to the foreground we compare the wall-clock gap with the monotonic gap
// and add the difference, so an exam timer keeps "running" while the app is hidden — exactly like
// the real assessment would.

export type TimeSource = () => number;

export class ExamClock {
  private origin: number;
  private correction = 0;
  private hiddenPerf: number | null = null;
  private hiddenWall: number | null = null;
  private pausedAt: number | null = null;
  private pausedTotal = 0;

  constructor(
    private readonly perf: TimeSource = () => performance.now(),
    private readonly wall: TimeSource = () => Date.now(),
  ) {
    this.origin = perf();
  }

  /** Elapsed exam time in ms. */
  now(): number {
    if (this.pausedAt !== null) return this.pausedAt;
    return this.perf() - this.origin + this.correction - this.pausedTotal;
  }

  onHidden(): void {
    this.hiddenPerf = this.perf();
    this.hiddenWall = this.wall();
  }

  onVisible(): void {
    if (this.hiddenPerf === null || this.hiddenWall === null) return;
    const dPerf = this.perf() - this.hiddenPerf;
    const dWall = this.wall() - this.hiddenWall;
    // Only trust the wall clock if it moved forward more than the monotonic clock
    // (perf clock was frozen). Ignore backwards wall-clock jumps (NTP / manual change).
    if (dWall > dPerf + 250 && dWall < 1000 * 60 * 60 * 24) this.correction += dWall - dPerf;
    this.hiddenPerf = null;
    this.hiddenWall = null;
  }

  /** Training mode only: soft timers can be paused. */
  pause(): void {
    if (this.pausedAt === null) this.pausedAt = this.now();
  }

  resume(): void {
    if (this.pausedAt === null) return;
    const live = this.perf() - this.origin + this.correction - this.pausedTotal;
    this.pausedTotal += live - this.pausedAt;
    this.pausedAt = null;
  }

  get paused(): boolean {
    return this.pausedAt !== null;
  }
}

// ---------- sequential per-question timeline (pure) ----------

export interface SequentialTiming {
  /** per-question limit in ms, null = none */
  perQuestionMs: number | null;
  /** total cap in ms, null = none */
  totalMs: number | null;
  count: number;
}

export interface SequentialState {
  index: number;
  /** clock time at which the current question was shown */
  qStart: number;
  done: boolean;
  endedBy: "complete" | "cap" | null;
}

export interface TimelineStep {
  state: SequentialState;
  /** indices of questions that expired on their own per-question timer */
  expired: { index: number; at: number }[];
}

export function initialSequential(): SequentialState {
  return { index: 0, qStart: 0, done: false, endedBy: null };
}

/**
 * Advance a per-question timeline to time `now`, processing every expiry that happened in between
 * (e.g. while the tab was backgrounded). Each question starts exactly when the previous one ended.
 */
export function advanceSequential(state: SequentialState, now: number, t: SequentialTiming): TimelineStep {
  const expired: { index: number; at: number }[] = [];
  let s = { ...state };
  while (!s.done) {
    if (t.totalMs !== null && now >= t.totalMs) {
      // total cap hit; anything expiring on its own before the cap is processed first
      if (t.perQuestionMs !== null && s.qStart + t.perQuestionMs <= t.totalMs) {
        // fallthrough to per-question expiry below
      } else {
        s = { ...s, done: true, endedBy: "cap" };
        break;
      }
    }
    if (t.perQuestionMs !== null && now >= s.qStart + t.perQuestionMs) {
      const at = s.qStart + t.perQuestionMs;
      expired.push({ index: s.index, at });
      s = { ...s, index: s.index + 1, qStart: at };
      if (s.index >= t.count) s = { ...s, done: true, endedBy: "complete" };
      continue;
    }
    break;
  }
  return { state: s, expired };
}

/** User answered/skipped the current question at time `now`. */
export function nextSequential(state: SequentialState, now: number, t: SequentialTiming): SequentialState {
  const index = state.index + 1;
  if (index >= t.count) return { index, qStart: now, done: true, endedBy: "complete" };
  return { index, qStart: now, done: false, endedBy: null };
}

export function remainingMs(state: SequentialState, now: number, t: SequentialTiming): { question: number | null; total: number | null } {
  return {
    question: t.perQuestionMs === null ? null : Math.max(0, state.qStart + t.perQuestionMs - now),
    total: t.totalMs === null ? null : Math.max(0, t.totalMs - now),
  };
}

export function formatClock(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
