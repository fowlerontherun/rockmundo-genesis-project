import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20291218245300_festival_simplified_annual_plan.sql",
  "utf8",
);

describe("simplified annual Festival SQL boundary", () => {
  it("addresses one canonical annual edition and never guesses by company alone", () => {
    expect(migration).toContain("get_festival_edition_annual_plan");
    expect(migration).toContain("save_festival_edition_annual_plan");
    expect(migration).toMatch(
      /WHERE id = p_festival_edition_id[\s\S]*festival_company_id = p_festival_company_id/i,
    );
    expect(migration).toMatch(/edition\.id = p_festival_edition_id/i);
  });

  it("is owner or admin authorised, optimistic and idempotent", () => {
    expect(migration).toMatch(/auth\.uid\(\) IS NULL OR actor IS NULL/i);
    expect(migration).toMatch(/company\.owner_profile_id <> actor/i);
    expect(migration).toMatch(
      /has_role\(auth\.uid\(\), 'admin'::public\.app_role\)/i,
    );
    expect(migration).toMatch(/edition\.version <> p_expected_version/i);
    expect(migration).toContain("festival_annual_plan_requests");
    expect(migration).toContain("festival_annual_plan_idempotency_conflict");
  });

  it("stores only high-level owner choices and server-derived projections", () => {
    for (const field of [
      "preferred_month",
      "city_id",
      "site_type",
      "festival_scale",
      "duration_days",
      "vibe",
      "marketing_emphasis",
      "expected_capacity",
      "estimated_operating_cost_minor",
      "readiness_score",
    ]) {
      expect(migration).toContain(field);
    }

    expect(migration).toContain("_festival_annual_plan_capacity");
    expect(migration).toContain("_festival_annual_plan_cost");
    expect(migration).toContain("_festival_annual_plan_upgrade_progress");
  });

  it("does not expose operational administration as part of the annual save", () => {
    const saveFunction = migration.match(
      /CREATE OR REPLACE FUNCTION public\.save_festival_edition_annual_plan[\s\S]*?END;\n\$\$;/,
    )?.[0];

    expect(saveFunction).toBeTruthy();
    expect(saveFunction).not.toMatch(/INSERT INTO public\.festival_staff/i);
    expect(saveFunction).not.toMatch(/INSERT INTO public\.festival_supplier/i);
    expect(saveFunction).not.toMatch(/INSERT INTO public\.festival_timetable/i);
    expect(saveFunction).not.toMatch(/INSERT INTO public\.festival_permit/i);
    expect(saveFunction).not.toMatch(/INSERT INTO public\.festival_settlement/i);
  });

  it("keeps public and anonymous execution revoked", () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.get_festival_edition_annual_plan\(uuid, uuid\) FROM PUBLIC, anon/i,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.save_festival_edition_annual_plan\(uuid, uuid, integer, jsonb, uuid\) FROM PUBLIC, anon/i,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_festival_edition_annual_plan\(uuid, uuid\) TO authenticated/i,
    );
  });
});
