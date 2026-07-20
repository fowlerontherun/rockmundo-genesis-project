import { expect, test } from "@playwright/test";

const brandId = "11111111-1111-4111-8111-111111111111";
const editionId = "11111111-1111-4111-8111-111111111112";

test.describe("London deterministic festival fixture", () => {
  test("public page exposes fixture identity and lineup", async ({ page }) => {
    await page.goto(`/festivals/${brandId}`);
    await expect(page.getByText(/RockMundo London Test Festival/i)).toBeVisible();
    await expect(page.getByText(/London/i).first()).toBeVisible();
    await expect(page.getByText(/Thames|Electric|Camden|lineup/i).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/undefined|NaN|\[object Object\]/);
  });

  test("owner dashboard fixture values remain readable without desktop overflow", async ({ page }) => {
    await page.goto(`/festivals/${brandId}/manage/editions/${editionId}#live`);
    await expect(page.getByText(/Operations|Planning|Festival management/i).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/undefined|NaN|\[object Object\]/);
  });

  test("mobile owner dashboard avoids horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/festivals/${brandId}/manage/editions/${editionId}#schedule`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
    await expect(page.locator("body")).not.toContainText(/undefined|NaN|\[object Object\]/);
  });
});
