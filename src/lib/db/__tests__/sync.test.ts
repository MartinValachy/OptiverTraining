import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { getDB, listOutbox, putSkills, resetDBCache, saveAttempt, putPrefsRow, listAttempts, getSkills } from "../local";
import { pullRemote, pushOutbox, type Remote } from "../sync";
import type { Attempt, ItemResult } from "@/modules/types";
import type { TableName } from "../local";

function fakeRemote(uid: string | null, fail = false) {
  const tables: Record<TableName, Map<string, Record<string, unknown>>> = {
    attempts: new Map(),
    item_results: new Map(),
    skill: new Map(),
    settings: new Map(),
  };
  const calls: string[] = [];
  const remote: Remote = {
    async userId() {
      return uid;
    },
    async upsert(table, rows, onConflict) {
      if (fail) throw new Error("network down");
      calls.push(table);
      for (const r of rows) {
        const key = onConflict.split(",").map((k) => String(r[k])).join("|");
        tables[table].set(key, r);
      }
    },
    async selectAll(table) {
      return [...tables[table].values()];
    },
  };
  return { remote, tables, calls };
}

const attempt = (id: string): Attempt => ({
  id,
  module: "bto",
  mode: "exam",
  config: {},
  started_at: "2026-10-01T10:00:00Z",
  finished_at: "2026-10-01T10:20:00Z",
  score: 3,
  max_score: 5,
});
const item = (id: string, attemptId: string): ItemResult => ({
  id,
  attempt_id: attemptId,
  module: "bto",
  family: "dice",
  difficulty: 1,
  seed: 1,
  response: 2,
  correct: true,
  score: 1,
  ms_taken: 1000,
  created_at: "2026-10-01T10:01:00Z",
});

