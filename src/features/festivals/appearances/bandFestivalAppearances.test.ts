import { describe, expect, it } from "vitest";
import {
  appearanceDetailHref,
  appearanceOnLocalDay,
  festivalAppearanceAsActivity,
  formatFestivalSetTime,
  festivalLocalDateKey,
  isFutureFestivalAppearance,
  parseBandFestivalAppearances,
} from "./bandFestivalAppearances";

const fixture = {
  booking_id: "booking-shock",
  band_id: "band-shockmaster",
  band_name: "Shockmaster",
  edition_id: "edition-2026",
  festival_company_id: "company-shock",
  festival_name: "Shock Festival",
  festival_slug: "shock-festival",
  festival_status: "announced",
  festival_starts_on: "2026-09-26",
  festival_ends_on: "2026-09-27",
  festival_date: "2026-09-26",
  city_name: "London",
  country_name: "United Kingdom",
  venue_timezone: "Europe/London",
  booking_status: "confirmed",
  billing_position: "support",
  set_minutes: 60,
  confirmed_start_at: null,
  confirmed_end_at: null,
  time_confirmed: false,
  stage_name: null,
  session_status: null,
};

describe("band festival appearances", () => {
  it("recognises a confirmed booking before it has a stage or time", () => {
    const [appearance] = parseBandFestivalAppearances([fixture]);
    const activity = festivalAppearanceAsActivity(appearance, "user", "profile");
    expect(activity.activity_type).toBe("festival_performance");
    expect(activity.title).toBe("Festival: Shock Festival");
    expect(activity.metadata?.date_only).toBe(true);
    expect(activity.description).toContain("Set time to be announced");
    expect(activity.linked_gig_id).toBeUndefined();
    expect(appearanceOnLocalDay(appearance, new Date(2026, 8, 26))).toBe(true);
    expect(appearanceOnLocalDay(appearance, new Date(2026, 8, 27))).toBe(false);
    expect(appearanceDetailHref(appearance)).toBe("/world/festivals/shock-festival/editions/edition-2026");
  });

  it("uses authoritative slot timestamps when the set has been assigned", () => {
    const [appearance] = parseBandFestivalAppearances([{
      ...fixture,
      confirmed_start_at: "2026-09-26T18:00:00+00:00",
      confirmed_end_at: "2026-09-26T19:00:00+00:00",
      stage_name: "Main Stage",
      time_confirmed: true,
      session_status: "in_progress",
    }]);
    const activity = festivalAppearanceAsActivity(appearance, "user", "profile");
    expect(activity.metadata?.date_only).toBe(false);
    expect(activity.scheduled_start).toBe("2026-09-26T18:00:00.000Z");
    expect(activity.scheduled_end).toBe("2026-09-26T19:00:00.000Z");
    expect(activity.status).toBe("in_progress");
    expect(activity.description).toContain("Main Stage");
    expect(formatFestivalSetTime(appearance)).toMatch(/7:00\s*pm–8:00\s*pm/i);
  });

  it("uses the Festival city's date even while the player is in another timezone", () => {
    const [appearance] = parseBandFestivalAppearances([fixture]);
    const londonAfterMidnight = new Date("2026-09-26T23:30:00Z");
    expect(festivalLocalDateKey(londonAfterMidnight, appearance.venueTimezone))
      .toBe("2026-09-27");
    expect(isFutureFestivalAppearance(appearance, londonAfterMidnight)).toBe(false);
  });

  it("deduplicates projection retries by booking, not by band or festival", () => {
    const result = parseBandFestivalAppearances([
      fixture, fixture, { ...fixture, booking_id: "another-set" },
    ]);
    expect(result.map((x) => x.bookingId)).toEqual(["booking-shock", "another-set"]);
  });

  it("shows previous festivals as history without dropping today's appearance", () => {
    const [appearance] = parseBandFestivalAppearances([fixture]);
    // Assertions use UTC instants; local JS constructors would inherit the
    // CI runner's timezone and flip the expectation during BST.
    expect(isFutureFestivalAppearance(appearance, new Date("2026-09-26T12:00:00Z"))).toBe(true);
    expect(isFutureFestivalAppearance(appearance, new Date("2026-09-26T23:30:00Z"))).toBe(false);
  });

  it("does not turn an early annual-result posting into a completed band performance", () => {
    const [appearance] = parseBandFestivalAppearances([
      { ...fixture, festival_status: "completed" },
    ]);
    expect(festivalAppearanceAsActivity(appearance, "user", "profile", new Date(2026, 8, 26)).status)
      .toBe("scheduled");
    expect(festivalAppearanceAsActivity(appearance, "user", "profile", new Date(2026, 8, 28)).status)
      .toBe("completed");
  });

  it("rejects malformed or incomplete projections rather than adding false gigs", () => {
    expect(() => parseBandFestivalAppearances({})).toThrow();
    expect(() => parseBandFestivalAppearances([{ ...fixture, festival_date: null }])).toThrow();
  });
});
