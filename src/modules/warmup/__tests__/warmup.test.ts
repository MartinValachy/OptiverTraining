import { describe, expect, it } from "vitest";
import { Fraction } from "@/lib/fraction";
import { DIFFICULTIES } from "@/modules/types";
import { EIGHTY_WEIGHTS, WARMUP_FAMILIES, checkWarmup, generateWarmup, planEighty, scoreEighty, sprintItem, zetamacItem, type WarmupItem } from "../logic";

const N = 1000;
const num = "(\\d+(?:\\.\\d+)?|\\d+/\\d+)";
const P = (s: string) => Fraction.parse(s);

/** Independent evaluation of a prompt string (solving for "?" where present). */
function evaluate(prompt: string): Fraction {
  let m = new RegExp(`^${num} ([+−×÷]) ${num}$`).exec(prompt);
  if (m) {
    const a = P(m[1]);
    const b = P(m[3]);
    return m[2] === "+" ? a.add(b) : m[2] === "−" ? a.sub(b) : m[2] === "×" ? a.mul(b) : a.div(b);
  }
  m = new RegExp(`^(\\d+)/(\\d+) of (\\d+)$`).exec(prompt);
  if (m) return P(m[3]).mul(P(`${m[1]}/${m[2]}`));
  m = new RegExp(`^${num} × \\? = ${num}$`).exec(prompt);
  if (m) return P(m[2]).div(P(m[1]));
  m = new RegExp(`^\\? ÷ ${num} = ${num}$`).exec(prompt);
  if (m) return P(m[2]).mul(P(m[1]));
  m = new RegExp(`^\\? \\+ ${num} = ${num}$`).exec(prompt);
  if (m) return P(m[2]).sub(P(m[1]));
  m = new RegExp(`^${num} − \\? = ${num}$`).exec(prompt);
  if (m) return P(m[1]).sub(P(m[2]));
  throw new Error(`unparsed prompt: ${prompt}`);
}

function terminatingDp(f: Fraction): number | null {
  for (let dp = 0; dp <= 12; dp++) if (f.mul(10 ** dp).isInteger()) return dp;
  return null;
}

function checkItem(it: WarmupItem, tag: string) {
  const ans = P(it.answer);
  expect(evaluate(it.prompt).eq(ans), `${tag}: ${it.prompt} = ${it.answer}`).toBe(true);
  expect(ans.sign(), tag).toBe(1);
  expect(it.prompt.includes("-"), `${tag} no negative numbers: ${it.prompt}`).toBe(false);
  expect(P(it.display).eq(ans), tag).toBe(true);
  // multiple choice: 4 distinct positive values, exactly one correct
  expect(it.options.length, tag).toBe(4);
  const vals = it.optionValues.map(P);
  expect(new Set(vals.map((v) => v.toString())).size, `${tag} ${it.options}`).toBe(4);
  expect(vals.filter((v) => v.eq(ans)).length, tag).toBe(1);
  expect(vals[it.correctIndex].eq(ans), tag).toBe(true);
  it.options.forEach((o, i) => expect(P(o).eq(vals[i]), tag).toBe(true));
  for (const v of vals) expect(v.sign(), tag).toBe(1);
  // typeable ⇔ a terminating decimal with ≤ 3 dp
  const dp = terminatingDp(ans);
  expect(it.typeable, tag).toBe(dp !== null && dp <= 3);
  // typed answers are accepted with either decimal separator
  expect(checkWarmup(it, it.display), tag).toBe(true);
  if (it.display.includes(".")) expect(checkWarmup(it, it.display.replace(".", ",")), tag).toBe(true);
}

describe("80-in-8 style generator", () => {
  for (const f of WARMUP_FAMILIES)
    for (const d of DIFFICULTIES)
      it(`${f.id} level ${d}: ${N} items exact, positive, 4 distinct options`, () => {
        for (let seed = 0; seed < N; seed++) checkItem(generateWarmup(f.id, d, seed), `${f.id}/${d}/${seed}`);
      });

  it("covers the reported shapes: direct, missing operand, fraction of, fraction arithmetic, decimals", () => {
    const prompts = Array.from({ length: 2000 }, (_, s) => {
      const k = planEighty(1, s)[0];
      return generateWarmup(k.family, k.difficulty, k.seed).prompt;
    });
    expect(prompts.some((p) => / × \? = /.test(p))).toBe(true);
    expect(prompts.some((p) => /^\? ÷ /.test(p))).toBe(true);
    expect(prompts.some((p) => / of /.test(p))).toBe(true);
    expect(prompts.some((p) => /\d\/\d+ [+×] \d/.test(p))).toBe(true);
    expect(prompts.some((p) => /\d\.\d+ ÷ \d\.\d/.test(p))).toBe(true);
  });

  it("80-question plan is reproducible and follows the family weights", () => {
    expect(planEighty(80, 5)).toEqual(planEighty(80, 5));
    const counts: Record<string, number> = {};
    for (let s = 0; s < 100; s++) for (const k of planEighty(80, s)) counts[k.family] = (counts[k.family] ?? 0) + 1;
    const total = Object.values(EIGHTY_WEIGHTS).reduce((a, b) => a + b, 0);
    for (const [f, w] of Object.entries(EIGHTY_WEIGHTS)) expect(Math.abs(counts[f] / 8000 - w / total)).toBeLessThan(0.02);
  });

  it("sprint problems are always typeable on a decimal keypad", () => {
    for (let i = 0; i < 500; i++) {
      const it = sprintItem("eighty", 9, i);
      expect(it.typeable).toBe(true);
      checkItem(it, `sprint ${i}`);
    }
  });

  it("Zetamac classic uses the default ranges", () => {
    for (let s = 0; s < 2000; s++) {
      const it = zetamacItem(s);
      checkItem(it, `zetamac ${s}`);
      const m = /^(\d+) ([+−×÷]) (\d+)$/.exec(it.prompt)!;
      const a = Number(m[1]);
      const b = Number(m[3]);
      const ans = Number(it.answer);
      if (m[2] === "+") expect(a >= 2 && a <= 100 && b >= 2 && b <= 100).toBe(true);
      if (m[2] === "−") expect(b >= 2 && b <= 100 && ans >= 2 && ans <= 100).toBe(true);
      if (m[2] === "×") expect(a >= 2 && a <= 12 && b >= 2 && b <= 100).toBe(true);
      if (m[2] === "÷") expect(b >= 2 && b <= 12 && ans >= 2 && ans <= 100).toBe(true);
    }
  });

  it("scoring and typed checks", () => {
    const it = generateWarmup("mul", 2, 1);
    expect(scoreEighty(it, it.correctIndex)).toEqual({ correct: true, score: 1 });
    expect(scoreEighty(it, (it.correctIndex + 1) % 4)).toEqual({ correct: false, score: -1 });
    expect(scoreEighty(it, null)).toEqual({ correct: null, score: 0 });
    expect(checkWarmup(it, "")).toBeNull();
    expect(checkWarmup(it, "abc")).toBe(false);
    const half = { answer: "1/2" };
    expect(checkWarmup(half, "0.5")).toBe(true);
    expect(checkWarmup(half, ",5")).toBe(true);
    expect(checkWarmup(half, "1/2")).toBe(true);
    expect(checkWarmup(half, "0.55")).toBe(false);
  });
});
