import type { FamilyInfo, ModuleId } from "@/modules/types";
import { BTO_FAMILY_INFO } from "@/modules/bto/index";
import { NL_FAMILIES } from "@/modules/numberlogic/generate";
import { LL_FAMILIES } from "@/modules/likelihood/generate";
import { IV_FAMILIES } from "@/modules/intervals/generate";
import { OB_FAMILIES } from "@/modules/orderbooks/generate";
import { WARMUP_FAMILIES } from "@/modules/warmup/logic";
import { GAMES } from "@/modules/zapn/config";

export type QuestionModuleId = Exclude<ModuleId, "zapn" | "mock">;

/** Families per question module, in battery order. */
export const CATALOG: { module: QuestionModuleId; families: FamilyInfo[] }[] = [
  { module: "bto", families: BTO_FAMILY_INFO },
  { module: "numberlogic", families: NL_FAMILIES },
  { module: "likelihood", families: LL_FAMILIES },
  { module: "intervals", families: IV_FAMILIES },
  { module: "orderbooks", families: OB_FAMILIES },
  { module: "warmup", families: WARMUP_FAMILIES },
];

export const BATTERY: ModuleId[] = ["bto", "numberlogic", "likelihood", "intervals", "orderbooks", "zapn"];

export function familyName(module: ModuleId, family: string): string {
  if (module === "zapn") return GAMES.find((g) => g.id === family)?.name ?? family;
  return CATALOG.find((c) => c.module === module)?.families.find((f) => f.id === family)?.name ?? family;
}
