import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const overview = source("src/features/festivals/ui/FestivalEditionSections.tsx");
const card = source("src/features/festivals/publication/FestivalPublicationCard.tsx");
const repository = source("src/features/festivals/publication/simplifiedFestivalPublication.ts");
const migration = source("supabase/migrations/20260907092136_publish_simplified_festival_before_event_day.sql");

describe("simplified Festival publication experience", () => {
  it("exposes publication directly from the annual Festival Plan", () => {
    expect(overview).toContain("FestivalPublicationCard");
    expect(card).toContain("Publish Festival & open tickets");
    expect(card).toContain("View public Festival");
    expect(card).toContain("Festival directory");
  });

  it("uses one authoritative publication RPC rather than chaining client launch mutations", () => {
    expect(repository).toContain('publicationRpc("publish_simplified_festival"');
    expect(card).toContain("publishSimplifiedFestival");
    expect(card).not.toContain("beginFestivalLaunchReview");
    expect(card).not.toContain("launchFestival");
    expect(card).not.toContain("openFestivalTicketSales");
  });

  it("requires a genuinely ready simplified edition before opening public sales", () => {
    expect(migration).toContain("v_edition.planning_status");
    expect(migration).toContain("v_edition.readiness_score");
    expect(migration).toContain("public.festival_site_plan_stages");
    expect(migration).toContain("product.product_class = 'admission'");
    expect(migration).toContain("public.festival_artist_bookings");
    expect(migration).toContain("launch_status = 'tickets_on_sale'");
    expect(migration).toContain("public_visibility = 'public'");
  });

  it("publishes before Festival Day without running or completing the annual event", () => {
    expect(migration).not.toContain("run_simplified_festival_edition");
    expect(migration).not.toContain("SET status = 'completed'");
    expect(migration).not.toContain("completed_at = now()");
    expect(card).toContain("Running the Festival itself still waits until the scheduled date.");
  });
});
