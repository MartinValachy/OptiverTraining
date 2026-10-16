import { expect, test } from "@playwright/test";
import { planItems } from "../src/lib/plan";
import { BTO_FAMILY_INFO, generateBto } from "../src/modules/bto/index";
import { generateWarmup, planEighty, sprintItem } from "../src/modules/warmup/logic";
import { generateOB } from "../src/modules/orderbooks/generate";
import { planOrderbooks } from "../src/modules/orderbooks/module";
import { QUICK_EXAM } from "../src/lib/config";
import { mouseDrag, noHorizontalScroll, rowOrder, touchDrag } from "./helpers";

const SEED = 7;

test("Beat The Odds: exam run answered correctly scores full marks", async ({ page }) => {
  const keys = planItems("bto", BTO_FAMILY_INFO.map((f) => f.id), QUICK_EXAM.bto.count, SEED);
  await page.goto(`/beat-the-odds/?mode=exam&quick=1&seed=${SEED}`);
  for (const k of keys) {
    const item = generateBto(k.family, k.difficulty, k.seed);
    await expect(page.getByTestId("bto-text")).toHaveText(item.text);
    await page.getByTestId(`option-${item.correctIndex}`).click();
    await page.getByTestId("submit").click();
  }
  await expect(page.getByTestId("review")).toBeVisible();
  await expect(page.getByTestId("final-score")).toHaveText(String(keys.length));
  await expect(page.getByText("Guessing & EV analysis")).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});

test("NumberLogic: cards commit, BACK changes an answer, Save and submit", async ({ page }) => {
  await page.goto(`/number-logic/?mode=exam&quick=1&seed=${SEED}`);
  await expect(page.getByTestId("timer-total")).toBeVisible();
  for (let i = 0; i < 3; i++) await page.getByTestId("card-0").click();
  await expect(page.getByTestId("save-submit")).toBeVisible();
  await page.getByRole("button", { name: "Go to question 2" }).click();
  await page.getByTestId("card-3").click();
  await page.getByTestId("to-summary").click();
  await page.getByTestId("save-submit").click();
  await expect(page.getByTestId("review")).toBeVisible();
  await expect(page.getByTestId("final-score")).toHaveText(/^-?\d+$/);
});

test("Likelihood-list: drag to reorder, arrows, auto review", async ({ page }, info) => {
  await page.goto(`/likelihood/?mode=exam&quick=1&seed=${SEED}`);
  await expect(page.getByTestId("ll-list")).toBeVisible();
  const before = await rowOrder(page);
  const from = page.getByTestId("ll-row-0").locator("[data-testid^=ll-handle-]");
  const to = page.getByTestId("ll-row-2");
  if (info.project.name.startsWith("iphone")) await touchDrag(page, from, to);
  else await mouseDrag(page, from, to);
  await expect.poll(() => rowOrder(page)).not.toEqual(before);
  const after = await rowOrder(page);
  expect(after[2]).toBe(before[0]); // the dragged statement moved to the bottom
  await page.getByTestId("submit").click();
  const second = await rowOrder(page);
  await page.getByTestId(`ll-down-${second[0]}`).click();
  expect((await rowOrder(page))[1]).toBe(second[0]);
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("review")).toBeVisible();
  await expect(page.getByTestId("final-score")).toHaveText(/^[012]$/);
});

test("Intervals: live score, validation, calibration review", async ({ page }) => {
  await page.goto(`/intervals/?mode=exam&quick=1&seed=${SEED}`);
  await page.getByTestId("iv-lower").fill("10");
  await page.getByTestId("iv-upper").fill("20");
  await expect(page.getByTestId("iv-live")).toHaveText("50.0%");
  await page.getByTestId("iv-upper").fill("5");
  await expect(page.getByTestId("iv-error")).toContainText("Lower bound must be ≤ upper bound");
  await expect(page.getByTestId("submit")).toBeDisabled();
  await page.getByTestId("iv-upper").fill("20");
  await page.getByTestId("submit").click();
  await page.getByTestId("iv-lower").fill("1");
  await page.getByTestId("iv-upper").fill("99");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("review")).toBeVisible();
  await expect(page.getByTestId("calibration-chart")).toBeVisible();
  await expect(page.getByTestId("calibration-advice")).toBeVisible();
});

