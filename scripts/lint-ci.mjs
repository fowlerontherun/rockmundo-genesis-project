import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const { errors: baselineErrors } = JSON.parse(
  readFileSync(new URL("../.eslint-error-baseline.json", import.meta.url), "utf8"),
);
const eslint = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["eslint", ".", "--format", "json"],
  { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 },
);

if (eslint.error) throw eslint.error;
let report;
try {
  report = JSON.parse(eslint.stdout);
} catch {
  process.stderr.write(eslint.stderr || eslint.stdout);
  process.exit(eslint.status || 2);
}

const currentErrors = report.reduce((total, file) => total + file.errorCount, 0);
const newErrors = Math.max(0, currentErrors - baselineErrors);
console.log(`ESLint baseline errors: ${baselineErrors}`);
console.log(`ESLint current errors: ${currentErrors}`);
console.log(`ESLint new errors: ${newErrors}`);
if (newErrors > 0) process.exit(1);
