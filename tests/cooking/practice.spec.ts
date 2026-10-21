import { expect, test, type Locator, type Page } from "@playwright/test";

async function drag(page: Page, source: Locator, destination: Locator) {
  const from = (await source.boundingBox())!;
  const to = (await destination.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
}

test("dragging cooks, changes colour, burns and plates an ingredient", async ({ page }, testInfo) => {
  await page.goto("/tests/fixtures/cooking-practice.html");
  await page.getByRole("button", { name: "Start practice" }).click();
  await drag(page, page.getByRole("button", { name: "Onion: Raw, tray" }), page.getByRole("region", { name: "Cooking pan" }));
  await expect(page.getByRole("button", { name: "Onion: Raw, pan" })).toBeVisible();
  const rawColour = await page.getByRole("button", { name: "Onion: Raw, pan" }).locator("svg g").first().getAttribute("fill");
  await page.clock.install();
  await page.getByRole("radio", { name: "Medium" }).check();
  await page.clock.fastForward(12_500);
  const ready = page.getByRole("button", { name: "Onion: Ready, pan" });
  await expect(ready).toBeVisible();
  expect(await ready.locator("svg g").first().getAttribute("fill")).not.toBe(rawColour);
  await page.screenshot({ path: testInfo.outputPath("kitchen-desktop.png"), fullPage: true });
  await page.clock.fastForward(10_000);
  const burnt = page.getByRole("button", { name: "Onion: Burnt, pan" });
  await expect(burnt).toBeVisible();
  await page.getByRole("radio", { name: "Heat off" }).check();
  await drag(page, burnt, page.getByRole("region", { name: "Serving plate" }));
  await expect(page.getByRole("button", { name: "Onion: Burnt, plate" })).toBeVisible();
});

test("narrow touch layouts support tap-to-place without horizontal overflow", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5187/tests/fixtures/cooking-practice.html");
  await page.getByRole("button", { name: "Start practice" }).tap();
  await page.getByRole("button", { name: "Pepper: Raw, tray" }).tap();
  await page.getByRole("button", { name: "Add selected ingredient to pan" }).tap();
  await expect(page.getByRole("button", { name: "Pepper: Raw, pan" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("kitchen-mobile.png"), fullPage: true });
  await context.close();
});
