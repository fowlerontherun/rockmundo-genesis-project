import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lineup = readFileSync("src/features/festival-company/ui/SimplifiedFestivalLineupManager.tsx", "utf8");
const news = readFileSync("src/pages/TodaysNews.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20291221100000_festival_next_edition_dates_guard.sql", "utf8");

describe("festival billing and confirmed-band visibility", () => {
  it("supports choosing billing on applications, invitations and confirmed bookings", () => {
    expect(lineup).toContain('billingInputs[`application:${application.id}`]');
    expect(lineup).toContain('billingInputs[`invitation:${invitation.id}`]');
    expect(lineup).toContain("update_festival_booking_billing");
    expect(lineup).toContain("billingPositions.map");
    expect(lineup).toContain("invitedBilling(invitation.message)");
    expect(lineup).toContain("billingInputs[key] ?? invitedBilling(invitation.message)");
    expect(lineup).toContain('queryKey: ["news-festival-band-announcements"]');
  });
  it("loads booked band names independently of the candidate search", () => {
    expect(lineup).toContain('supabase.from("bands").select("id,name")');
    expect(lineup).toContain("knownBands.data?.get(identity.bandId)");
  });
  it("restricts billing changes to authorised organisers before scheduling", () => {
    expect(migration).toContain("_festival_company_manager_authorized");
    expect(migration).toContain("'confirmed','awaiting_schedule'");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.update_festival_booking_billing");
  });
  it("includes confirmed bands in the daily news", () => {
    expect(news).toContain("recent_festival_band_announcements");
    expect(news).toContain("Festival Line-up Announcements");
  });
});
