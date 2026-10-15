import { createHash } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMigrationIdentityInventory,
  recordedVersionsFromJson,
  recordedHistoryEvidenceFromJson,
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

test("#4072 matched original SQL bytes remain schema-unverified", () => {
  const content = "select 42;";
  // SHA256 of the exact SQL content, not the Git blob SHA1.
  const digest = createHash("sha256").update(content).digest("hex");
  const parsed = recordedHistoryEvidenceFromJson([
    { version: "20261015123000", sha256: digest },
  ]);
  const inventory = buildMigrationIdentityInventory([
    { path: "supabase/migrations/20261015123000_reward.sql", content },
  ], parsed);
  assert.equal(inventory.entries[0].history_sql_hash, "source_hash_matched_schema_unverified");
  assert.equal(inventory.entries[0].schema_effects, "not_verified");
});

test("#4072 detects historic hash drift even with a matching version", () => {
  const staleDigest = "a".repeat(64);
  const inventory = buildMigrationIdentityInventory([
    { path: "supabase/migrations/20261015123100_drift.sql", content: "select 2;" },
  ], recordedHistoryEvidenceFromJson([
    { version: "20261015123100", sha256: staleDigest },
    { version: "20261015123100", sha256: "b".repeat(64) },
  ]));
  assert.equal(inventory.entries[0].history_identity, "version_matched_unverified");
  assert.equal(inventory.entries[0].history_sql_hash, "conflicting_history_hashes_manual_review");
  assert.deepEqual(inventory.history_hash_collision_versions, ["20261015123100"]);
  assert.equal(inventory.entries[0].deployment_decision, "manual_review_required");
  assert.throws(() => recordedHistoryEvidenceFromJson([
    { version: "20261015123100", sha256: "not-a-digest" },
  ]), /invalid SQL SHA256/);
});

test("#4072 contradictory history is unsafe even if one reported digest matches source", () => {
  const content = "select 100;";
  const realDigest = createHash("sha256").update(content).digest("hex");
  const inventory = buildMigrationIdentityInventory([
    { path: "supabase/migrations/20261015124000_source.sql", content },
  ], recordedHistoryEvidenceFromJson([
    { version: "20261015124000", sha256: realDigest },
    { version: "20261015124000", sha256: "f".repeat(64) },
  ]));
  assert.equal(inventory.entries[0].history_sql_hash, "conflicting_history_hashes_manual_review");
  assert.deepEqual(inventory.history_hash_collision_versions, ["20261015124000"]);
  assert.equal(inventory.entries[0].deployment_decision, "manual_review_required");
});

test("#4072 single mismatched history hash is explicitly refused", () => {
  const inventory = buildMigrationIdentityInventory([
    { path: "supabase/migrations/20261015124100_source.sql", content: "select 101;" },
  ], [{ version: "20261015124100", sha256: "0".repeat(64) }]);
  assert.equal(inventory.entries[0].history_sql_hash, "source_hash_mismatch_manual_review");
});
