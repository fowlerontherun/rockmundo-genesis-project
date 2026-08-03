import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20291218245500_festival_edition_internal_projections.sql",
  "utf8",
);
const repository = readFileSync(
  "src/features/festivals/projections/repository.ts",
  "utf8",
);
const sections = readFileSync(
  "src/features/festivals/ui/FestivalEditionSections.tsx",
  "utf8",
);

describe("annual Festival internal projection SQL", () => {
  it("removes obsolete company-wide uniqueness while retaining edition identity", () => {
    expect(migration).toContain(
      "DROP CONSTRAINT IF EXISTS festival_site_plans_festival_company_id_key",
    );
    expect(migration).toContain(
      "DROP CONSTRAINT IF EXISTS festival_ticket_plans_festival_company_id_key",
    );
    expect(migration).toContain(
      "DROP CONSTRAINT IF EXISTS festival_artist_programmes_festival_company_id_key",
    );
    expect(migration).toMatch(
      /ON CONFLICT \(festival_edition_id\) WHERE festival_edition_id IS NOT NULL/i,
    );
  });

  it("materialises only complete exact annual editions", () => {
    expect(migration).toContain("materialize_festival_edition_foundations");
    expect(migration).toMatch(
      /WHERE id = p_festival_edition_id[\s\S]*festival_company_id = p_festival_company_id/i,
    );
    expect(migration).toMatch(/edition\.starts_on IS NULL/i);
    expect(migration).toMatch(/coalesce\(edition\.expected_capacity, 0\) <= 0/i);
  });

  it("preserves manual plans and marks generated rows explicitly", () => {
    expect(migration).toContain("projection_source");
    expect(migration).toMatch(
      /WHERE public\.festival_site_plans\.projection_source = 'annual_plan'/i,
    );
    expect(migration).toMatch(
      /WHERE public\.festival_ticket_plans\.projection_source = 'annual_plan'/i,
    );
  });

  it("refreshes hidden projections without consuming player-facing versions", () => {
    expect(migration).toContain(
      "planning_version = public.festival_site_plans.planning_version,",
    );
    expect(migration).toContain(
      "planning_version = public.festival_ticket_plans.planning_version,",
    );
    expect(migration).not.toContain(
      "planning_version = public.festival_site_plans.planning_version + 1",
    );
    expect(migration).not.toContain(
      "planning_version = public.festival_ticket_plans.planning_version + 1",
    );
    expect(migration).toMatch(
      /UPDATE public\.festival_ticket_plans[\s\S]*planning_version = planning_version \+ 1/i,
    );
    expect(migration).toMatch(
      /ON CONFLICT \(festival_edition_id\)[\s\S]*planning_version = public\.festival_artist_programmes\.planning_version \+ 1/i,
    );
  });

  it("uses one stable non-reserved application-window alias", () => {
    expect(migration).toContain(
      "festival_artist_application_windows application_window",
    );
    expect(migration).toContain("application_window_payload");
    expect(migration).not.toContain("application_application");
    expect(migration).not.toMatch(
      /festival_artist_application_windows\s+window\b/i,
    );
  });

  it("generates the hidden site, stages, standard ticket and forecast", () => {
    for (const table of [
      "festival_site_plans",
      "festival_site_plan_stages",
      "festival_ticket_plans",
      "festival_ticket_products",
      "festival_ticket_release_phases",
      "festival_ticket_capacity_allocations",
    ]) {
      expect(migration).toContain(`public.${table}`);
    }
    expect(migration).toContain("standard-festival-ticket");
    expect(migration).toContain("_festival_projection_forecast");
  });

  it("provides exact-edition ticket and line-up owner boundaries", () => {
    for (const rpc of [
      "get_festival_edition_site_plan",
      "get_festival_edition_ticket_plan",
      "save_festival_edition_ticket_plan",
      "get_festival_edition_artist_programme",
      "save_festival_edition_artist_programme",
    ]) {
      expect(migration).toContain(rpc);
      expect(repository).toContain(rpc);
    }
    expect(migration).toMatch(/festival_ticket_plan_stale/i);
    expect(migration).toMatch(/festival_artist_programme_stale/i);
    expect(migration).toContain("festival_ticket_plan_idempotency_conflict");
    expect(migration).toContain("festival_artist_idempotency_conflict");
  });

  it("keeps internal helpers private and public RPCs authenticated only", () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.materialize_festival_edition_foundations\(uuid, uuid\) FROM PUBLIC, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.get_festival_edition_ticket_plan\(uuid, uuid\) FROM PUBLIC, anon/i,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_festival_edition_ticket_plan\(uuid, uuid\) TO authenticated/i,
    );
  });
});

describe("canonical Festival edition screens", () => {
  it("passes the selected annual edition to tickets and line-up", () => {
    expect(sections).toMatch(
      /FestivalTicketPlanner[\s\S]*festivalEditionId=\{editionId\}/,
    );
    expect(sections).toMatch(
      /FestivalArtistPlanner[\s\S]*festivalEditionId=\{editionId\}/,
    );
  });
});
