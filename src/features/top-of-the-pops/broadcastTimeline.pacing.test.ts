import { describe, expect, it } from "vitest";
import { buildTotpPerformanceTimeline } from "./broadcastTimeline";

describe("Top of the Pops broadcast pacing", () => {
  it("keeps performance camera cuts in a television-length cadence", () => {
    const cues = buildTotpPerformanceTimeline({
      artistName: "Shockmaster",
      songTitle: "Test Song",
      chartRank: 7,
      presenterIntro: "Make some noise!",
      stage: "main_stage",
      performanceDurationMs: 187_000,
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
      ],
    });

    const performance = cues.filter((cue) => cue.type === "performance");
    expect(performance.length).toBeGreaterThan(30);
    expect(Math.max(...performance.map((cue) => cue.durationMs))).toBeLessThanOrEqual(5_400);
    expect(Math.min(...performance.map((cue) => cue.durationMs))).toBeGreaterThan(0);
    expect(cues.find((cue) => cue.id === "presenter-intro")?.durationMs).toBe(4_200);
  });

  it("cycles the shot grammar instead of stopping after one pass", () => {
    const cues = buildTotpPerformanceTimeline({
      artistName: "Band",
      songTitle: "Song",
      chartRank: 12,
      presenterIntro: "Here they are!",
      stage: "main_stage",
      performanceDurationMs: 60_000,
      shots: ["studio_master", "lead_close"],
    });
    const performance = cues.filter((cue) => cue.type === "performance");
    expect(performance.length).toBeGreaterThan(2);
    expect(performance[0].cameraShot).toBe("studio_master");
    expect(performance[1].cameraShot).toBe("lead_close");
    expect(performance[2].cameraShot).toBe("studio_master");
  });
});
