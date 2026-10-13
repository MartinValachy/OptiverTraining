"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageTitle, Section, Stat } from "@/components/ui";
import { getSkills, listAttempts, listItemResults } from "@/lib/db/local";
import { examTrends, familyStats, minutesThisWeek, streak, weakest, type FamilyStat } from "@/lib/engine/stats";
import { CATALOG, familyName } from "@/lib/engine/catalog";
import { moduleOfKey } from "@/lib/engine/elo";
import { MODULE_NAMES, MODULE_PATHS, type Attempt, type ItemResult, type SkillRow } from "@/modules/types";

function accColor(a: number | null): string {
  if (a === null) return "transparent";
  return `hsl(${Math.round(a * 120)} 65% 38%)`;
}
function speedColor(s: number | null): string {
  if (s === null) return "transparent";
  const v = Math.max(0, Math.min(1, (1.6 - s) / 1.0));
  return `hsl(${Math.round(v * 120)} 65% 38%)`;
}

export default function DashboardPage() {
  const [data, setData] = useState<{ attempts: Attempt[]; items: ItemResult[]; skills: SkillRow[] } | null>(null);
  useEffect(() => {
    Promise.all([listAttempts(), listItemResults(), getSkills()])
      .then(([attempts, items, skills]) => setData({ attempts, items, skills }))
      .catch(() => setData({ attempts: [], items: [], skills: [] }));
  }, []);
  if (!data) return <p className="text-muted">Loading…</p>;
  const trends = examTrends(data.attempts);
  const fstats = familyStats(data.items, data.skills);
  const weak = weakest(data.skills);
  const mocks = data.attempts.filter((a) => a.module === "mock");
  const statsByKey = new Map(fstats.map((f) => [f.key, f]));
  return (
    <div>
      <PageTitle back="/">Dashboard</PageTitle>
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="dash-stats">
        <Stat label="Streak" value={`${streak(data.attempts)} d`} />
        <Stat label="This week" value={`${minutesThisWeek(data.items, data.attempts)} min`} />
        <Stat label="Items answered" value={data.items.filter((i) => i.module !== "zapn").length} />
        <Stat label="Exam runs" value={data.attempts.filter((a) => a.mode === "exam" && a.module !== "zapn").length} />
      </div>

      <Section title="Weakest 5 families">
        {weak.length === 0 ? (
          <p className="text-sm text-muted">Train a little first.</p>
        ) : (
          <div className="space-y-1.5">
            {weak.map((s) => {
              const mod = moduleOfKey(s.family);
              const fam = s.family.slice(mod.length + 1);
              const st = statsByKey.get(s.family);
              return (
                <Link key={s.family} href={`${MODULE_PATHS[mod]}?mode=training&family=${fam}`} className="card flex min-h-12 items-center gap-3 px-3 py-2 text-sm">
                  <span className="flex-1">
                    {familyName(mod, fam)} <span className="text-xs text-muted">· {MODULE_NAMES[mod]}</span>
                  </span>
                  <span className="tabular text-xs text-muted">{st?.accuracy != null ? `${Math.round(st.accuracy * 100)}%` : "–"}</span>
                  <span className="tabular w-14 text-right font-mono text-xs">{Math.round(s.rating)}</span>
                  <span className="text-accent">›</span>
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Exam-mode trends">
        <div className="grid gap-2 sm:grid-cols-2">
          {CATALOG.map(({ module }) => {
            const t = trends[module] ?? [];
            return (
              <div key={module} className="card p-2">
                <div className="mb-1 flex justify-between px-1 text-xs">
                  <span className="font-medium">{MODULE_NAMES[module]}</span>
                  <span className="text-muted">{t.length ? `last ${t[t.length - 1].pct}%` : "no exams yet"}</span>
                </div>
                <div className="h-28">
                  {t.length > 0 && (
                    <ResponsiveContainer>
                      <LineChart data={t.map((p, i) => ({ ...p, i: i + 1 }))} margin={{ top: 4, right: 6, bottom: 0, left: -28 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                        <XAxis dataKey="i" tick={{ fill: "var(--muted)", fontSize: 10 }} />
                        <YAxis domain={[module === "bto" || module === "numberlogic" ? -50 : 0, 100]} tick={{ fill: "var(--muted)", fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }} formatter={(v) => `${v}%`} labelFormatter={(i) => t[Number(i) - 1]?.date ?? ""} />
                        <Line dataKey="pct" stroke="#5b8cff" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Family heatmap · accuracy × speed (last 30 items)">
        <div className="card overflow-x-auto p-2">
          <table className="tabular w-full text-xs" data-testid="heatmap">
            <thead className="text-muted">
              <tr>
                <th className="py-1 text-left font-normal">Family</th>
                <th className="font-normal">n</th>
                <th className="font-normal">Accuracy</th>
                <th className="font-normal">Speed</th>
                <th className="font-normal">Rating</th>
              </tr>
            </thead>
            <tbody>
              {CATALOG.map(({ module, families }) => (
                <FamilyRows key={module} module={module} families={families.map((f) => f.id)} stats={statsByKey} />
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-muted">Speed = average time ÷ target time per item (≤ 1.0 is on pace).</p>
        </div>
      </Section>

      {mocks.length > 0 && (
        <Section title="Mock batteries">
          <div className="space-y-1.5">
            {mocks.map((m) => (
              <div key={m.id} className="card flex items-center justify-between px-3 py-2 text-sm">
                <span>{new Date(m.finished_at).toLocaleDateString()}</span>
                <span className="tabular font-semibold">{Math.round((100 * m.score) / Math.max(1, m.max_score))}%</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function FamilyRows({ module, families, stats }: { module: (typeof CATALOG)[number]["module"]; families: string[]; stats: Map<string, FamilyStat> }) {
  return (
    <>
      <tr>
        <td colSpan={5} className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          {MODULE_NAMES[module]}
        </td>
      </tr>
      {families.map((f) => {
        const s = stats.get(`${module}:${f}`);
        return (
          <tr key={f} className="border-t border-line/40">
            <td className="py-1 pr-2">{familyName(module, f)}</td>
            <td className="text-center text-muted">{s?.n ?? 0}</td>
            <td className="text-center text-white" style={{ background: accColor(s?.accuracy ?? null) }}>
              {s?.accuracy != null ? `${Math.round(s.accuracy * 100)}%` : ""}
            </td>
            <td className="text-center text-white" style={{ background: speedColor(s?.speed ?? null) }}>
              {s?.speed != null ? s.speed.toFixed(2) : ""}
            </td>
            <td className="text-center">{s?.rating != null ? Math.round(s.rating) : ""}</td>
          </tr>
        );
      })}
    </>
  );
}
