"use client";

import { ModuleHome } from "@/components/exam/ModuleHome";
import { orderbooksModule } from "@/modules/orderbooks/module";
import { QUICK_EXAM } from "@/lib/config";

export default function OrderbooksPage() {
  return (
    <ModuleHome
      mod={orderbooksModule}
      about={
        <>
          <p>Each board shows cards of commodities (single items and bundles). Every card has a price you can buy at and a price you can sell at; each tap stages one unit of that trade.</p>
          <p className="mt-2 text-muted">
            Submit when every item nets to zero and cash is positive: any valid arbitrage scores 1 regardless of size. A wrong submit only costs time. Boards ramp from direct crosses to bundles to
            multi-click ratio trades.
          </p>
        </>
      }
      examSetup={(prefs, { quick }) => {
        const c = quick ? QUICK_EXAM.orderbooks : prefs.exam.orderbooks;
        return {
          count: c.count,
          timing: { perQuestionMs: null, totalMs: c.totalSec * 1000 },
          navigation: "forward",
          summary: `${c.count} boards, one shared ${Math.round(c.totalSec / 60)}:00 clock${c.noArbShare > 0 ? `, ~${Math.round(c.noArbShare * 100)}% no-opportunity boards` : ""}`,
          config: { ...c },
        };
      }}
      softLimitMs={(prefs) => Math.round((prefs.exam.orderbooks.totalSec * 1000) / prefs.exam.orderbooks.count)}
    />
  );
}
