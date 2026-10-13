"use client";

import { EXAM_SETUP, SOFT_LIMIT } from "@/modules/registry";
import { ModuleHome } from "@/components/exam/ModuleHome";
import { orderbooksModule } from "@/modules/orderbooks/module";

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
      examSetup={EXAM_SETUP.orderbooks}
      softLimitMs={SOFT_LIMIT.orderbooks}
    />
  );
}
