import test from "node:test";
import assert from "node:assert/strict";
import { buildMigrationManifest, gitBlobSha, parseArgs } from "./reconcile-migration-history.mjs";

test("Git blob SHA uses the Git header and raw bytes", () => {
  assert.equal(gitBlobSha("test\n"), "9daeafb9864cf43055ae93beb0afd6c7d144bfa4");
});

test("matching history cannot mark SQL applied without schema verification", () => {
  const manifest = buildMigrationManifest(
    [{ path: "supabase/migrations/20261014120000_safe_example.sql", body: Buffer.from("select 1;\n") }],
    [{ version: "20261014120000", name: "safe_example" }],
  );
  const [row] = manifest.rows;
  assert.equal(row.identity_status, "history_identity_match_only");
  assert.equal(row.sql_applied, "unverified");
  assert.equal(row.schema_status, "unverified");
  assert.equal(row.decision, "manual_review_required");
  assert.equal(row.git_blob_sha.length, 40);
  assert.equal(row.sql_sha256.length, 64);
});

test("duplicate repository identities remain ambiguous even if history has one version", () => {
  const manifest = buildMigrationManifest([
    { path: "supabase/migrations/20261014120000_one.sql", body: "select 1;" },
    { path: "supabase/migrations/20261014120000_two.sql", body: "select 2;" },
  ], [{ version: "20261014120000", name: "one" }]);
  assert.equal(manifest.summary.duplicate_timestamp_ambiguous, 2);
  assert.ok(manifest.rows.every((row) => row.decision === "manual_review_required"));
});

test("missing history and invalid filenames cannot be treated as safe to deploy", () => {
  const manifest = buildMigrationManifest([
    { path: "supabase/migrations/20261014120001_unseen.sql", body: "" },
    { path: "supabase/migrations/legacy.sql", body: "" },
  ]);
  assert.equal(manifest.summary.history_not_supplied, 1);
  assert.equal(manifest.summary.invalid_filename, 1);
  assert.throws(() => parseArgs(["--history"]), /Usage/);
  assert.deepEqual(parseArgs(["--history", "history.json", "--output", "manifest.json"]), {
    history: "history.json",
    output: "manifest.json",
  });
});
