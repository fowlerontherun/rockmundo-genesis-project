import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261018211500_atomic_character_prison_release.sql",
  "utf8",
);
const worker = readFileSync("supabase/functions/release-prisoners/index.ts", "utf8");
const harness = readFileSync("supabase/tests/prison_release_character_harness.sql", "utf8");

describe("character-authoritative prison release (#4252)", () => {
  it("never clears account-wide imprisonment or chooses a band by auth user ID", () => {
    expect(worker).toContain('supabase.rpc(\n          "release_due_prisoner_atomic"');
    expect(worker).not.toContain('.update({ is_imprisoned: false })');
    expect(worker).not.toContain('.eq("user_id", prisoner.user_id)');
    expect(worker).not.toContain("prisoner.user_id)\n          .eq('is_touring_member'");
    expect(worker).toContain("if (!prisoner.profile_id)");
  });

  it("locks imprisonment and its owner, validates due state, and rejects unattributed rows", () => {
    expect(migration).toMatch(/WHERE id = p_imprisonment_id FOR UPDATE;/);
    expect(migration).toContain("v_prisoner.status <> 'imprisoned'");
    expect(migration).toContain("v_prisoner.release_date > p_at");
    expect(migration).toContain("PRISON_RELEASE_UNATTRIBUTED_CHARACTER");
    expect(migration).toContain("id = v_prisoner.profile_id AND user_id = v_prisoner.user_id FOR UPDATE");
    expect(migration).toContain("status = 'imprisoned'");
    expect(migration).toContain("v_remaining_active");
  });

  it("atomically records character-scoped notification and unique criminal record", () => {
    expect(migration).toContain("player_criminal_record_one_per_imprisonment_idx");
    expect(migration).toContain("INSERT INTO public.player_criminal_record");
    expect(migration).toContain("INSERT INTO public.activity_feed(user_id, profile_id");
    expect(migration).toContain("bm.profile_id = v_prisoner.profile_id");
    expect(migration).toContain("FROM public.bands WHERE id = v_band_id FOR UPDATE");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("TO service_role");
  });

  it("ships a rollback-only fixture covering two characters, overlapping sentences and replay", () => {
    expect(harness).toContain("BEGIN;");
    expect(harness).toContain("ROLLBACK;");
    expect(harness).toContain("v_profile_one");
    expect(harness).toContain("v_profile_two");
    expect(harness).toContain("v_overlap");
    expect(harness).toContain("v_orphan");
    expect(harness).toContain("already_finalized");
    expect(harness).toContain("has_function_privilege('authenticated'");
  });
});
