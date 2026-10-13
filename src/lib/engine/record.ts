"use client";

import type { Attempt, ItemResult } from "@/modules/types";
import { getSkills, putSkills, saveAttempt } from "@/lib/db/local";
import { familyKey, updateSkill } from "./elo";
import { notifySaved } from "@/components/AppProvider";

/** Persist an attempt locally (IndexedDB first), update skills, then trigger sync. */
export async function recordAttempt(attempt: Attempt, items: ItemResult[]): Promise<void> {
  try {
    await saveAttempt(attempt, items);
    const byFamily = new Map<string, ItemResult[]>();
    for (const it of items) {
      // skips in exam mode still inform the rating (as a miss) only if the user saw the item
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
