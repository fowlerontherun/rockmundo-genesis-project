import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20291218245200_festival_v2_schedule_stage_sync.sql",
  "utf8",
);

describe("festival_editions_v2 schedule stage sync migration", () => {
  it("resolves the one-to-one schedule bridge before projecting stages", () => {
    expect(migration).toMatch(
      /ensure_festival_v2_schedule_bridge\(p_festival_edition_id\)/i,
    );
    expect(migration).toMatch(/scheduleEditionId/i);
    expect(migration).toMatch(/scheduleFestivalId/i);
  });

  it("reads only the site plan explicitly bound to the selected annual edition", () => {
    expect(migration).toMatch(
      /FROM public\.festival_site_plans[\s\S]*festival_company_id = v_company_id[\s\S]*festival_edition_id = p_festival_edition_id/i,
    );
    expect(migration).toMatch(/FROM public\.festival_site_plan_stages/i);
  });

  it("uses stable source-stage identities and does not duplicate schedule stages", () => {
    expect(migration).toMatch(/v2-site-stage:/i);
    expect(migration).toMatch(/idempotency_key = 'v2-site-stage:' \|\| v_source\.id::text/i);
    expect(migration).toMatch(/create_festival_edition_stage/i);
  });

  it("seeds only missing operating-hour rows so schedule edits remain authoritative", () => {
    expect(migration).toMatch(
      /IF NOT EXISTS \([\s\S]*FROM public\.festival_stage_operating_hours/i,
    );
    expect(migration).toMatch(/festival_schedule_configure_stage_hours/i);
    expect(migration).not.toMatch(/DELETE FROM public\.festival_stage_operating_hours/i);
  });

  it("keeps the wrapper private from anonymous users", () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.ensure_festival_v2_schedule_workspace\(uuid\)[\s\S]*FROM PUBLIC, anon/i,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.ensure_festival_v2_schedule_workspace\(uuid\)[\s\S]*TO authenticated/i,
    );
  });
});
