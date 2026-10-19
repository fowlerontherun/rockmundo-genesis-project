import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { formatBotbCityDate } from "@/lib/botbDates";

const migration = readFileSync("supabase/migrations/20261019090500_botb_city_local_weekday_scheduling.sql", "utf8");

describe("City-local Battle of the Bands scheduling", () => {
  it("shows the city's Friday despite the event being on Saturday UTC", () => {
    // Winter: Friday 19:00 in New York is Saturday 00:00 UTC.
    expect(formatBotbCityDate("2026-11-07T00:00:00Z", "America/New_York")).toContain("Fri");
    expect(formatBotbCityDate("2026-11-07T00:00:00Z", "America/New_York")).toContain("6 Nov");
  });

  it("shows correct dates for London daylight saving and Tokyo", () => {
    expect(formatBotbCityDate("2026-10-23T18:00:00Z", "Europe/London")).toContain("Fri");
    expect(formatBotbCityDate("2026-10-23T10:00:00Z", "Asia/Tokyo")).toContain("23 Oct");
    expect(formatBotbCityDate("2026-10-23T10:00:00Z", "Asia/Tokyo", "long")).toContain("Friday");
  });

  it("handles absent or invalid IANA city timezone safely", () => {
    expect(formatBotbCityDate("2026-10-23T19:00:00Z", null)).toContain("Fri");
    expect(formatBotbCityDate("2026-10-23T19:00:00Z", "Invalid/Timezone")).toContain("Fri");
  });

  it("generates only future local 7pm dates and preserves entered events", () => {
    expect(migration).toContain("AT TIME ZONE v_city.city_timezone");
    expect(migration).toContain("interval '19 hours'");
    expect(migration).toContain("v_date <= now()");
    expect(migration).toContain("NOT EXISTS(SELECT 1 FROM public.botb_entries");
    expect(migration).toContain("FOR UPDATE");
  });
});
