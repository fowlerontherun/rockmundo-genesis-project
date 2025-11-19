import { test, expect } from "@playwright/test";

test.describe("Awards lifecycle", () => {
  test("runs from submissions through results", async ({ page }) => {
    await page.goto("/awards");

    await expect(page.getByTestId("lifecycle-banner")).toContainText("Submissions Open");

    const submitTrigger = page.getByRole("button", { name: "Submit Nomination" }).first();
    await submitTrigger.click();

    const modalSubmit = page.getByTestId("submit-nomination");
    await expect(modalSubmit).toBeDisabled();

    await page.getByTestId("nomination-category").click();
    await page.getByRole("option", { name: "Best Song" }).click();
    await page.getByTestId("nominee-type").click();
    await page.getByRole("option", { name: "Song" }).click();
    await page.getByTestId("nominee-name").fill("Firestarter");
    await page.getByTestId("nomination-country").fill("Spain");
    await modalSubmit.click();

    await expect(page.getByText("Nomination submitted successfully!")).toBeVisible();

    await page.getByRole("tab", { name: /My Nominations/ }).click();
    await expect(page.getByText("Firestarter")).toBeVisible();

    await page.getByRole("tab", { name: "Award Shows" }).click();
    await page.getByRole("button", { name: "Submit Nomination" }).first().click();
    await page.getByTestId("nomination-category").click();
    await page.getByRole("option", { name: "Best Live Act" }).click();
    await page.getByTestId("nominee-type").click();
    await page.getByRole("option", { name: "Band" }).click();
    await page.getByTestId("nominee-name").fill("Neon Rivers");
    await page.getByTestId("nomination-country").fill("Canada");
    await page.getByTestId("submit-nomination").click();

    await page.getByRole("tab", { name: "Vote" }).click();

    await page.evaluate(() => {
      (window as any).__awardsMockApi.selectFinalists();
      (window as any).__awardsMockApi.advancePhase("selection");
    });

    await expect(page.getByTestId("finalists-grid")).toBeVisible();
    await expect(page.getByTestId("finalist-spain")).toContainText("Firestarter");
    await expect(page.getByTestId("finalist-canada")).toContainText("Neon Rivers");

    await page.evaluate(() => (window as any).__awardsMockApi.advancePhase("event_live"));
    await page.evaluate(() => (window as any).__awardsMockApi.advancePhase("voting"));
    await expect(page.getByTestId("lifecycle-banner")).toContainText("Voting Open");

    const voteButtons = page.locator("[data-testid^='vote-']");
    await voteButtons.nth(0).click();
    await voteButtons.nth(1).click();
    await voteButtons.nth(0).click();
    await expect(page.getByText("Vote limit reached")).toBeVisible();

    await page.evaluate(() => (window as any).__awardsMockApi.advancePhase("results"));
    await expect(page.getByTestId("results-panel")).toBeVisible();
    await expect(voteButtons.nth(0)).toBeDisabled();
  });
});
