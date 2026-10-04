import { expect, test } from "@playwright/test";

test("completes the Phase 3 five-part Luthiery design journey without mutations", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });

  const mutations: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() !== "GET" &&
      (request.url().includes("/rest/v1/") || request.url().includes("/functions/v1/"))
    ) {
      mutations.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.goto("/admin/luthiery-workbench-demo");
  await expect(page.getByRole("heading", { name: "Luthiery Workbench Demo" })).toBeVisible();
  await expect(page.getByText(/Demo data only/)).toBeVisible();

  await page.getByLabel("Instrument name").fill("Night Razor");
  await page.getByRole("button", { name: "Bass", exact: true }).click();
  await page.getByRole("button", { name: /Monolith Bass/ }).click();
  await expect(page.getByRole("group", { name: /Monolith Bass bass/ })).toBeVisible();

  const electronics = page.getByRole("button", { name: "Select electronics" });
  await electronics.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Part 4 / 5")).toBeVisible();
  await page.getByRole("button", { name: /Hand-wound Boutique/ }).click();

  await page.getByRole("button", { name: /Custom Artwork/ }).click();
  await page.getByRole("button", { name: "Lightning", exact: true }).click();
  await expect(page.getByTestId("instrument-decal")).toBeVisible();
  for (const [name, value] of [["Decal horizontal position", "72"], ["Decal rotation", "25"]] as const) {
    await page.getByRole("slider", { name }).evaluate((element, nextValue) => {
      const input = element as HTMLInputElement;
      input.value = nextValue;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
  }

  await page.getByRole("button", { name: "Review build" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Night Razor")).toBeVisible();
  await expect(dialog.getByText("Design ready for crafting")).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm design" }).click();

  await expect(page.getByText("Design confirmed: Night Razor")).toBeVisible();
  expect(mutations).toEqual([]);
});

test("keeps the Luthiery fixture admin-only outside the test bypass", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${baseURL}/admin/luthiery-workbench-demo?no-test-admin=1`);
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole("heading", { name: "Luthiery Workbench Demo" })).toHaveCount(0);

  await context.close();
});
