import { expect, test } from "@playwright/test";

test.describe("timer semantics (fake clock)", () => {
  test("BTO: a selected but unsubmitted answer counts as skipped when the question timer expires", async ({ page }) => {
    await page.clock.install();
    await page.goto("/beat-the-odds/?mode=exam&quick=1&seed=11");
    await expect(page.getByTestId("progress")).toHaveText("Question 1 / 3");
    await page.getByTestId("option-2").click();
    await page.clock.fastForward("01:31");
    await expect(page.getByTestId("progress")).toHaveText("Question 2 / 3");
    await page.getByTestId("skip").click();
    await page.getByTestId("skip").click();
    await expect(page.getByTestId("review")).toBeVisible();
    await expect(page.getByTestId("final-score")).toHaveText("0");
    await page.locator("details summary").first().click();
    await expect(page.getByText("skipped (time ran out)")).toBeVisible();
  });

  test("NumberLogic: the shared clock expiring submits the saved answers", async ({ page }) => {
    await page.clock.install();
    await page.goto("/number-logic/?mode=exam&quick=1&seed=11");
    await page.getByTestId("card-0").click();
    await page.clock.fastForward("25:01");
    await expect(page.getByTestId("review")).toBeVisible();
    await expect(page.getByText("ended by the overall time cap")).toBeVisible();
  });

  test("Likelihood-list: the current arrangement auto-submits at 0 s", async ({ page }) => {
    await page.clock.install();
    await page.goto("/likelihood/?mode=exam&quick=1&seed=11");
    await expect(page.getByTestId("ll-list")).toBeVisible();
    await page.clock.fastForward("01:31");
    await page.clock.fastForward("01:31");
    await expect(page.getByTestId("review")).toBeVisible();
    // auto-submitted answers are answered, not skipped
    await expect(page.getByText("skipped", { exact: true })).toHaveCount(0);
  });
});
