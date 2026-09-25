import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("public Festival visibility", () => {
  const directory = source("src/features/festival-company/ui/PublicFestivalDirectory.tsx");
  const publicPage = source("src/features/festival-company/ui/PublicFestivalPage.tsx");
  const scheduleBridge = source(
    "supabase/migrations/20260907082308_repair_festival_attendee_stage_schedule_bridge.sql",
  );

  it("previews announced artist names in the world Festival directory", () => {
    expect(directory).toContain("Announced line-up");
    expect(directory).toContain("entry.artistName");
    expect(directory).toContain("announcedArtists.length");
  });

  it("keeps a dedicated public line-up view on the Festival page", () => {
    expect(publicPage).toContain('value="lineup"');
    expect(publicPage).toContain("entry.artistName");
  });

  const previewMigration = source("supabase/migrations/20291220103000_public_festival_pre_event_lineup_sales.sql");
  const launchHooks = source("src/features/festival-company/application/useFestivalLaunch.ts");

  it("exposes true paid admission counts before festival day", () => {
    expect(previewMigration).toContain("'admissionTicketsSold'");
    expect(previewMigration).toContain("public.festival_ticket_sales");
    expect(previewMigration).toContain("product.product_class = 'admission'");
    expect(previewMigration).toContain("sale.status = 'completed'");
    expect(publicPage).toContain("Ticket sales so far");
    expect(directory).toContain("festival.ticketSales.admissionTicketsSold");
  });

  it("lists every confirmed booking without claiming provisional slots are public", () => {
    expect(previewMigration).toContain("b.status IN ('confirmed', 'awaiting_schedule', 'scheduled')");
    expect(previewMigration).toContain("slot.public_status IN ('published', 'public')");
    expect(previewMigration).toContain("'lineup'");
    expect(publicPage).toContain("confirmedLineup");
    expect(publicPage).toContain("Stage to be announced");
    expect(publicPage).toContain("publishedPerformances");
  });

  it("refreshes ticket sale counts after purchases", () => {
    expect(launchHooks).toContain('c.invalidateQueries({queryKey:["public-festival"]})');
    expect(launchHooks).toContain('c.invalidateQueries({queryKey:["festival-directory"]})');
  });

  it("projects confirmed simplified bookings into the public schedule bridge", () => {
    expect(scheduleBridge).toContain("festival_artist_bookings");
    expect(scheduleBridge).toContain("Confirmed act");
    expect(scheduleBridge).toContain("b.status NOT IN ('cancelled','withdrawn','artist_withdrawn','festival_cancelled')");
  });
});
