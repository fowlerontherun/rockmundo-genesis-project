import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { auditCreationDates, isValidTimestamp } from "../scripts/supabase/audit-migration-creation-dates.mjs";

test("audits true Git creation day, protects historical identities and detects collisions", () => {
  const root = mkdtempSync(join(tmpdir(), "rockmundo-migration-audit-"));
  try {
    mkdirSync(join(root, "supabase/migrations"), { recursive: true });
    mkdirSync(join(root, "scripts/supabase"), { recursive: true });
    writeFileSync(join(root, "scripts/supabase/inherited-future-migrations.json"),
      JSON.stringify(["20300101000000_frozen.sql"]));
    for (const [name, sql] of [
      ["20290702120000_wrong.sql", "select 1;\n"],
      ["20300101000000_frozen.sql", "select 2;\n"],
      ["20260702120000_correct.sql", "select 3;\n"],
      ["20290702120000_rename_source.sql", "select 4;\n"],
    ]) writeFileSync(join(root, "supabase/migrations", name), sql);
    const git = (...args) => execFileSync("git", args, { cwd: root });
    git("init", "-q");
    git("config", "user.email", "audit@example.invalid");
    git("config", "user.name", "Audit");
    git("add", ".");
    execFileSync("git", ["commit", "-qm", "Add migrations"], { cwd: root,
      env: { ...process.env, GIT_AUTHOR_DATE: "2026-07-02T12:00:00Z",
        GIT_COMMITTER_DATE: "2026-07-02T12:00:00Z" } });
    git("mv", "supabase/migrations/20290702120000_rename_source.sql",
      "supabase/migrations/20260702123000_renamed.sql");
    execFileSync("git", ["commit", "-qm", "Rename migration"], { cwd: root,
      env: { ...process.env, GIT_AUTHOR_DATE: "2026-10-18T13:00:00Z",
        GIT_COMMITTER_DATE: "2026-10-18T13:00:00Z" } });
    const report = auditCreationDates(root);
    assert.equal(report.file_count, 4);
    const entry = name => report.entries.find(x => x.path.endsWith("/" + name));
    assert.equal(entry("20290702120000_wrong.sql").classification, "mismatch_proposed_version_collision");
    assert.equal(entry("20290702120000_wrong.sql").proposed_filename, "20260702120000_wrong.sql");
    assert.equal(entry("20290702120000_wrong.sql").proposed_timestamp_collision, true);
    assert.equal(entry("20290702120000_wrong.sql").first_git_introduction.utc_timestamp, "20260702120000");
    assert.equal(entry("20300101000000_frozen.sql").classification, "mismatch_protected_identity");
    assert.equal(entry("20260702120000_correct.sql").classification, "matching_calendar_date");
    assert.equal(entry("20260702123000_renamed.sql").first_git_introduction.utc_timestamp, "20260702120000");
    assert.equal(entry("20260702123000_renamed.sql").classification, "matching_calendar_date");
    const ledgerReviewed = auditCreationDates(root, ["20290702120000"]);
    const existingDeployed = ledgerReviewed.entries.find(x => x.path.endsWith("/20290702120000_wrong.sql"));
    assert.equal(existingDeployed.classification, "mismatch_deployed_version");
    assert.equal(existingDeployed.history_version_match, true);

  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("validates UTC calendar timestamps rather than only 14 digits", () => {
  assert.equal(isValidTimestamp("20261019120000"), true);
  assert.equal(isValidTimestamp("20270431120000"), false);
  assert.equal(isValidTimestamp("20291218245800"), false);
  assert.equal(isValidTimestamp("20260229090000"), false);
  assert.equal(isValidTimestamp("20240229090000"), true);
});
