import { describe, expect, it } from "vitest";
import {
  checkFestivalSlot,
  durationRuleFor,
  localMinutesInTimezone,
} from "../scheduling/timetableRules";

describe("festival timetable rules", () => {
  it("accepts a compliant regular slot", () => {
    const result = checkFestivalSlot({
      localStartMinutes: 13 * 60,
      localEndMinutes: 13 * 60 + 45,
      headline: false,
      performanceDurationMinutes: 45,
    });
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("accepts a compliant headline slot up to the 22:00 curfew", () => {
    const result = checkFestivalSlot({
      localStartMinutes: 20 * 60 + 30,
      localEndMinutes: 22 * 60,
      headline: true,
      performanceDurationMinutes: 90,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects performances starting before 13:00 local time", () => {
    const result = checkFestivalSlot({
      localStartMinutes: 12 * 60,
      localEndMinutes: 12 * 60 + 45,
      headline: false,
    });
    expect(result.violations).toContain("starts_before_window");
  });

  it("rejects performances ending after 22:00 local time", () => {
    const result = checkFestivalSlot({
      localStartMinutes: 21 * 60 + 30,
      localEndMinutes: 22 * 60 + 15,
      headline: false,
    });
    expect(result.violations).toContain("ends_after_window");
  });

  it("enforces the 40-50 minute regular band", () => {
    expect(
      checkFestivalSlot({ localStartMinutes: 840, localEndMinutes: 870, headline: false }).violations,
    ).toContain("duration_below_minimum");
    expect(
      checkFestivalSlot({ localStartMinutes: 840, localEndMinutes: 900, headline: false }).violations,
    ).toContain("duration_above_maximum");
  });

  it("enforces the 60-90 minute headline band", () => {
    expect(durationRuleFor(true)).toEqual({ minMinutes: 60, maxMinutes: 90 });
    expect(
      checkFestivalSlot({ localStartMinutes: 1140, localEndMinutes: 1190, headline: true }).violations,
    ).toContain("duration_below_minimum");
    expect(
      checkFestivalSlot({ localStartMinutes: 1000, localEndMinutes: 1120, headline: true }).violations,
    ).toContain("duration_above_maximum");
  });

  it("requires the booked performance length to match the slot length", () => {
    const result = checkFestivalSlot({
      localStartMinutes: 840,
      localEndMinutes: 885,
      headline: false,
      performanceDurationMinutes: 40,
    });
    expect(result.violations).toEqual(["duration_mismatch"]);
  });

  it("reads local minutes in the festival timezone", () => {
    const instant = new Date("2026-07-18T19:30:00Z");
    expect(localMinutesInTimezone(instant, "UTC")).toBe(19 * 60 + 30);
    expect(localMinutesInTimezone(instant, "Europe/London")).toBe(20 * 60 + 30);
  });
});
