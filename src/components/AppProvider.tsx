"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { DEFAULT_PREFS, mergePrefs, type Prefs } from "@/lib/config";
import { getPrefsRow, listOutbox, putPrefsRow } from "@/lib/db/local";
import { pullRemote, pushOutbox } from "@/lib/db/sync";
import { supabaseRemote } from "@/lib/db/remote";

interface AppCtx {
  prefs: Prefs;
  prefsLoaded: boolean;
  setPrefs: (p: Partial<Prefs>) => Promise<void>;
  session: Session | null;
  supabaseEnabled: boolean;
  pending: number;
  online: boolean;
  lastSync: string | null;
  syncError: string | null;
  syncNow: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}

function applyTheme(theme: Prefs["theme"]) {
  const root = document.documentElement;
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = dark ? "dark" : "light";
  try {
    localStorage.setItem("oa-theme", theme);
  } catch {
    /* ignore */
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const sb = getSupabase();

  const refreshPending = useCallback(async () => {
    try {
      setPending((await listOutbox()).length);
    } catch {
      /* IndexedDB unavailable */
    }
  }, []);

  const syncNow = useCallback(async () => {
    await refreshPending();
    if (!sb) return;
    const res = await pushOutbox(supabaseRemote(sb));
    if (res.error) setSyncError(res.error);
    else if (!res.skipped) {
      setSyncError(null);
      setLastSync(new Date().toISOString());
    }
    await refreshPending();
  }, [sb, refreshPending]);

  useEffect(() => {
    (async () => {
      try {
        const row = await getPrefsRow();
        let p = mergePrefs(row?.prefs as Partial<Prefs> | undefined);
        if (!p.startDate) {
          p = { ...p, startDate: new Date().toISOString().slice(0, 10) };
          await putPrefsRow(p as unknown as Record<string, unknown>);
        }
        setPrefsState(p);
        applyTheme(p.theme);
      } catch {
        /* private mode without IndexedDB: keep defaults */
      }
      setPrefsLoaded(true);
      refreshPending();
    })();
  }, [refreshPending]);

  useEffect(() => {
    queueMicrotask(() => setOnline(navigator.onLine));
    const on = () => {
      setOnline(true);
      syncNow();
    };
    const off = () => setOnline(false);
    const vis = () => document.visibilityState === "visible" && syncNow();
    const saved = () => syncNow();
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("oa:saved", saved);
    document.addEventListener("visibilitychange", vis);
    const iv = window.setInterval(() => syncNow(), 60_000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("oa:saved", saved);
      document.removeEventListener("visibilitychange", vis);
      clearInterval(iv);
    };
  }, [syncNow]);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) {
        (async () => {
          try {
            await pushOutbox(supabaseRemote(sb));
            await pullRemote(supabaseRemote(sb));
            const row = await getPrefsRow();
            if (row) setPrefsState(mergePrefs(row.prefs as Partial<Prefs>));
            setLastSync(new Date().toISOString());
          } catch (e) {
            setSyncError(e instanceof Error ? e.message : String(e));
          }
          refreshPending();
        })();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [sb, refreshPending]);

  const setPrefs = useCallback(
    async (patch: Partial<Prefs>) => {
      const next = mergePrefs({ ...prefs, ...patch });
      setPrefsState(next);
      if (patch.theme) applyTheme(next.theme);
      try {
        await putPrefsRow(next as unknown as Record<string, unknown>);
      } catch {
        /* ignore */
      }
      syncNow();
    },
    [prefs, syncNow],
  );

  const signOut = useCallback(async () => {
    if (sb) await sb.auth.signOut();
    setSession(null);
  }, [sb]);

  const value = useMemo<AppCtx>(
    () => ({ prefs, prefsLoaded, setPrefs, session, supabaseEnabled: !!sb, pending, online, lastSync, syncError, syncNow, signOut }),
    [prefs, prefsLoaded, setPrefs, session, sb, pending, online, lastSync, syncError, syncNow, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Notify the provider that local rows were written (triggers a sync attempt). */
export function notifySaved() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("oa:saved"));
}
