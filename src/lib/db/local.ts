// Local-first storage in IndexedDB. Everything is written here first; sync.ts pushes the outbox
// to Supabase when online and signed in.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Attempt, ItemResult, ModuleId, SkillRow } from "@/modules/types";
import { isoNow } from "@/lib/ids";

export type TableName = "attempts" | "item_results" | "skill" | "settings";

export interface SettingsRow {
  key: "prefs";
  prefs: Record<string, unknown>;
  updated_at: string;
}

export interface OutboxRow {
  key: string;
  table: TableName;
  id: string;
  queued_at: string;
}

interface OADB extends DBSchema {
  attempts: { key: string; value: Attempt; indexes: { "by-module": string; "by-finished": string } };
  item_results: { key: string; value: ItemResult; indexes: { "by-attempt": string; "by-family": string } };
  skill: { key: string; value: SkillRow };
  settings: { key: string; value: SettingsRow };
  outbox: { key: string; value: OutboxRow };
}

export type LocalDB = IDBPDatabase<OADB>;

let dbPromise: Promise<LocalDB> | null = null;

export function getDB(name = "oa-trainer"): Promise<LocalDB> {
  if (!dbPromise) {
    dbPromise = openDB<OADB>(name, 1, {
      upgrade(db) {
        const a = db.createObjectStore("attempts", { keyPath: "id" });
        a.createIndex("by-module", "module");
        a.createIndex("by-finished", "finished_at");
        const r = db.createObjectStore("item_results", { keyPath: "id" });
        r.createIndex("by-attempt", "attempt_id");
        r.createIndex("by-family", "family");
        db.createObjectStore("skill", { keyPath: "family" });
        db.createObjectStore("settings", { keyPath: "key" });
        db.createObjectStore("outbox", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

/** Test helper: close and forget the cached connection. */
export async function resetDBCache(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}

function outboxRow(table: TableName, id: string): OutboxRow {
  return { key: `${table}:${id}`, table, id, queued_at: isoNow() };
}

export async function saveAttempt(attempt: Attempt, items: ItemResult[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["attempts", "item_results", "outbox"], "readwrite");
  await tx.objectStore("attempts").put(attempt);
  await tx.objectStore("outbox").put(outboxRow("attempts", attempt.id));
  for (const it of items) {
    await tx.objectStore("item_results").put(it);
    await tx.objectStore("outbox").put(outboxRow("item_results", it.id));
  }
  await tx.done;
}

export async function listAttempts(module?: ModuleId): Promise<Attempt[]> {
  const db = await getDB();
  const rows = module ? await db.getAllFromIndex("attempts", "by-module", module) : await db.getAll("attempts");
  return rows.sort((a, b) => a.finished_at.localeCompare(b.finished_at));
}

export async function getAttempt(id: string): Promise<Attempt | undefined> {
  return (await getDB()).get("attempts", id);
}

export async function listItemResults(opts: { attemptId?: string; family?: string } = {}): Promise<ItemResult[]> {
  const db = await getDB();
  if (opts.attemptId) return db.getAllFromIndex("item_results", "by-attempt", opts.attemptId);
  if (opts.family) return db.getAllFromIndex("item_results", "by-family", opts.family);
  return db.getAll("item_results");
}

export async function getSkills(): Promise<SkillRow[]> {
  return (await getDB()).getAll("skill");
}

export async function putSkills(rows: SkillRow[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["skill", "outbox"], "readwrite");
  for (const r of rows) {
    await tx.objectStore("skill").put(r);
    await tx.objectStore("outbox").put(outboxRow("skill", r.family));
  }
  await tx.done;
}

export async function getPrefsRow(): Promise<SettingsRow | undefined> {
  return (await getDB()).get("settings", "prefs");
}

export async function putPrefsRow(prefs: Record<string, unknown>, queue = true): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["settings", "outbox"], "readwrite");
  await tx.objectStore("settings").put({ key: "prefs", prefs, updated_at: isoNow() });
  if (queue) await tx.objectStore("outbox").put(outboxRow("settings", "prefs"));
  await tx.done;
}

export async function listOutbox(): Promise<OutboxRow[]> {
  return (await getDB()).getAll("outbox");
}

export async function clearOutbox(keys: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("outbox", "readwrite");
  for (const k of keys) await tx.store.delete(k);
  await tx.done;
}

/** Merge rows pulled from the server. Rows still queued locally win (they are newer). */
export async function mergeRemote(data: {
  attempts: Attempt[];
  item_results: ItemResult[];
  skill: SkillRow[];
  settings: SettingsRow | null;
}): Promise<void> {
  const db = await getDB();
  const pending = new Set((await db.getAll("outbox")).map((o) => o.key));
  const tx = db.transaction(["attempts", "item_results", "skill", "settings"], "readwrite");
  for (const a of data.attempts) if (!pending.has(`attempts:${a.id}`)) await tx.objectStore("attempts").put(a);
  for (const r of data.item_results) if (!pending.has(`item_results:${r.id}`)) await tx.objectStore("item_results").put(r);
  for (const s of data.skill) {
    if (pending.has(`skill:${s.family}`)) continue;
    const cur = await tx.objectStore("skill").get(s.family);
    if (!cur || (s.last_seen ?? "") >= (cur.last_seen ?? "")) await tx.objectStore("skill").put({ ...cur, ...s });
  }
  if (data.settings && !pending.has("settings:prefs")) {
    const cur = await tx.objectStore("settings").get("prefs");
    if (!cur || data.settings.updated_at >= cur.updated_at) await tx.objectStore("settings").put(data.settings);
  }
  await tx.done;
}

export async function getRow(table: TableName, id: string): Promise<unknown> {
  const db = await getDB();
  return db.get(table, id);
}
