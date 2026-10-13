"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageTitle } from "@/components/ui";
import { GAMES } from "@/modules/zapn/config";
import { listAttempts } from "@/lib/db/local";

export default function ZapNPage() {
  const [best, setBest] = useState<Record<string, { score: number; n: number }>>({});
  useEffect(() => {
    listAttempts("zapn")
      .then((rows) => {
        const out: Record<string, { score: number; n: number }> = {};
        for (const a of rows) {
          const g = String(a.config.game);
          const cur = out[g];
          out[g] = { score: cur ? Math.max(cur.score, a.score) : a.score, n: (cur?.n ?? 0) + 1 };
        }
        setBest(out);
      })
      .catch(() => {});
  }, []);
  return (
    <div>
      <PageTitle back="/">Zap-N</PageTitle>
      <p className="mb-4 text-sm text-muted">
        The invite says “1 or more short neuro assessment games, 2–15 minutes each”; the subset varies, so all reported games are here. Mechanics are reconstructions; parameters live in a config file.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {GAMES.map((g) => (
          <Link key={g.id} href={`/zap-n/${g.id}/`} className="card flex min-h-16 items-center gap-3 px-4 py-3" data-testid={`game-${g.id}`}>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{g.name}</div>
              <div className="truncate text-xs text-muted">
                {g.skill} · {g.blurb}
              </div>
            </div>
            {best[g.id] && (
              <div className="text-right">
                <div className="tabular text-sm font-semibold">{best[g.id].score}</div>
                <div className="text-[10px] text-muted">PB · {best[g.id].n}×</div>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
