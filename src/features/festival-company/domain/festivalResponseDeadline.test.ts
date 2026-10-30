import { describe, expect, it } from "vitest";
import {
  earliestFestivalStartBoundary,
  suggestedFestivalResponseDeadline,
  validateFestivalResponseDeadline,
} from "./festivalResponseDeadline";

const now = Date.parse("2026-11-01T12:00:00Z");
const dates = ["2026-11-12", "2026-11-10", "2026-11-11"];

describe("festival artist invitation and offer response deadlines", () => {
  it("uses the earliest real festival day, regardless of input order", () => {
    expect(earliestFestivalStartBoundary(dates)).toBe(Date.parse("2026-11-09T10:00:00Z"));
  });

  it("suggests a real future deadline before the earliest possible local festival opening", () => {
    const suggested = suggestedFestivalResponseDeadline(dates, now);
    expect(suggested).not.toBeNull();
    expect(Date.parse(suggested!)).toBeLessThan(earliestFestivalStartBoundary(dates)!);
    expect(Date.parse(suggested!)).toBeGreaterThan(now);
    expect(validateFestivalResponseDeadline(suggested!, dates, now)).toBe(suggested);
  });

  it("does not manufacture a response deadline when the festival has already started", () => {
    const eventStart = earliestFestivalStartBoundary(dates)!;
    expect(suggestedFestivalResponseDeadline(dates, eventStart)).toBeNull();
    expect(suggestedFestivalResponseDeadline(dates, eventStart - 60_000)).toBeNull();
    expect(validateFestivalResponseDeadline("2026-11-11T09:00:00Z", dates, now)).toBeNull();
  });

  it("rejects stale, blank, malformed and event-overlapping values instead of silently replacing them", () => {
    expect(validateFestivalResponseDeadline("", dates, now)).toBeNull();
    expect(validateFestivalResponseDeadline("not-a-date", dates, now)).toBeNull();
    expect(validateFestivalResponseDeadline("2026-10-29T15:00:00Z", dates, now)).toBeNull();
    expect(validateFestivalResponseDeadline("2026-11-09T10:00:00Z", dates, now)).toBeNull();
    expect(validateFestivalResponseDeadline("2026-11-10T12:00:00Z", dates, now)).toBeNull();
  });

  it("rejects unknown and invalid calendar dates", () => {
    expect(suggestedFestivalResponseDeadline([], now)).toBeNull();
    expect(earliestFestivalStartBoundary(["2026-02-30", "invalid"])).toBeNull();
    expect(validateFestivalResponseDeadline("2026-11-07T10:00:00Z", [], now)).toBeNull();
  });

  it("uses the specified clock rather than a visitor computer's current time", () => {
    const answer = validateFestivalResponseDeadline("2026-11-08T12:00:00Z", dates, now);
    expect(answer).toBe("2026-11-08T12:00:00.000Z");
  });
});
