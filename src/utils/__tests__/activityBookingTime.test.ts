import { describe, expect, it } from "vitest";
import {
  buildScheduledDateTime,
  addDurationHours,
  getDisplayDurationMinutes,
  formatDurationMinutes,
  validateBookingWindow,
} from "../activityBookingTime";

describe("activity booking time helpers", () => {
  it("builds local scheduled times and adds multi-hour durations", () => {
    const start = buildScheduledDateTime(new Date("2026-07-10T00:00:00.000Z"), 14);
    const end = addDurationHours(start, 4);

    expect(start.getHours()).toBe(14);
    expect(getDisplayDurationMinutes({ scheduled_start: start.toISOString(), scheduled_end: end.toISOString(), duration_minutes: 60 })).toBe(240);
  });

  it("formats hour and partial-hour durations", () => {
    expect(formatDurationMinutes(60)).toBe("1h");
    expect(formatDurationMinutes(120)).toBe("2h");
    expect(formatDurationMinutes(90)).toBe("1h 30m");
  });

  it("blocks past starts and allows future starts", () => {
    const now = new Date("2026-07-09T12:00:00.000Z");
    expect(validateBookingWindow(new Date("2026-07-09T11:00:00.000Z"), new Date("2026-07-09T12:00:00.000Z"), now)).toContain("future time");
    expect(validateBookingWindow(new Date("2026-07-10T11:00:00.000Z"), new Date("2026-07-10T15:00:00.000Z"), now)).toBeNull();
  });
});
