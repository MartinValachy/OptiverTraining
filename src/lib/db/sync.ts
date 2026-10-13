// Outbox sync: local IndexedDB -> Supabase (upsert, conflicts resolved by primary key),
// and a pull that merges server rows into the local store.

import type { Attempt, ItemResult, SkillRow } from "@/modules/types";
import { clearOutbox, getRow, listOutbox, mergeRemote, type SettingsRow, type TableName } from "./local";

export interface Remote {
  userId(): Promise<string | null>;
  upsert(table: TableName, rows: Record<string, unknown>[], onConflict: string): Promise<void>;
  selectAll(table: TableName): Promise<Record<string, unknown>[]>;
}

const ORDER: TableName[] = ["attempts", "item_results", "skill", "settings"];
const CONFLICT: Record<TableName, string> = {
  attempts: "id",
  item_results: "id",
  skill: "user_id,family",
  settings: "user_id",
};

export function toRemote(table: TableName, row: Record<string, unknown>, userId: string): Record<string, unknown> {
  switch (table) {
    case "settings": {
      const s = row as unknown as SettingsRow;
      return { user_id: userId, prefs: s.prefs, updated_at: s.updated_at };
    }
    case "skill": {
      const s = row as unknown as SkillRow;
      return {
        user_id: userId,
        family: s.family,
        rating: s.rating,
        n: s.n,
        last_seen: s.last_seen,
        next_due: s.next_due,
        avg_ms: s.avg_ms ?? null,
      };
    }
    default:
      return { ...row, user_id: userId };
  }
}

function stripUser<T>(row: Record<string, unknown>): T {
  const { user_id: _u, ...rest } = row;
  void _u;
  return rest as T;
}

let running: Promise<SyncResult> | null = null;

export interface SyncResult {
  pushed: number;
  skipped: "offline" | "signed-out" | null;
  error?: string;
}

/** Push every queued row. Safe to call concurrently (coalesced). */
export function pushOutbox(remote: Remote): Promise<SyncResult> {
  if (running) return running;
  running = (async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return { pushed: 0, skipped: "offline" as const };
      const uid = await remote.userId();
      if (!uid) return { pushed: 0, skipped: "signed-out" as const };
      const queue = await listOutbox();
      let pushed = 0;
      for (const table of ORDER) {
        const entries = queue.filter((q) => q.table === table);
        for (let i = 0; i < entries.length; i += 200) {
          const chunk = entries.slice(i, i + 200);
          const rows: Record<string, unknown>[] = [];
          const done: string[] = [];
          for (const e of chunk) {
            const row = (await getRow(table, e.id)) as Record<string, unknown> | undefined;
            if (row) rows.push(toRemote(table, row, uid));
            done.push(e.key);
          }
          if (rows.length) await remote.upsert(table, rows, CONFLICT[table]);
          await clearOutbox(done);
          pushed += rows.length;
        }
      }
      return { pushed, skipped: null };
    } catch (e) {
      return { pushed: 0, skipped: null, error: e instanceof Error ? e.message : String(e) };
    } finally {
      running = null;
    }
  })();
  return running;
}

export async function pullRemote(remote: Remote): Promise<boolean> {
  const uid = await remote.userId();
  if (!uid) return false;
  const [attempts, items, skill, settings] = await Promise.all(ORDER.map((t) => remote.selectAll(t)));
  await mergeRemote({
    attempts: attempts.map((r) => stripUser<Attempt>(r)),
    item_results: items.map((r) => stripUser<ItemResult>(r)),
    skill: skill.map((r) => stripUser<SkillRow>(r)),
    settings: settings[0] ? ({ key: "prefs", prefs: settings[0].prefs, updated_at: settings[0].updated_at } as SettingsRow) : null,
  });
  return true;
}
