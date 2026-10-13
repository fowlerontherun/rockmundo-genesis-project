import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const migration = readFileSync(
  fileURLToPath(new URL("../../../supabase/migrations/20261013110500_admin_recovery_safety.sql", import.meta.url)),
  "utf8",
);

describe("admin recovery safety", () => {
  it("#3863 rejects reviving a healthy living character", () => {
    expect(migration).toContain("v_profile.died_at IS NULL AND v_profile.deleted_at IS NULL");
    expect(migration).toContain("RAISE EXCEPTION 'CHARACTER_ALREADY_ALIVE'");
  });
  it("#3862 respects the resurrection lives limit", () => {
    expect(migration).toContain("3 - COALESCE(v_profile.resurrection_lives, 0)");
    expect(migration).toContain("resurrection_lives = LEAST(3,");
  });
});
