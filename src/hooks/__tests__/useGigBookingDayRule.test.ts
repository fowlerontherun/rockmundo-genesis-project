import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { toLocalDateKey } from "@/hooks/useGigBookingDayRule";

describe("gig booking day rule", () => {
  const databaseSource = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260829125413_gig_day_rules_and_cancellation.sql"),
    "utf8",
  );
  const dialogSource = readFileSync(
    resolve(process.cwd(), "src/components/gig/GigBookingDialog.tsx"),
    "utf8",
  );

  it("keeps the calendar date selected by the player", () => {
    expect(toLocalDateKey(new Date(2030, 0, 9, 23, 30))).toBe("2030-01-09");
  });

  it("serializes bookings and enforces four hours at the database boundary", () => {
    expect(databaseSource).toContain("v_minimum_gap_minutes constant integer := 240");
    expect(databaseSource).toContain("pg_advisory_xact_lock");
    expect(databaseSource).toContain("CREATE TRIGGER enforce_gig_day_rule");
    expect(databaseSource).toContain("CREATE TRIGGER enforce_support_gig_day_rule");
    expect(databaseSource).toContain("support.status IN ('accepted', 'completed')");
    expect(databaseSource).toContain("gig_booking_same_day_different_venue");
    expect(databaseSource).toContain("gig_booking_same_day_gap_too_short");
  });

  it("counts completed same-day shows but ignores cancelled shows", () => {
    expect(databaseSource).toContain("'live', 'completed', 'performed'");
    expect(databaseSource).not.toMatch(/g\.status IN \([^)]*'cancelled'/s);
  });

  it("explains the rule before confirmation and disables blocked bookings", () => {
    expect(dialogSource).toContain("Same-day show rule");
    expect(dialogSource).toContain("at least four full hours");
    expect(dialogSource).toContain("dayRule?.allowed === false");
    expect(dialogSource).toContain("Schedule check unavailable");
  });
});
