import { describe, expect, it } from "vitest";
import { getFestivalPublicEventPhase } from "./festivalEventPhase";

describe("getFestivalPublicEventPhase", () => {
  const start = "2026-09-26T00:00:00Z";
  const end = "2026-09-27T23:00:00Z";

  it("shows upcoming before the first day", () => {
    expect(getFestivalPublicEventPhase(start, end, Date.parse("2026-09-25T20:00:00Z"))).toBe("upcoming");
  });

  it("shows dates under way throughout a multi-day Festival", () => {
    expect(getFestivalPublicEventPhase(start, end, Date.parse("2026-09-26T06:02:25Z"))).toBe("in_progress");
    expect(getFestivalPublicEventPhase(start, end, Date.parse("2026-09-27T20:00:00Z"))).toBe("in_progress");
  });

  it("only marks dates ended after the published end", () => {
    expect(getFestivalPublicEventPhase(start, end, Date.parse("2026-09-27T23:00:01Z"))).toBe("dates_ended");
  });

  it("handles invalid input conservatively", () => {
    expect(getFestivalPublicEventPhase("invalid", end)).toBe("upcoming");
  });
});
