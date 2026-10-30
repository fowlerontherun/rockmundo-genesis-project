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

  it("closes admission at the exact published end instant, not one millisecond later", () => {
    expect(getFestivalPublicEventPhase(start, end, Date.parse(end) - 1)).toBe("in_progress");
    expect(getFestivalPublicEventPhase(start, end, Date.parse(end))).toBe("dates_ended");
  });

  it("respects offset timestamps across UK DST and local festival midnight", () => {
    const open = "2026-10-25T00:00:00+01:00";
    const close = "2026-10-25T23:00:00+00:00";
    expect(getFestivalPublicEventPhase(open, close, Date.parse("2026-10-24T22:59:59Z"))).toBe("upcoming");
    expect(getFestivalPublicEventPhase(open, close, Date.parse("2026-10-25T22:59:59Z"))).toBe("in_progress");
    expect(getFestivalPublicEventPhase(open, close, Date.parse("2026-10-25T23:00:00Z"))).toBe("dates_ended");
  });

    it("handles invalid input conservatively", () => {
    expect(getFestivalPublicEventPhase("invalid", end)).toBe("dates_ended");
    expect(getFestivalPublicEventPhase(start, start)).toBe("dates_ended");
  });
});
