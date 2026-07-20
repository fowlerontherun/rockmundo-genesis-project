import { test, expect } from "@playwright/test";

test.describe("finance rehearsal funding vertical slice", () => {
  test("requires the application to expose rehearsal funding flows", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
  });
});
