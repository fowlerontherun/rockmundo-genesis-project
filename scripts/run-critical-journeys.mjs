import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const manifestPath = resolve(repositoryRoot, "src/testing/critical-journeys.json");
const requiredJourneyIds = [
  "auth-session-recovery",
  "character-creation",
  "dashboard-next-action",
  "songwriting",
  "recording",
  "release",
  "gig-completion",
  "band-basics",
  "wellness-recovery",
  "inbox-notifications",
  "mobile-dashboard-actions",
  "admin-bug-visibility",
];

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const errors = [];

if (manifest.version !== 1) errors.push("critical-journeys.json must use version 1");
if (!Array.isArray(manifest.journeys)) errors.push("critical-journeys.json must contain a journeys array");

const journeys = Array.isArray(manifest.journeys) ? manifest.journeys : [];
const journeyIds = journeys.map((journey) => journey.id);

for (const id of requiredJourneyIds) {
  if (!journeyIds.includes(id)) errors.push(`missing required critical journey: ${id}`);
}

const duplicateIds = journeyIds.filter((id, index) => journeyIds.indexOf(id) !== index);
if (duplicateIds.length) errors.push(`duplicate critical journey ids: ${[...new Set(duplicateIds)].join(", ")}`);

for (const journey of journeys) {
  if (!journey.label || typeof journey.label !== "string") errors.push(`${journey.id}: label is required`);
  if (!Array.isArray(journey.regressions) || journey.regressions.length === 0) {
    errors.push(`${journey.id}: at least one known regression is required`);
  }
  if (!Array.isArray(journey.tests) || journey.tests.length === 0) {
    errors.push(`${journey.id}: at least one test file is required`);
    continue;
  }
  for (const testFile of journey.tests) {
    if (!/\.(test|spec)\.[cm]?[jt]sx?$/.test(testFile)) {
      errors.push(`${journey.id}: ${testFile} is not a test file`);
    }
    if (!existsSync(resolve(repositoryRoot, testFile))) {
      errors.push(`${journey.id}: missing test file ${testFile}`);
    }
  }
}

if (errors.length) {
  console.error("Critical journey manifest is invalid:\n" + errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

const testFiles = [...new Set(journeys.flatMap((journey) => journey.tests))];
const vitestEntry = resolve(repositoryRoot, "node_modules/vitest/vitest.mjs");

console.log(`Critical journey gate: ${journeys.length} journeys across ${testFiles.length} production test files.`);
for (const journey of journeys) console.log(`- ${journey.label}`);

const result = spawnSync(
  process.execPath,
  [vitestEntry, "run", ...testFiles, ...process.argv.slice(2)],
  { cwd: repositoryRoot, env: process.env, stdio: "inherit" },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
