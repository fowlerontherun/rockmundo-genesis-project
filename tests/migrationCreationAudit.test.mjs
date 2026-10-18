import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { auditCreationDates } from "../scripts/supabase/audit-migration-creation-dates.mjs";

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
    ]) writeFileSync(join(root, "supabase/migrations", name), sql);
    const git = (...args) => execFileSync("git", args, { cwd: root });
    git("init", "-q");
    git("config", "user.email", "audit@example.invalid");
    git("config", "user.name", "Audit");
    git("add", ".");
    execFileSync("git", ["commit", "-qm", "Add migrations"], { cwd: root,
      env: { ...process.env, GIT_AUTHOR_DATE: "2026-07-02T12:00:00Z",
        GIT_COMMITTER_DATE: "2026-07-02T12:00:00Z" } });
    const report = auditCreationDates(root);
    assert.equal(report.file_count, 3);
    const entry = name => report.entries.find(x => x.path.endsWith("/" + name));
    assert.equal(entry("20290702120000_wrong.sql").classification, "mismatch_requires_live_history_and_schema_review");
    assert.equal(entry("20290702120000_wrong.sql").first_git_introduction.utc_timestamp, "20260702120000");
    assert.equal(entry("20300101000000_frozen.sql").classification, "mismatch_protected_identity");
    assert.equal(entry("20260702120000_correct.sql").classification, "matching_calendar_date");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
