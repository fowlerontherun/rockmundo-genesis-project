import { describe, expect, it } from "vitest";
import {
  canDisplayFestivalCheckInMessage,
  festivalVisitorSalesLabel,
  formatFestivalEditionDate,
  hasIssuedFestivalAdmission,
  isPublishedFestivalPerformance,
} from "../festivalPublicDisplay";

describe("public festival visitor facts", () => {
  it("#3960 suppresses positive and negative stale check-in messages when verification fails", () => {
    expect(canDisplayFestivalCheckInMessage(true, false, false)).toBe(true);
    expect(canDisplayFestivalCheckInMessage(true, true, false)).toBe(false);
    expect(canDisplayFestivalCheckInMessage(true, false, true)).toBe(false);
    expect(canDisplayFestivalCheckInMessage(false, false, false)).toBe(false);
  });

  it("#3961 only describes stage-assigned confirmed performances as published", () => {
    expect(isPublishedFestivalPerformance({ startsAt: "2026-10-14T10:00:00Z", endsAt: "2026-10-14T11:00:00Z", stageName: "Main Stage" })).toBe(true);
    expect(isPublishedFestivalPerformance({ startsAt: "2026-10-14T10:00:00Z", endsAt: "2026-10-14T11:00:00Z", stageName: null })).toBe(false);
    expect(isPublishedFestivalPerformance({ startsAt: "2026-10-14T10:00:00Z", endsAt: null, stageName: "Main" })).toBe(false);
    expect(isPublishedFestivalPerformance({ startsAt: null, endsAt: "2026-10-14T11:00:00Z", stageName: "Main" })).toBe(false);
    expect(isPublishedFestivalPerformance({ startsAt: "2026-10-14T10:00:00Z", endsAt: "2026-10-14T11:00:00Z", stageName: "  " })).toBe(false);
  });

  it("#3962 recognises already-used admission as evidence of a checked-in ticket", () => {
    expect(hasIssuedFestivalAdmission([{ productClass: "admission", status: "used" }])).toBe(true);
    expect(hasIssuedFestivalAdmission([{ productClass: "admission", status: "valid" }])).toBe(true);
    for (const status of ["cancelled", "transferred", "refunded"] as const) {
      expect(hasIssuedFestivalAdmission([{ productClass: "admission", status }])).toBe(false);
    }
    expect(hasIssuedFestivalAdmission([{ productClass: "add_on", status: "valid" }])).toBe(false);
    expect(hasIssuedFestivalAdmission([])).toBe(false);
  });

  it("#3963 never advertises on-sale tickets after the festival end instant", () => {
    expect(festivalVisitorSalesLabel("dates_ended", "tickets_on_sale")).toBe("Festival ended");
    expect(festivalVisitorSalesLabel("in_progress", "tickets_on_sale")).toBe("On sale");
    expect(festivalVisitorSalesLabel("upcoming", "sales_paused")).toBe("Not currently on sale");
  });

  it("#3964 renders the edition's calendar day, not the visitor's local day", () => {
    const instant = "2026-10-14T00:30:00.000Z";
    expect(formatFestivalEditionDate(instant, "America/Los_Angeles")).toBe("13 October 2026");
    expect(formatFestivalEditionDate(instant, "Asia/Tokyo")).toBe("14 October 2026");
    expect(formatFestivalEditionDate(instant, "Invalid/Zone")).toBe("14 October 2026");
    expect(formatFestivalEditionDate("not-a-date", "Europe/London")).toBe("Date to be confirmed");
  });
});
