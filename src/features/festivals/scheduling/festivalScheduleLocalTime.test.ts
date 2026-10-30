import { describe, expect, it } from "vitest";
import {
  festivalScheduleLocalClock,
  festivalScheduleLocalHour,
  festivalScheduleTimezoneLabel,
} from "./festivalScheduleLocalTime";

describe("canonical festival owner schedule time display", () => {
  it("renders offset-aware instants in the edition timezone instead of the viewer timezone", () => {
    const instant = "2030-06-01T18:00:00Z";
    expect(festivalScheduleLocalClock(instant, "Europe/London")).toBe("19:00");
    expect(festivalScheduleLocalHour(instant, "Europe/London")).toBe(19);
    expect(festivalScheduleLocalClock(instant, "America/Los_Angeles")).toBe("11:00");
  });

  it("handles a UK DST boundary without moving a stage into the wrong timeline row", () => {
    expect(festivalScheduleLocalHour("2026-10-25T00:30:00Z", "Europe/London")).toBe(1);
    expect(festivalScheduleLocalHour("2026-10-25T02:30:00Z", "Europe/London")).toBe(2);
    expect(festivalScheduleLocalClock("2026-03-29T01:30:00Z", "Europe/London")).toBe("02:30");
  });

  it("preserves a published local-only wall time instead of interpreting it in the browser zone", () => {
    expect(festivalScheduleLocalClock("2030-06-01T18:15:00", "America/Los_Angeles")).toBe("18:15");
    expect(festivalScheduleLocalHour("2030-06-01T18:15", "Europe/London")).toBe(18);
  });

  it("fails closed on invalid dates and explicitly labels fallback to UTC", () => {
    expect(festivalScheduleLocalClock(null, "Europe/London")).toBe("unscheduled");
    expect(festivalScheduleLocalClock("invalid", "Europe/London")).toBe("unscheduled");
    expect(festivalScheduleLocalClock("2030-02-30T18:15", "Europe/London")).toBe("unscheduled");
    expect(festivalScheduleLocalHour("2030-06-01T25:00", "Europe/London")).toBeNull();
    expect(festivalScheduleLocalClock("2030-06-01T18:00:00Z", "Bad/Zone")).toBe("18:00");
    expect(festivalScheduleTimezoneLabel("Bad/Zone")).toContain("UTC");
    expect(festivalScheduleTimezoneLabel("Europe/London")).toBe("Europe/London");
  });
});
