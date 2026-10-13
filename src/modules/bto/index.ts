import { itemRng } from "@/lib/rng";
import { Fraction } from "@/lib/fraction";
import type { Difficulty, FamilyInfo } from "@/modules/types";
import { type BtoFamily, type BtoItem, buildOptions, exactLabel } from "./core";
import { dice } from "./families/dice";
import { coins } from "./families/coins";
import { cards } from "./families/cards";
import { urns } from "./families/urns";
import { birthday } from "./families/birthday";
import { bayes } from "./families/bayes";
import { waiting } from "./families/waiting";
import { ev } from "./families/ev";
import { ruin } from "./families/ruin";
import { walk } from "./families/walk";
import { markov } from "./families/markov";
import { linearity } from "./families/linearity";
import { martingale } from "./families/martingale";
import { divergent } from "./families/divergent";

export const BTO_FAMILIES: BtoFamily[] = [dice, coins, cards, urns, birthday, bayes, waiting, ev, ruin, walk, markov, linearity, martingale, divergent];
export const BTO_FAMILY_MAP = new Map(BTO_FAMILIES.map((f) => [f.id, f]));
export const BTO_FAMILY_INFO: FamilyInfo[] = BTO_FAMILIES.map((f) => ({ id: f.id, name: f.name, blurb: f.blurb }));

export function generateBto(family: string, difficulty: Difficulty, seed: number): BtoItem {
  const fam = BTO_FAMILY_MAP.get(family);
  if (!fam) throw new Error(`unknown BTO family ${family}`);
  const rng = itemRng("bto", family, difficulty, seed);
  for (let attempt = 0; attempt < 200; attempt++) {
    const sc = fam.generate(rng, difficulty);
    const built = buildOptions(sc, rng, difficulty);
    if (!built) continue;
    return {
      family,
      difficulty,
      seed,
      sub: sc.sub,
      text: sc.text,
      unit: sc.unit,
      options: built.options,
      correctIndex: built.correctIndex,
      exact: sc.answer.kind === "inf" ? "inf" : sc.answer.v.toString(),
      exactLabel: exactLabel(sc.answer, sc.unit),
      exactIncluded: built.exactIncluded,
      solution: sc.solution,
      hint: sc.hint,
      params: sc.params,
    };
  }
  throw new Error(`BTO ${family}/${difficulty}/${seed}: could not build options`);
}

export function exactNumber(item: Pick<BtoItem, "exact">): number {
  return item.exact === "inf" ? Infinity : Fraction.parse(item.exact).toNumber();
}
