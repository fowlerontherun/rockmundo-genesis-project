import { defineConfig, devices } from "@playwright/test";
import { validateCookingStagingOrigins } from "./tests/cooking-staging/stagingNetworkSafety";

const required = [
  "COOKING_STAGING_BASE_URL",
  "COOKING_STAGING_SUPABASE_URL",
  "COOKING_STAGING_EMAIL",
  "COOKING_STAGING_PASSWORD",
] as const;
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) {
  throw new Error(`Cooking staging browser test requires: ${missing.join(", ")}`);
}
if (process.env.COOKING_STAGING_ALLOW_WRITES !== "YES_STAGING_ONLY") {
  throw new Error("Cooking browser purchase/cook/eat test requires explicit staging-only write acknowledgement");
}
const { appOrigin, apiOrigin } = validateCookingStagingOrigins(
  process.env.COOKING_STAGING_BASE_URL!,
  process.env.COOKING_STAGING_SUPABASE_URL!,
);
// The API origin is validated at config load, before running any test.
// Individual browser tests also refuse HTTP calls to a different API.
void apiOrigin;

export default defineConfig({
  testDir: "./tests/cooking-staging",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report/cooking-staging", open: "never" }]],
  use: {
    baseURL: appOrigin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 12_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  outputDir: "test-results/cooking-staging",
});