test("Orderbooks: multi-click arbitrage solutions from the solver score every board", async ({ page }) => {
  const keys = planOrderbooks(QUICK_EXAM.orderbooks.count, SEED, { ...QUICK_EXAM.orderbooks });
  const boards = keys.map((k) => generateOB(k.family, k.difficulty, k.seed));
  expect(boards.some((b) => b.simplest!.x.some((v) => Math.abs(v) >= 2))).toBe(true);
  await page.goto(`/orderbooks/?mode=exam&quick=1&seed=${SEED}`);
  for (const [bi, b] of boards.entries()) {
    await expect(page.getByTestId("ob-cards")).toBeVisible();
    // a wrong submit first: shows an error and stays on the board
    if (bi === 0) {
      await page.getByTestId("ob-buy-0").click();
      await page.getByTestId("submit").click();
      await expect(page.getByTestId("exam-error")).toContainText("net to zero");
      await page.getByTestId("ob-reset").click();
    }
    for (const [k, v] of b.simplest!.x.entries()) {
      for (let c = 0; c < Math.abs(v); c++) await page.getByTestId(v > 0 ? `ob-buy-${k}` : `ob-sell-${k}`).click();
    }
    await expect(page.getByTestId("ob-cash")).toHaveText(`Cash +${b.simplest!.profit}`);
    await page.getByTestId("submit").click();
  }
  await expect(page.getByTestId("review")).toBeVisible();
  await expect(page.getByTestId("final-score")).toHaveText(String(boards.length));
});

test("Mental math: 80 in 8 (multiple choice, +1/−1) and a Zetamac-style sprint", async ({ page }) => {
  const keys = planEighty(QUICK_EXAM.warmup.count, SEED);
  await page.goto(`/warmup/?drill=eighty&quick=1&seed=${SEED}`);
  await page.getByTestId("drill-start").click();
  for (const [i, k] of keys.entries()) {
    const it = generateWarmup(k.family, k.difficulty, k.seed);
    await expect(page.getByTestId("drill-prompt")).toHaveText(it.prompt);
    // last one deliberately wrong: net = (n − 1) − 1
    await page.getByTestId(`drill-opt-${i === keys.length - 1 ? (it.correctIndex + 1) % 4 : it.correctIndex}`).click();
  }
  await expect(page.getByTestId("drill-score")).toHaveText(String(keys.length - 2));
  expect(await noHorizontalScroll(page)).toBe(true);

  await page.goto(`/warmup/?drill=sprint&set=eighty&sec=6&seed=${SEED}`);
  await page.getByTestId("drill-start").click();
  for (let i = 0; i < 3; i++) {
    const it = sprintItem("eighty", SEED, i);
    await expect(page.getByTestId("drill-prompt")).toHaveText(it.prompt);
    // comma decimal separator (European keypads) is accepted; no Enter needed
    await page.getByTestId("drill-input").pressSequentially(it.display.replace(".", ","));
  }
  await expect(page.getByTestId("drill-status")).toContainText("Score: 3");
  await expect(page.getByTestId("drill-score")).toHaveText("3", { timeout: 15_000 });
});

for (const game of ["balloon", "pincode", "codecompare", "switch", "numberbox", "tower", "shapeshift", "grill", "pattern", "dial"]) {
  test(`Zap-N ${game}: a short session ends with results and a personal best`, async ({ page }) => {
    await page.goto(`/zap-n/${game}/?start=1&sec=4&seed=3`);
    await expect(page.getByTestId("game-results")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("game-score")).toBeVisible();
    await expect(page.getByText("Personal bests")).toBeVisible();
  });
}

test("Full mock battery (quick): all modules in order, combined report", async ({ page }) => {
  await page.goto("/mock/?quick=1&breaks=0");
  await page.getByRole("button", { name: "CodeCompare" }).click();
  await page.getByTestId("mock-start").click();
  for (let i = 0; i < 3; i++) await page.getByTestId("skip").click();
  for (let i = 0; i < 3; i++) await page.getByTestId("card-1").click();
  await page.getByTestId("save-submit").click();
  for (let i = 0; i < 2; i++) await page.getByTestId("submit").click();
  for (let i = 0; i < 2; i++) {
    await page.getByTestId("iv-lower").fill("1");
    await page.getByTestId("iv-upper").fill("99");
    await page.getByTestId("submit").click();
  }
  for (let i = 0; i < 3; i++) await page.getByTestId("skip").click();
  await expect(page.getByTestId("mock-report")).toBeVisible({ timeout: 20_000 });
  await page.goto("/dashboard/");
  await expect(page.getByText("Mock batteries")).toBeVisible();
});
