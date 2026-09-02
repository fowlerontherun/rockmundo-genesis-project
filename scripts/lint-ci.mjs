import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";

const baselineCommit = "dcbc70bcdbba4fb01fa84a00db71e8508ecd730d";
const root = process.cwd();
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

if (newErrors > 0) {
  const activeSessionPaths = [
    "/src/components/gig/ActiveGigPerformanceDialog.tsx",
    "/src/components/gig/LiveGigAudiencePanel.tsx",
    "/src/components/recording/ActiveRecordingDialog.tsx",
    "/src/components/recording/RecordedSongsTab.tsx",
    "/src/components/rehearsal/ActiveRehearsalDialog.tsx",
    "/src/components/songwriting/ActiveSongwritingDialog.tsx",
    "/src/components/songwriting/SimplifiedProjectCard.tsx",
    "/src/components/stage-practice/StagePracticeResults.tsx",
    "/src/pages/Rehearsals.tsx",
  ];
  const focused = report.filter((file) =>
    file.errorCount > 0 && activeSessionPaths.some((path) => file.filePath.replaceAll("\\", "/").endsWith(path)),
  );

  if (focused.length) {
    console.error("\nErrors in Active Sessions release files:");
    for (const file of focused) {
      console.error(`\n${file.filePath}`);
      for (const message of file.messages.filter((item) => item.severity === 2)) {
        console.error(`  ${message.line}:${message.column}  ${message.ruleId ?? "eslint"}  ${message.message}`);
      }
    }
  }

  const baselineDir = resolve(tmpdir(), `rockmundo-eslint-baseline-${process.pid}`);
  const run = (command, args, options = {}) => spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    ...options,
  });

  try {
    rmSync(baselineDir, { recursive: true, force: true });
    const fetch = run("git", ["fetch", "--no-tags", "--depth=1", "origin", baselineCommit]);
    if (fetch.status !== 0) throw new Error(fetch.stderr || fetch.stdout || "Unable to fetch lint baseline commit");

    const worktree = run("git", ["worktree", "add", "--detach", baselineDir, baselineCommit]);
    if (worktree.status !== 0) throw new Error(worktree.stderr || worktree.stdout || "Unable to create lint baseline worktree");

    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const install = run(npm, ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: baselineDir });
    if (install.status !== 0) throw new Error(install.stderr || install.stdout || "Unable to install lint baseline dependencies");

    const baselineLint = run(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["eslint", ".", "--format", "json"],
      { cwd: baselineDir },
    );
    if (baselineLint.error) throw baselineLint.error;

    let baselineReport;
    try {
      baselineReport = JSON.parse(baselineLint.stdout);
    } catch {
      throw new Error(baselineLint.stderr || baselineLint.stdout || "Unable to parse lint baseline report");
    }

    const normalize = (base, filePath) => relative(base, filePath).replaceAll("\\", "/");
    const baselineByFile = new Map(
      baselineReport.map((file) => [normalize(baselineDir, file.filePath), file.errorCount]),
    );
    const baselineReplayErrors = baselineReport.reduce((total, file) => total + file.errorCount, 0);
    console.error(`\nReplayed July 31 baseline errors: ${baselineReplayErrors}`);
    console.error("Files with increased ESLint error counts since the baseline:");

    let foundIncrease = false;
    for (const file of report) {
      const path = normalize(root, file.filePath);
      const previous = baselineByFile.get(path) ?? 0;
      if (file.errorCount <= previous) continue;
      foundIncrease = true;
      console.error(`\n${path}: ${previous} -> ${file.errorCount} (+${file.errorCount - previous})`);
      for (const message of file.messages.filter((item) => item.severity === 2)) {
        console.error(`  ${message.line}:${message.column}  ${message.ruleId ?? "eslint"}  ${message.message}`);
      }
    }

    if (!foundIncrease) {
      console.error("No per-file increase found; the delta is likely caused by lint configuration or dependency changes.");
    }
  } catch (error) {
    console.error(`\nLint delta diagnostic failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    run("git", ["worktree", "remove", "--force", baselineDir]);
    rmSync(baselineDir, { recursive: true, force: true });
  }

  process.exit(1);
}
