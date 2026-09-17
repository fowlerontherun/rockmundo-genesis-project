import { describe, expect, it } from "vitest";
import { buildTotpPerformanceTimeline, formatTotpChartGraphic } from "./broadcastTimeline";

describe("Top of the Pops broadcast timeline", () => {
  it("starts with a presenter introduction and ends with applause", () => {
    const cues = buildTotpPerformanceTimeline({
      artistName: "Shockmaster",
      songTitle: "Dead Radio",
      chartRank: 7,
      presenterIntro: "At number seven, Shockmaster!",
      stage: "rock_stage",
      performanceDurationMs: 180_000,
      shots: ["crane_sweep", "lead_close", "instrument_close", "finale_wide"],
    });
    expect(cues[0].id).toBe("presenter-intro");
    expect(cues.at(-1)?.id).toBe("applause");
    expect(cues.find((cue) => cue.id === "lower-third")?.graphic?.songTitle).toBe("Dead Radio");
  });

  it("formats chart movement without affecting gameplay data", () => {
    expect(formatTotpChartGraphic({ artistName: "A", songTitle: "B", chartRank: 4, trendChange: 5 })).toBe("#4 ▲ 5");
    expect(formatTotpChartGraphic({ artistName: "A", songTitle: "B", chartRank: 12, debut: true })).toBe("#12 NEW");
  });
});
