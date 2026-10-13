import type { Locator, Page } from "@playwright/test";

/** Touch drag through the Chrome DevTools Protocol (real touchstart/move/end events). */
export async function touchDrag(page: Page, from: Locator, to: Locator) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const x = a.x + 30;
  let y = a.y + a.height / 2;
  const endY = b.y + b.height - 4;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await page.waitForTimeout(250); // dnd-kit touch activation delay
  for (let i = 1; i <= 12; i++) {
    y = a.y + a.height / 2 + ((endY - (a.y + a.height / 2)) * i) / 12;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

export async function mouseDrag(page: Page, from: Locator, to: Locator) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + 30, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + 30, a.y + a.height / 2 + 10, { steps: 3 });
  await page.mouse.move(a.x + 30, b.y + b.height - 4, { steps: 12 });
  await page.mouse.up();
}

export async function rowOrder(page: Page): Promise<string[]> {
  return page.locator("[data-testid^=ll-row-]").evaluateAll((els) => els.map((e) => e.getAttribute("data-statement") ?? ""));
}

export async function noHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}
