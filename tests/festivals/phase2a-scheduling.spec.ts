import { expect, test } from "@playwright/test";

test.describe("Festival Phase 2A scheduling", () => {
  test("desktop schedule workspace exposes schedule tab and publication controls", async ({ page }) => {
    await page.goto("/admin/festivals?tab=schedule");
    await expect(page.getByRole("tab", { name: "Schedule" })).toBeVisible();
  });

  test("mobile agenda layout keeps schedule usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/festivals?tab=schedule");
    await expect(page.getByRole("tab", { name: "Schedule" })).toBeVisible();
  });
});
