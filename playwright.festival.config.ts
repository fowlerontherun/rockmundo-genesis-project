import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/**
 * Festival E2E specs live outside the gig-experience testDir. Without this
 * explicit config, the festival script reports `No tests found` and cannot
 * certify even the seeded London browser fixture.
 */
export default defineConfig({
  ...base,
  testDir: "./tests/festivals",
  outputDir: "test-results/festivals",
});
