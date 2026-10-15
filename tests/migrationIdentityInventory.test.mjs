import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMigrationIdentityInventory,
  recordedVersionsFromJson,
} from "../scripts/migration-identity-inventory.mjs";

test("#4072 identical timestamp with different SQL is never silently deduplicated", () => {
  const inventory = buildMigrationIdentityInventory([
    { path: "supabase/migrations/20300106200000_a.sql", content: "select 1;" },
    { path: "supabase/migrations/20300106200000_b.sql", content: "select 2;" },
  ], ["20300106200000"]);
  assert.equal(inventory.generated_file_count, 2);
  assert.equal(inventory.duplicate_timestamp_groups.length, 1);
  assert.equal(inventory.duplicate_timestamp_groups[0].paths.length, 2);
  assert.equal(inventory.identical_sql_groups.length, 0);
  assert.equal(inventory.entries[0].history_identity, "version_matched_unverified");
  assert.equal(inventory.entries[0].schema_effects, "not_verified");
  assert.equal(inventory.entries[0].deployment_decision, "manual_review_required");
});

test("#4072 identical SQL can be a renamed migration even with a different version", () => {
  const inventory = buildMigrationIdentityInventory([
    { path: "supabase/migrations/20261012000000_a.sql", content: "select 1;" },
    { path: "supabase/migrations/20261013000000_b.sql", content: "select 1;" },
  ], ["20261012000000"]);
  assert.equal(inventory.duplicate_timestamp_groups.length, 0);
  assert.equal(inventory.identical_sql_groups.length, 1);
  assert.deepEqual(inventory.entries.map(item => item.history_identity), [
    "version_matched_unverified", "version_missing_unverified",
  ]);
});

test("#4072 unknown production history is not mistaken for a missing deployment", () => {
  const inventory = buildMigrationIdentityInventory([
    { path: "supabase/migrations/20261015123456_some_change.sql", content: "select now();" },
  ]);
  assert.equal(inventory.entries[0].history_identity, "not_provided");
});

test("#4072 reject malformed history and version-free migration filenames", () => {
  assert.deepEqual(recordedVersionsFromJson([{ version: "20261015123456" }]), ["20261015123456"]);
  assert.throws(() => recordedVersionsFromJson([{ version: "DROP TABLE" }]), /nonnumeric/);
  assert.throws(() => recordedVersionsFromJson({ version: "20261015123456" }), /array/);
  assert.throws(() => buildMigrationIdentityInventory([{ path: "manual-repair.sql", content: "select 1" }]), /Invalid migration/);
});
