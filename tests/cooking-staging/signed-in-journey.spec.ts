import { expect, test, type Page } from "@playwright/test";

// A real signed-in browser journey, NOT a synthetic database-local JWT test.
// Test account and its current city must be seeded in an isolated staging
// Supabase project with rice-bowl and all three ingredients ACTIVE.
// This suite is deliberately excluded from the default Playwright config.
const stagingSupabase = new URL(process.env.COOKING_STAGING_SUPABASE_URL!).origin;

async function signInToIsolatedStaging(page: Page) {
  const foreignSupabaseCalls: string[] = [];
  // Abort unexpected Supabase targets BEFORE the first write. A staging
  // frontend accidentally configured for production must never be used.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (/(^|\.)supabase\.co$/.test(url.hostname) && url.origin !== stagingSupabase) {
      foreignSupabaseCalls.push(url.origin);
      await route.abort("blockedbyclient");
    } else {
      await route.continue();
    }
  });

  await page.goto("/auth");
  await expect(page.locator("#login-email")).toBeVisible();
  await page.locator("#login-email").fill(process.env.COOKING_STAGING_EMAIL!);
  await page.locator("#login-password").fill(process.env.COOKING_STAGING_PASSWORD!);
  const request = page.waitForResponse((response) =>
    response.url().startsWith(stagingSupabase + "/auth/v1/token")
    && response.request().method() === "POST");
  await page.locator("form:has(#login-email) button[type=submit]").click();
  const loginResponse = await request;
  expect(loginResponse.ok(), "The staging login must return a real Supabase user session").toBe(true);
  expect(foreignSupabaseCalls, "Staging app must not contact any other Supabase project").toEqual([]);

  await page.goto("/cooking");
  await expect(page.getByRole("heading", { name: "Live kitchen" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "City food market" })).toBeVisible();
  expect(foreignSupabaseCalls).toEqual([]);
  return foreignSupabaseCalls;
}

test.describe("staging-only signed-in cooking release gate", () => {
  test("buys ingredients, drags and cooks across reload, then eats one portion", async ({ page }) => {
    test.setTimeout(180_000);
    const foreignRequests = await signInToIsolatedStaging(page);

    // The dedicated staging character must have no active cooking session
    // and live in a city with three correctly seeded, affordable offers.
    const required = ["Mushrooms", "Rice", "Soy Seasoning"];
    await expect(page.getByRole("button", { name: "Start cooking with ingredients" })).toBeVisible();
    await page.locator("#cooking-market-quantity").selectOption("1");
    for (const ingredient of required) {
      const offer = page.locator("article").filter({
        has: page.getByRole("heading", { name: ingredient, exact: true }),
      });
      await expect(offer, `Seed an active staging offer for ${ingredient}`).toHaveCount(1);
      const buy = offer.getByRole("button", { name: /^Buy 1 for \$/ });
      await expect(buy).toBeEnabled();
      const response = page.waitForResponse((r) =>
        r.url().includes("/rest/v1/rpc/purchase_cooking_market_ingredient")
        && r.request().method() === "POST");
      await buy.click();
      expect((await response).ok(), `The ${ingredient} purchase must succeed`).toBe(true);
      await expect(page.getByRole("status").filter({ hasText: /Purchased 1 unit/ }).last()).toBeVisible();
    }

    await page.locator("#cooking-live-recipe").selectOption("rice-bowl");
    await page.getByRole("button", { name: "Start cooking with ingredients" }).click();
    await expect(page.getByRole("button", { name: /Mushrooms, tray, Raw/ })).toBeVisible();
    await page.getByRole("radio", { name: "Medium" }).check();

    // Use real pointer movement for at least one ingredient, then verify
    // the keyboard/touch-friendly selection controls for the second.
    await page.getByRole("button", { name: /Mushrooms, tray/ })
      .dragTo(page.getByRole("region", { name: "Cooking pan" }), { steps: 12 });
    await expect(page.getByRole("button", { name: /Mushrooms, pan/ })).toBeVisible();
    await page.getByRole("button", { name: /Rice, tray/ }).click();
    await page.getByRole("button", { name: "Add selected to pan" }).click();
    await expect(page.getByRole("button", { name: /Rice, pan/ })).toBeVisible();

    // Actual browser reload must recover server-accepted actions and clock.
    await page.reload();
    await expect(page.getByRole("button", { name: /Mushrooms, pan/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Rice, pan/ })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Medium" })).toBeChecked();
    await expect(page.getByRole("button", { name: /Mushrooms, pan, Ready|Mushrooms, pan, Overdone/ }))
      .toBeVisible({ timeout: 27_000 });
    await expect(page.getByRole("button", { name: /Rice, pan, Ready|Rice, pan, Overdone/ }))
      .toBeVisible({ timeout: 27_000 });

    for (const ingredient of ["Mushrooms", "Rice"]) {
      await page.getByRole("button", { name: new RegExp(`^${ingredient}, pan`) }).click();
      await page.getByRole("button", { name: "Plate selected ingredient" }).click();
      await expect(page.getByRole("button", { name: new RegExp(`^${ingredient}, plate`) })).toBeVisible();
    }
    await page.getByRole("button", { name: /Soy Seasoning, tray/ }).click();
    await page.getByRole("button", { name: "Add selected to pan" }).click();
    await expect(page.getByRole("button", { name: /Soy Seasoning, pan, Ready/ }))
      .toBeVisible({ timeout: 21_000 });
    await page.getByRole("button", { name: /Soy Seasoning, pan/ }).click();
    await page.getByRole("button", { name: "Plate selected ingredient" }).click();
    await page.getByRole("button", { name: "Finish and serve" }).click();
    await expect(page.getByText(/Finished food saved to your inventory/)).toBeVisible({ timeout: 15_000 });

    // Eating is a real authenticated RPC, not a client-only mock.
    await expect(page.getByRole("button", { name: "Eat 1 portion" }).first()).toBeEnabled();
    await page.getByRole("button", { name: "Eat 1 portion" }).first().click();
    await expect(page.getByText(/One portion eaten/)).toBeVisible();
    expect(foreignRequests).toEqual([]);
  });
});