beforeEach(async () => {
  await resetDBCache();
  await new Promise<void>((res, rej) => {
    const req = indexedDB.deleteDatabase("oa-trainer");
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
});

describe("offline-first sync", () => {
  it("queues locally, skips when signed out, and pushes attempts before item results", async () => {
    await getDB();
    await saveAttempt(attempt("a1"), [item("i1", "a1"), item("i2", "a1")]);
    expect((await listOutbox()).length).toBe(3);

    const signedOut = fakeRemote(null);
    expect((await pushOutbox(signedOut.remote)).skipped).toBe("signed-out");
    expect((await listOutbox()).length).toBe(3);

    const ok = fakeRemote("u1");
    const res = await pushOutbox(ok.remote);
    expect(res.pushed).toBe(3);
    expect(ok.calls).toEqual(["attempts", "item_results"]);
    expect(ok.tables.attempts.get("a1")?.user_id).toBe("u1");
    expect((await listOutbox()).length).toBe(0);
  });

  it("keeps the outbox on network failure and retries later", async () => {
    await saveAttempt(attempt("a2"), [item("i3", "a2")]);
    const bad = fakeRemote("u1", true);
    const r = await pushOutbox(bad.remote);
    expect(r.error).toMatch(/network/);
    expect((await listOutbox()).length).toBe(2);
    const good = fakeRemote("u1");
    expect((await pushOutbox(good.remote)).pushed).toBe(2);
  });

  it("upserts are idempotent by id (re-saving an attempt replaces it)", async () => {
    const r = fakeRemote("u1");
    await saveAttempt(attempt("a3"), []);
    await pushOutbox(r.remote);
    await saveAttempt({ ...attempt("a3"), score: 4 }, []);
    await pushOutbox(r.remote);
    expect(r.tables.attempts.size).toBe(1);
    expect(r.tables.attempts.get("a3")?.score).toBe(4);
  });

  it("pull merges remote rows and does not clobber queued local changes", async () => {
    const r = fakeRemote("u1");
    r.tables.attempts.set("remote1", { ...attempt("remote1"), user_id: "u1" });
    r.tables.skill.set("u1|bto:dice", { user_id: "u1", family: "bto:dice", rating: 1200, n: 10, last_seen: "2026-10-02T00:00:00Z", next_due: null });
    r.tables.skill.set("u1|bto:coins", { user_id: "u1", family: "bto:coins", rating: 900, n: 3, last_seen: "2026-10-02T00:00:00Z", next_due: null });
    await putSkills([{ family: "bto:coins", rating: 1111, n: 4, last_seen: "2026-10-03T00:00:00Z", next_due: null }]);
    await putPrefsRow({ targetDate: "2026-11-30" });
    await pullRemote(r.remote);
    const atts = await listAttempts();
    expect(atts.map((a) => a.id)).toContain("remote1");
    expect(atts.find((a) => a.id === "remote1")).not.toHaveProperty("user_id");
    const skills = new Map((await getSkills()).map((s) => [s.family, s]));
    expect(skills.get("bto:dice")?.rating).toBe(1200);
    expect(skills.get("bto:coins")?.rating).toBe(1111); // local queued row wins
  });
});

describe("sync hardening", () => {
  it("chunks large outboxes and keeps order (attempts before items)", async () => {
    const r = fakeRemote("u1");
    const items = Array.from({ length: 450 }, (_, i) => item(`it${i}`, "big"));
    await saveAttempt(attempt("big"), items);
    const res = await pushOutbox(r.remote);
    expect(res.pushed).toBe(451);
    expect(r.calls[0]).toBe("attempts");
    expect(r.calls.filter((c) => c === "item_results").length).toBe(3); // 200 + 200 + 50
    expect((await listOutbox()).length).toBe(0);
  });

  it("a failure part-way keeps the unsent rows queued", async () => {
    await saveAttempt(attempt("p1"), [item("p1i", "p1")]);
    let n = 0;
    const r = fakeRemote("u1");
    const flaky = {
      ...r.remote,
      async upsert(table: TableName, rows: Record<string, unknown>[], oc: string) {
        if (n++ > 0) throw new Error("connection reset");
        return r.remote.upsert(table, rows, oc);
      },
    };
    const res = await pushOutbox(flaky);
    expect(res.error).toMatch(/reset/);
    const left = await listOutbox();
    expect(left.map((o) => o.table)).toEqual(["item_results"]);
    expect((await pushOutbox(r.remote)).pushed).toBe(1);
  });

  it("maps skill and settings rows to their remote shape", async () => {
    const r = fakeRemote("u9");
    await putSkills([{ family: "bto:dice", rating: 1234, n: 7, last_seen: "2026-10-01T00:00:00Z", next_due: "2026-10-03T00:00:00Z", avg_ms: 4567 }]);
    await putPrefsRow({ targetDate: "2026-11-30" });
    await pushOutbox(r.remote);
    expect(r.tables.skill.get("u9|bto:dice")).toEqual({ user_id: "u9", family: "bto:dice", rating: 1234, n: 7, last_seen: "2026-10-01T00:00:00Z", next_due: "2026-10-03T00:00:00Z", avg_ms: 4567 });
    const s = r.tables.settings.get("u9")!;
    expect(s.prefs).toEqual({ targetDate: "2026-11-30" });
    expect(s).not.toHaveProperty("key");
  });

  it("concurrent sync calls are coalesced", async () => {
    await saveAttempt(attempt("c1"), []);
    const r = fakeRemote("u1");
    const [a, b] = await Promise.all([pushOutbox(r.remote), pushOutbox(r.remote)]);
    expect(a).toBe(b);
    expect(r.calls.length).toBe(1);
  });

  it("attempts that could not reach IndexedDB are migrated from localStorage", async () => {
    const store = new Map<string, string>();
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage;
    store.set("oa-pending-attempts", JSON.stringify([{ attempt: attempt("ls1"), items: [item("ls1i", "ls1")] }]));
    const { migrateFallback } = await import("@/lib/engine/record");
    expect(await migrateFallback()).toBe(1);
    expect(store.has("oa-pending-attempts")).toBe(false);
    expect((await listAttempts()).map((a) => a.id)).toContain("ls1");
    expect((await listOutbox()).length).toBe(2);
  });
});
