import type { Attempt, ItemResult } from "@/modules/types";
import { getSkills, putSkills, saveAttempt } from "@/lib/db/local";
import { familyKey, updateSkill } from "./elo";
import { notifySaved } from "@/lib/events";

const FALLBACK_KEY = "oa-pending-attempts";

/**
 * If IndexedDB is unavailable (e.g. a private window or a transient iOS storage error), keep the
 * attempt in localStorage so nothing is lost; it is migrated on the next app start.
 */
function stashFallback(attempt: Attempt, items: ItemResult[]) {
  try {
    const cur = JSON.parse(localStorage.getItem(FALLBACK_KEY) ?? "[]") as { attempt: Attempt; items: ItemResult[] }[];
    cur.push({ attempt, items });
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(cur));
  } catch {
    /* nothing more we can do */
  }
}

/** Move attempts stashed by stashFallback into IndexedDB (and thus the sync outbox). */
export async function migrateFallback(): Promise<number> {
  let cur: { attempt: Attempt; items: ItemResult[] }[] = [];
  try {
    cur = JSON.parse(localStorage.getItem(FALLBACK_KEY) ?? "[]");
  } catch {
    return 0;
  }
  let moved = 0;
  const left: typeof cur = [];
  for (const x of cur) {
    try {
      await saveAttempt(x.attempt, x.items);
      moved++;
    } catch {
      left.push(x);
    }
  }
  try {
    if (left.length) localStorage.setItem(FALLBACK_KEY, JSON.stringify(left));
    else localStorage.removeItem(FALLBACK_KEY);
  } catch {
    /* ignore */
  }
  return moved;
}

/** Persist an attempt locally (IndexedDB first), update skills, then trigger sync. */
export async function recordAttempt(attempt: Attempt, items: ItemResult[]): Promise<void> {
  try {
    await saveAttempt(attempt, items);
  } catch (e) {
    console.error("IndexedDB write failed; stashing attempt in localStorage", e);
    stashFallback(attempt, items);
    notifySaved();
    return;
  }
  try {
    const byFamily = new Map<string, ItemResult[]>();
    for (const it of items) {
      // skipped / unanswered items count as misses for the rating
      const key = familyKey(it.module, it.family);
      if (!byFamily.has(key)) byFamily.set(key, []);
      byFamily.get(key)!.push(it);
    }
    if (byFamily.size) {
      const existing = new Map((await getSkills()).map((s) => [s.family, s]));
      const rows = [...byFamily].map(([k, rs]) => updateSkill(existing.get(k), k, rs));
      await putSkills(rows);
    }
  } catch (e) {
    console.error("recordAttempt failed", e);
  }
  notifySaved();
}
