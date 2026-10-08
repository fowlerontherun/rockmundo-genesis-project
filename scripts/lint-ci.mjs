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
  const normalizedPath = (filePath) => filePath.replaceAll("\\", "/");
  const focused = report.filter((file) => {
    const path = normalizedPath(file.filePath);
    return file.errorCount > 0 && (
      activeSessionPaths.some((activePath) => path.endsWith(activePath)) ||
      path.includes("/src/features/top-of-the-pops/") ||
      path.includes("/src/features/gig-demo-3d/") ||
      path.includes("/src/features/player-model/") ||
      path.includes("/src/features/clothing-preview/") ||
      path.endsWith("/src/components/tattoo/TattooAvatarPreview.tsx") ||
      path.endsWith("/src/pages/TattooParlour.tsx") ||
      path.endsWith("/src/features/gig-experience/viewer/GigCanvas.tsx") ||
      path.endsWith("/src/features/gig-experience/viewer/three/GigStage3D.tsx") ||
      path.endsWith("/src/features/gig-experience/viewer/three/presentation.ts")
    );
  });

  const topFiles = report
    .filter((file) => file.errorCount > 0)
    .sort((a, b) => b.errorCount - a.errorCount)
    .slice(0, 25);
  console.error("\nTop ESLint error files (diagnostic only):");
  for (const file of topFiles) {
    console.error(`  ${normalizedPath(file.filePath)} — ${file.errorCount} error(s)`);
  }

  if (focused.length) {
    console.error("\nErrors in release-focused files:");
    for (const file of focused) {
      console.error(`\n${file.filePath}`);
      for (const message of file.messages.filter((item) => item.severity === 2)) {
        console.error(`  ${message.line}:${message.column}  ${message.ruleId ?? "eslint"}  ${message.message}`);
      }
    }
  }

  process.exit(1);
}
