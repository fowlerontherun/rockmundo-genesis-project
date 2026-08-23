import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20291218250500_repair_festival_edition_lineup_contract.sql",
  "utf8",
);
const overlay = readFileSync(
  "supabase/reconciliation/festival/20260823_festival_edition_lineup_contract.sql",
  "utf8",
);
const workflow = readFileSync(
  "src/features/festival-company/ui/FestivalLineupWorkflowManager.tsx",
  "utf8",
);

describe("exact-edition Festival line-up contract", () => {
  it("ships the exact-edition save RPC with production-real authority", () => {
    expect(migration).toContain("save_festival_edition_artist_programme");
    expect(migration).toContain("_festival_company_manager_authorized");
    expect(migration).not.toContain("_festival_projection_authorized");
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.save_festival_edition_artist_programme\([\s\S]*TO authenticated,service_role/i,
    );
  });

  it("returns persisted workflow rows rather than hard-coded empty arrays", () => {
    for (const table of [
      "festival_artist_applications",
      "festival_artist_invitations",
      "festival_artist_offers",
      "festival_artist_bookings",
    ]) {
      expect(migration).toContain(`public.${table}`);
    }
    expect(migration).not.toMatch(/'applications'\s*,\s*'\[\]'::jsonb/);
    expect(migration).not.toMatch(/'invitations'\s*,\s*'\[\]'::jsonb/);
    expect(migration).not.toMatch(/'offers'\s*,\s*'\[\]'::jsonb/);
    expect(migration).not.toMatch(/'bookings'\s*,\s*'\[\]'::jsonb/);
  });

  it("requires one confirmed booking before line-up completion", () => {
    expect(migration).toContain("festival_lineup_requires_confirmed_act");
    expect(migration).toMatch(/p_complete AND active_bookings=0/i);
    expect(migration).toContain("festival_artist_programme_incomplete");
    expect(migration).toMatch(
      /ready[^\n]*programme_status='ready_for_operations' AND bt\.active_bookings>0/i,
    );
  });

  it("keeps the production overlay aligned with the canonical repair", () => {
    for (const token of [
      "festival_lineup_requires_confirmed_act",
      "festival_artist_programme_incomplete",
      "festival_artist_bookings",
      "_festival_company_manager_authorized",
    ]) {
      expect(overlay).toContain(token);
    }
  });

  it("explains that only one confirmed act is needed before NPC fallback", () => {
    expect(workflow).toContain("Confirm at least one act");
    expect(workflow).toContain("remaining Festival slots with suitable NPC acts");
  });
});
