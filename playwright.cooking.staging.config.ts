import { defineConfig, devices } from "@playwright/test";

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
const appUrl = new URL(process.env.COOKING_STAGING_BASE_URL!);
const apiUrl = new URL(process.env.COOKING_STAGING_SUPABASE_URL!);
const productionSupabase = "yztogmdixmchsmimtent";
if (!["http:", "https:"].includes(appUrl.protocol) ||
    !["http:", "https:"].includes(apiUrl.protocol) ||
    /(^|\.)rockmundo\.uk$/i.test(appUrl.hostname) ||
    /(^|\.)rockmundo\.uk$/i.test(apiUrl.hostname) ||
    apiUrl.hostname.includes(productionSupabase) ||
    !/(staging|test|localhost|127\.0\.0\.1|preview)/i.test(appUrl.hostname)) {
  throw new Error("Cooking E2E must use a clearly named staging/preview app and a nonproduction Supabase project");
}

export default defineConfig({
  testDir: "./tests/cooking-staging",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report/cooking-staging", open: "never" }]],
  use: {
    baseURL: appUrl.origin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 12_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  outputDir: "test-results/cooking-staging",
});
