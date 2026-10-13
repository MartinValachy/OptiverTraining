import type { SupabaseClient } from "@supabase/supabase-js";
import type { Remote } from "./sync";
import type { TableName } from "./local";

export function supabaseRemote(sb: SupabaseClient): Remote {
  return {
    async userId() {
      const { data } = await sb.auth.getSession();
      return data.session?.user.id ?? null;
    },
    async upsert(table: TableName, rows, onConflict) {
      const { error } = await sb.from(table).upsert(rows, { onConflict });
      if (error) throw new Error(`${table}: ${error.message}`);
    },
    async selectAll(table: TableName) {
      const out: Record<string, unknown>[] = [];
      const page = 1000;
      for (let from = 0; ; from += page) {
        const { data, error } = await sb.from(table).select("*").range(from, from + page - 1);
        if (error) throw new Error(`${table}: ${error.message}`);
        out.push(...(data ?? []));
        if (!data || data.length < page) break;
      }
      return out;
    },
  };
}
