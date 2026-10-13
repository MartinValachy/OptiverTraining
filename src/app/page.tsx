"use client";

import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { MODULE_NAMES, MODULE_PATHS, type ModuleId } from "@/modules/types";
import { Section } from "@/components/ui";

const ORDER: { id: ModuleId; blurb: string }[] = [
  { id: "bto", blurb: "Probability · 5 options · +1 / −1 / 0" },
  { id: "numberlogic", blurb: "Sequences · shared 25:00 clock" },
  { id: "likelihood", blurb: "Rank 3 outcomes · drag to order" },
  { id: "intervals", blurb: "Bounds · score = lower ÷ upper" },
  { id: "orderbooks", blurb: "Arbitrage · 20 boards in 8:00" },
  { id: "zapn", blurb: "Neuro mini-games" },
  { id: "warmup", blurb: "Mental math drills (optional)" },
];

function daysUntil(date: string): number {
  const t = new Date(date + "T23:59:59");
  return Math.max(0, Math.ceil((t.getTime() - Date.now()) / 86_400_000));
}

export default function Home() {
  const { prefs, prefsLoaded } = useApp();
  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Optiver OA Trainer</h1>
          <p className="text-sm text-muted">Career Kickstarter – Trading 2027</p>
        </div>
        {prefsLoaded && (
          <Link href="/plan/" className="text-right">
            <div className="tabular text-2xl font-semibold">{daysUntil(prefs.targetDate)}</div>
            <div className="text-xs text-muted">days to go</div>
          </Link>
        )}
      </div>
      <div className="mb-5 grid grid-cols-2 gap-2">
        <Link href="/today/" className="card flex min-h-20 flex-col justify-center border-accent p-4">
          <span className="font-semibold">Today’s session</span>
          <span className="text-xs text-muted">Weak families, spaced repetition</span>
        </Link>
        <Link href="/mock/" className="card flex min-h-20 flex-col justify-center p-4">
          <span className="font-semibold">Full mock battery</span>
          <span className="text-xs text-muted">All six modules · ~1 h 45 min</span>
        </Link>
      </div>
      <Section title="Modules">
        <div className="grid gap-2 sm:grid-cols-2">
          {ORDER.map((m) => (
            <Link key={m.id} href={MODULE_PATHS[m.id]} className="card flex min-h-16 flex-col justify-center px-4 py-3" data-testid={`module-${m.id}`}>
              <span className="font-medium">{MODULE_NAMES[m.id]}</span>
              <span className="text-xs text-muted">{m.blurb}</span>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
