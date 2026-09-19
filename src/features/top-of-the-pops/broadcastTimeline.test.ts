import { describe, expect, it } from "vitest";
import {
  buildTotpMusicalSections,
  buildTotpPerformanceTimeline,
  formatTotpChartGraphic,
} from "./broadcastTimeline";

const input = {
  artistName: "Shockmaster",
  songTitle: "Dead Radio",
  chartRank: 7,
  presenterIntro: "At number seven, Shockmaster!",
  stage: "rock_stage" as const,
  performanceDurationMs: 180_000,
  shots: [
    "crane_sweep",
    "lead_close",
    "instrument_close",
    "side_tracking",
    "drummer_close",
    "audience_reverse",
    "low_angle",
    "push_in",
    "studio_master",
    "finale_wide",
  ] as const,
};

describe("Top of the Pops broadcast timeline", () => {
  it("starts with a presenter introduction and ends with applause", () => {
    const cues = buildTotpPerformanceTimeline(input);
    expect(cues[0].id).toBe("presenter-intro");
    expect(cues.at(-1)?.id).toBe("applause");
    expect(cues.find((cue) => cue.id === "lower-third")?.graphic?.songTitle).toBe("Dead Radio");
  });

  it("maps the whole performance into deterministic musical sections", () => {
    const sections = buildTotpMusicalSections(180_000);
    expect(sections.map((item) => item.section)).toEqual([
      "intro",
      "verse_1",
      "chorus_1",
      "verse_2",
      "chorus_2",
      "bridge",
      "finale",
    ]);
    expect(sections.reduce((total, item) => total + item.durationMs, 0)).toBe(180_000);
    expect(buildTotpMusicalSections(180_000)).toEqual(sections);
  });

  it("cuts continuously without repeating the same shot back-to-back", () => {
    const cues = buildTotpPerformanceTimeline(input);
    const performance = cues.filter((cue) => cue.type === "performance");

    expect(performance[0].offsetMs).toBe(4_200);
    for (let index = 1; index < performance.length; index += 1) {
      expect(performance[index].offsetMs).toBe(
        performance[index - 1].offsetMs + performance[index - 1].durationMs,
      );
      expect(performance[index].cameraShot).not.toBe(performance[index - 1].cameraShot);
    }
    expect(performance.reduce((total, cue) => total + cue.durationMs, 0)).toBe(180_000);
    expect(performance.at(-1)?.cameraShot).toBe("finale_wide");
  });

  it("does not run more than two close-ups in succession", () => {
    const close = new Set(["presenter_close", "lead_close", "instrument_close", "drummer_close"]);
    const performance = buildTotpPerformanceTimeline(input).filter((cue) => cue.type === "performance");
    let streak = 0;
    let longest = 0;
    for (const cue of performance) {
      streak = close.has(cue.cameraShot) ? streak + 1 : 0;
      longest = Math.max(longest, streak);
    }
    expect(longest).toBeLessThanOrEqual(2);
  });

  it("produces the same direction plan from the same locked inputs", () => {
    expect(buildTotpPerformanceTimeline(input)).toEqual(buildTotpPerformanceTimeline(input));
  });

  it("formats chart movement without affecting gameplay data", () => {
    expect(formatTotpChartGraphic({ artistName: "A", songTitle: "B", chartRank: 4, trendChange: 5 })).toBe("#4 ▲ 5");
    expect(formatTotpChartGraphic({ artistName: "A", songTitle: "B", chartRank: 12, debut: true })).toBe("#12 NEW");
  });
});
