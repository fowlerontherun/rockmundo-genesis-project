import test from "node:test";
import assert from "node:assert/strict";
import { findNodeNativeTests } from "./native-test-discovery.mjs";

test("Node-native tests are discovered without swallowing Vitest .mjs suites", () => {
  const paths = findNodeNativeTests();
  assert.ok(paths.includes("scripts/dependency-lock-integrity.test.mjs"));
  assert.ok(paths.includes("tests/daily-login-cron-sql-quotation.test.mjs"));
  assert.ok(paths.includes("scripts/native-test-discovery.test.mjs"));
  assert.ok(!paths.includes("scripts/festivals/summary-validators.test.mjs"));
  assert.ok(!paths.includes("scripts/festivals/assert-safe-test-database.test.mjs"));
  assert.equal(paths.length, new Set(paths).size);
});
