import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the shared Vitest config supports the certification --maxWorkers=1 command", async () => {
  const config = await readFile(new URL("../../vitest.config.ts", import.meta.url), "utf8");

  assert.match(config, /minWorkers:\s*1/);
});
