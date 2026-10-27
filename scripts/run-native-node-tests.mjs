import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { findNodeNativeTests } from "./native-test-discovery.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const paths = findNodeNativeTests(root);
if (!paths.length) {
  console.error("No Node-native tests discovered; failing rather than silently skipping tests.");
  process.exitCode = 1;
} else {
  console.log(`Running ${paths.length} Node-native test files independently of Vitest`);
  const result = spawnSync(process.execPath, ["--test", ...paths], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) console.error(result.error);
  process.exitCode = result.status === 0 ? 0 : 1;
}
