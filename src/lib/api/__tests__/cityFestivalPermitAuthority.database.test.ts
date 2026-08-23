import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20291218252000_city_festival_permit_authority.sql",
);
const sql = fs.readFileSync(migrationPath, "utf8");

describe("city Festival permit authority", () => {
  it("creates an edition-scoped permit lifecycle with owner and mayor authorities", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.city_festival_permits");
    expect(sql).toContain("festival_edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id)");
    expect(sql).toContain("apply_for_festival_city_permit");
    expect(sql).toContain("get_city_festival_permit_queue");
    expect(sql).toContain("decide_city_festival_permit");
    expect(sql).toContain("cm.city_id=permit.city_id AND profile_id=actor AND is_current");
    expect(sql).toContain("status IN ('pending','approved','rejected','revoked')");
  });

  it("uses the law effective for the Festival date rather than the current wall-clock law", () => {
    expect(sql).toContain("effective_at := edition.starts_on::timestamptz");
    expect(sql).toContain("effective_from <= effective_at");
    expect(sql).toContain("effective_until IS NULL OR effective_until > effective_at");
    expect(sql).toContain("festival_permit_required");
  });

  it("enforces the approved permit on the launch table itself", () => {
    expect(sql).toContain("enforce_city_festival_permit_on_launch");
    expect(sql).toContain("BEFORE INSERT OR UPDATE OF launch_status ON public.festival_launches");
    expect(sql).toContain("FROM public.festival_timetable_plans tp");
    expect(sql).toContain("tp.festival_edition_id");
    expect(sql).toContain("p.status='approved'");
    expect(sql).toContain("festival_city_permit_required");
  });
});
