import { makeRng, seedFor } from "./rng";
import type { Difficulty, ItemKey, ModuleId } from "@/modules/types";

/**
 * Exam item plan: families cycled in shuffled rounds so every family appears, difficulty ramping
 * from 1 to 3 over the run. Reproducible from the master seed.
 */
export function planItems(module: ModuleId, families: string[], count: number, masterSeed: number, ramp = true): ItemKey[] {
  const rng = makeRng(seedFor(module, "plan", masterSeed));
  const fams: string[] = [];
  while (fams.length < count) fams.push(...rng.shuffle(families));
  return fams.slice(0, count).map((family, i) => ({
    module,
    family,
    difficulty: (ramp ? 1 + Math.min(2, Math.floor((3 * i) / count)) : rng.int(1, 3)) as Difficulty,
    seed: Math.floor(rng.next() * 2 ** 32),
  }));
}
