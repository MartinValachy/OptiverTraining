import { expect, test } from "@playwright/test";

test("PWA works offline and queues attempts locally", async ({ page, context }, info) => {
  test.skip(info.project.name !== "desktop", "service-worker check runs once");
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // wait until the precache is filled
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const keys = await caches.keys();
        const k = keys.find((x) => x.startsWith("oa-precache-"));
        return k ? (await (await caches.open(k)).keys()).length : 0;
      }),
    )
    .toBeGreaterThan(50);
  await context.setOffline(true);
  await page.goto("/warmup/?mode=exam&quick=1&seed=2");
  await expect(page.getByTestId("warmup-input")).toBeVisible();
  for (let i = 0; i < 5; i++) {
    await page.getByTestId("warmup-input").fill("1");
    await page.keyboard.press("Enter");
  }
  await expect(page.getByTestId("review")).toBeVisible();
  const queued = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open("oa-trainer");
        req.onsuccess = () => {
          const tx = req.result.transaction("outbox", "readonly");
          const c = tx.objectStore("outbox").count();
          c.onsuccess = () => resolve(c.result);
          c.onerror = () => reject(c.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
  expect(queued).toBeGreaterThanOrEqual(6); // attempt + 5 item results (+ skill rows)
  await expect(page.getByTestId("sync-dot")).toHaveAttribute("title", /Offline/);
  // another route, also from the cache
  await page.goto("/zap-n/dial/");
  await expect(page.getByTestId("game-start")).toBeVisible();
  await context.setOffline(false);
});
