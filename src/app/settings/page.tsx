"use client";

import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { DEFAULT_EXAM, type ExamConfigs, type Prefs } from "@/lib/config";
import { getSupabase } from "@/lib/supabase";
import { PageTitle, Section } from "@/components/ui";
import { MODULE_NAMES } from "@/modules/types";

type Field = { key: string; label: string; unit?: string; nullable?: boolean; step?: number };

const FIELDS: Record<keyof ExamConfigs, Field[]> = {
  bto: [
    { key: "count", label: "Questions" },
    { key: "perQuestionSec", label: "Per question", unit: "s", nullable: true },
    { key: "totalSec", label: "Total cap", unit: "s", nullable: true },
  ],
  numberlogic: [
    { key: "count", label: "Sequences" },
    { key: "totalSec", label: "Shared clock", unit: "s" },
  ],
  likelihood: [
    { key: "count", label: "Questions" },
    { key: "perQuestionSec", label: "Per question", unit: "s" },
    { key: "marginPP", label: "Min. gap between outcomes", unit: "pp" },
  ],
  intervals: [
    { key: "count", label: "Questions" },
    { key: "perQuestionSec", label: "Per question", unit: "s" },
  ],
  orderbooks: [
    { key: "count", label: "Boards" },
    { key: "totalSec", label: "Shared clock", unit: "s" },
    { key: "noArbShare", label: "Share of no-arbitrage boards (0–0.5)", step: 0.05 },
  ],
  warmup: [
    { key: "count", label: "Questions" },
    { key: "totalSec", label: "Shared clock", unit: "s" },
  ],
};

export default function SettingsPage() {
  const { prefs, setPrefs, session, supabaseEnabled, pending, online, lastSync, syncError, syncNow, signOut } = useApp();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);

  async function sendLink() {
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + "/settings/" } });
    setSent(error ? `Error: ${error.message}` : `Magic link sent to ${email}. Open it on this device.`);
  }

  function setExam<K extends keyof ExamConfigs>(mod: K, key: string, raw: string, nullable?: boolean) {
    const v = raw.trim() === "" ? (nullable ? null : undefined) : Number(raw);
    if (v === undefined || (v !== null && !Number.isFinite(v))) return;
    const exam = { ...prefs.exam, [mod]: { ...prefs.exam[mod], [key]: v } };
    setPrefs({ exam });
  }

  return (
    <div>
      <PageTitle back="/">Settings</PageTitle>

      <Section title="Account & sync">
        <div className="card space-y-3 p-4 text-sm">
          {!supabaseEnabled ? (
            <p className="text-muted">Supabase is not configured (see README). Everything is stored locally on this device.</p>
          ) : session ? (
            <>
              <p>
                Signed in as <b>{session.user.email}</b>
              </p>
              <p className="text-muted">
                {online ? "Online" : "Offline"} · {pending} rows queued · last sync {lastSync ? new Date(lastSync).toLocaleTimeString() : "–"}
              </p>
              {syncError && <p className="text-bad">Sync error: {syncError}</p>}
              <div className="flex gap-2">
                <button className="btn" onClick={() => syncNow()}>
                  Sync now
                </button>
                <button className="btn" onClick={() => signOut()}>
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted">Sign in with a magic link to back up attempts and sync between iPhone and laptop. Training works without it.</p>
              <input className="input" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="btn btn-primary w-full" disabled={!email.includes("@")} onClick={sendLink}>
                Send magic link
              </button>
              {sent && <p className="text-muted">{sent}</p>}
              <p className="text-xs text-muted">{pending} rows waiting locally; they upload after sign-in.</p>
            </>
          )}
        </div>
      </Section>

      <Section title="Appearance & plan">
        <div className="card space-y-3 p-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-28 text-muted">Theme</span>
            {(["dark", "light", "system"] as Prefs["theme"][]).map((t) => (
              <button key={t} className={`btn ${prefs.theme === t ? "border-accent" : ""}`} onClick={() => setPrefs({ theme: t })}>
                {t}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2">
            <span className="w-28 text-muted">Target date</span>
            <input className="input" type="date" value={prefs.targetDate} onChange={(e) => e.target.value && setPrefs({ targetDate: e.target.value })} />
          </label>
          <label className="flex items-center gap-2">
            <span className="w-28 text-muted">Plan start</span>
            <input className="input" type="date" value={prefs.startDate ?? ""} onChange={(e) => e.target.value && setPrefs({ startDate: e.target.value })} />
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="h-5 w-5" checked={prefs.trainingSoftTimer} onChange={(e) => setPrefs({ trainingSoftTimer: e.target.checked })} />
            Show soft timer in training mode
          </label>
          <label className="flex items-center gap-2">
            <span className="w-28 text-muted">Zap-N session</span>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              value={prefs.zapnSessionSec}
              onChange={(e) => Number(e.target.value) > 0 && setPrefs({ zapnSessionSec: Number(e.target.value) })}
            />
            <span className="text-muted">s</span>
          </label>
        </div>
      </Section>

      <Section title="Exam formats" right={<button className="btn btn-ghost text-xs" onClick={() => setPrefs({ exam: DEFAULT_EXAM })}>Reset defaults</button>}>
        <div className="space-y-2">
          {(Object.keys(FIELDS) as (keyof ExamConfigs)[]).map((m) => (
            <div key={m} className="card p-3">
              <div className="mb-2 text-sm font-medium">{MODULE_NAMES[m]}</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {FIELDS[m].map((f) => {
                  const val = (prefs.exam[m] as unknown as Record<string, number | null>)[f.key];
                  return (
                    <label key={f.key} className="text-xs text-muted">
                      {f.label}
                      {f.unit ? ` (${f.unit})` : ""}
                      {f.nullable ? " – blank = none" : ""}
                      <input
                        className="input mt-1"
                        type="number"
                        inputMode="decimal"
                        step={f.step ?? 1}
                        defaultValue={val ?? ""}
                        onBlur={(e) => setExam(m, f.key, e.target.value, f.nullable)}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
