import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20291218245100_festival_v2_schedule_bridge.sql",
  "utf8",
);

describe("festival_editions_v2 schedule bridge migration", () => {
  it("creates a one-to-one canonical-to-schedule authority boundary", () => {
    expect(migration).toMatch(
      /festival_edition_id uuid PRIMARY KEY REFERENCES public\.festival_editions_v2/i,
    );
    expect(migration).toMatch(
      /schedule_festival_id uuid NOT NULL UNIQUE REFERENCES public\.festivals/i,
    );
    expect(migration).toMatch(
      /schedule_edition_id uuid NOT NULL UNIQUE REFERENCES public\.festival_editions/i,
    );
  });

  it("requires owner or administrator authority and denies anonymous execution", () => {
    expect(migration).toMatch(/current_profile_id_safe\(\)/i);
    expect(migration).toMatch(/v_company\.owner_profile_id <> v_actor/i);
    expect(migration).toMatch(/is_admin\(auth\.uid\(\)\)/i);
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.ensure_festival_v2_schedule_bridge\(uuid\)[\s\S]*FROM PUBLIC, anon/i,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.ensure_festival_v2_schedule_bridge\(uuid\)[\s\S]*TO authenticated/i,
    );
  });

  it("fails closed for incomplete or ambiguous annual editions", () => {
    expect(migration).toContain("FESTIVAL_SCHEDULE_BRIDGE_AMBIGUOUS");
    expect(migration).toContain("FESTIVAL_SCHEDULE_SETUP_INCOMPLETE");
    expect(migration).toContain("FESTIVAL_SCHEDULE_ACCESS_DENIED");
  });

  it("creates a dedicated hidden compatibility aggregate per annual edition", () => {
    expect(migration).toMatch(/hiddenCompatibilityAggregate/i);
    expect(migration).toMatch(/festivalEditionV2Id/i);
    expect(migration).toMatch(/v2_schedule_shadow/i);
    expect(migration).toMatch(
      /INSERT INTO public\.festival_legacy_mappings[\s\S]*INSERT INTO public\.festival_public_legacy_bridges/i,
    );
  });
});
