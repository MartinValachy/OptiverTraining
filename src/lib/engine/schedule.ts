// Weekly plan from the start date to the target date.
// Default 7-week shape: weeks 1–3 training on all families, weeks 4–6 mixed training plus one
// exam-mode run per module per week, final week two full mock batteries.

export type PlanPhase = "training" | "mixed" | "mock";

export interface PlanWeek {
  index: number;
  start: string;
  end: string;
  phase: PlanPhase;
  tasks: string[];
}

const DAY = 86_400_000;

function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysUntil(target: string, now = new Date()): number {
  const t = parseDay(target).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.round((t - today) / DAY));
}

export function buildSchedule(startDate: string, targetDate: string): PlanWeek[] {
  const start = parseDay(startDate);
  const target = parseDay(targetDate);
  const totalDays = Math.max(1, Math.round((target.getTime() - start.getTime()) / DAY) + 1);
  const nWeeks = Math.max(1, Math.ceil(totalDays / 7));
  // last week = mock; the rest split evenly (training first, extra week goes to training)
  const rest = nWeeks - 1;
  const nTraining = Math.ceil(rest / 2);
  const weeks: PlanWeek[] = [];
  for (let w = 0; w < nWeeks; w++) {
    const ws = new Date(start.getTime() + w * 7 * DAY);
    const we = new Date(Math.min(target.getTime(), ws.getTime() + 6 * DAY));
    const phase: PlanPhase = w === nWeeks - 1 ? "mock" : w < nTraining ? "training" : "mixed";
    const tasks =
      phase === "training"
        ? ["Daily Today session (training mode, all families)", "2–3 Zap-N games", "Optional mental-math warm-up"]
        : phase === "mixed"
          ? ["Daily Today session", "One exam-mode run of each module this week", "Review every exam's mistakes in training mode"]
          : ["Full mock battery ×2 (all six modules, ~1 h 45 min)", "Light Today sessions on the weakest 5 families", "Rest the day before the assessment"];
    weeks.push({ index: w + 1, start: fmt(ws), end: fmt(we), phase, tasks });
  }
  return weeks;
}

export function currentWeek(weeks: PlanWeek[], now = new Date()): PlanWeek | null {
  const today = fmt(now);
  return weeks.find((w) => w.start <= today && today <= w.end) ?? null;
}
