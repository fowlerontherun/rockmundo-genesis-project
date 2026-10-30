import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/reconciliation/festival/20261030_strict_festival_slot_saves.sql"), "utf8",
);

describe("festival schedule server-side timezone and idempotency guard", () => {
  it("rejects ambiguous naive API timestamp input and mismatched local day", () => {
    expect(sql).toContain("FESTIVAL_SCHEDULE_EXPLICIT_TIMEZONE_REQUIRED");
    expect(sql).toContain("FESTIVAL_SCHEDULE_WRONG_LOCAL_DAY");
    expect(sql).toContain("FESTIVAL_SCHEDULE_DURATION_MISMATCH");
    expect(sql).toContain("v_starts AT TIME ZONE v_tz");
  });
  it("uses the actual legacy edition ownership and stage/slot identities", () => {
    expect(sql).toContain("public.can_manage_festival_edition");
    expect(sql).toContain("FESTIVAL_SCHEDULE_STAGE_MISMATCH");
    expect(sql).toContain("FESTIVAL_SCHEDULE_SLOT_WRONG_EDITION");
    expect(sql).toContain("public.festival_stage_slots");
  });
  it("guards retry hashes with per-edition advisory locking and private receipts", () => {
    expect(sql).toContain("private.festival_schedule_slot_upsert_receipts");
    expect(sql).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(sql).toContain("FESTIVAL_SCHEDULE_IDEMPOTENCY_CONFLICT");
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
    expect(sql).not.toContain("GRANT SELECT ON private.festival_schedule_slot_upsert_receipts");
  });
});