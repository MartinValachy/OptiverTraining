"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { formatClock } from "@/lib/clock";

export function TimerBadge({ ms, label, warnBelowMs = 10_000, testId }: { ms: number; label: string; warnBelowMs?: number; testId?: string }) {
  const warn = ms <= warnBelowMs;
  return (
    <div
      className={`flex flex-col items-end rounded-lg border px-2 py-1 leading-tight ${warn ? "border-bad text-bad" : "border-line"}`}
      role="timer"
      aria-label={`${label} ${formatClock(ms)}`}
      data-testid={testId}
    >
      <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
      <span className="tabular font-mono text-lg font-semibold">{formatClock(ms)}</span>
    </div>
  );
}

export function ExamHeader({ title, progress, children, onQuit }: { title: string; progress?: string; children?: ReactNode; onQuit?: () => void }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{title}</div>
        {progress && <div className="tabular text-xs text-muted" data-testid="progress">{progress}</div>}
      </div>
      {children}
      {onQuit && (
        <button className="btn btn-ghost px-2 text-muted" onClick={onQuit} aria-label="Quit">
          ✕
        </button>
      )}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "bad" | "warn" }) {
  const c = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "";
  return (
    <div className="card p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`tabular text-xl font-semibold ${c}`}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function PageTitle({ children, back }: { children: ReactNode; back?: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {back && (
        <Link href={back} className="btn btn-ghost -ml-2 px-2" aria-label="Back">
          ←
        </Link>
      )}
      <h1 className="text-xl font-semibold tracking-tight">{children}</h1>
    </div>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Pill({ children, tone }: { children: ReactNode; tone?: "good" | "bad" | "warn" | "muted" }) {
  const c =
    tone === "good" ? "border-good text-good" : tone === "bad" ? "border-bad text-bad" : tone === "warn" ? "border-warn text-warn" : "border-line text-muted";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${c}`}>{children}</span>;
}

export function ResultTag({ correct }: { correct: boolean | null }) {
  if (correct === null) return <Pill tone="muted">skipped</Pill>;
  return correct ? <Pill tone="good">correct</Pill> : <Pill tone="bad">wrong</Pill>;
}

export function Steps({ lines }: { lines: string[] }) {
  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed">
      {lines.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ol>
  );
}

export function Collapsible({ title, children, defaultOpen = false }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="card group" open={defaultOpen}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm">
        <span className="text-muted transition-transform group-open:rotate-90">▸</span>
        <div className="min-w-0 flex-1">{title}</div>
      </summary>
      <div className="border-t border-line px-3 py-3">{children}</div>
    </details>
  );
}

export function ConfirmQuit({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card w-full max-w-sm p-4">
        <p className="mb-4 text-sm">Quit this run? Progress so far will be discarded.</p>
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onCancel}>
            Keep going
          </button>
          <button className="btn border-bad text-bad" onClick={onConfirm}>
            Quit
          </button>
        </div>
      </div>
    </div>
  );
}

export function pct(x: number, digits = 0): string {
  return `${(x * 100).toFixed(digits)}%`;
}

export function secs(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}
