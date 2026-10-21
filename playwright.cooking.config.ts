import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/cooking",
  timeout: 30_000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5187", screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5187 --strictPort",
    url: "http://127.0.0.1:5187/tests/fixtures/cooking-practice.html",
    reuseExistingServer: !process.env.CI,
  },
  outputDir: "test-results/cooking",
});
