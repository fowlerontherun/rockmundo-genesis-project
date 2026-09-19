import { describe, expect, it } from "vitest";
import { buildTotpPerformanceTimeline } from "./broadcastTimeline";
import { activeTotpCaption, buildTotpCaptionCues, toTotpWebVtt } from "./broadcastCaptions";

const cues = buildTotpPerformanceTimeline({
  artistName: "Shockmaster",
  songTitle: "Dead Radio",
  chartRank: 7,
  presenterIntro: "At number seven, Shockmaster!",
  stage: "rock_stage",
  performanceDurationMs: 120_000,
  shots: ["crane_sweep", "lead_close", "finale_wide"],
  trendChange: 4,
});

describe("Top of the Pops captions", () => {
  it("captions the presenter introduction with the presenter name", () => {
    const captions = buildTotpCaptionCues(cues, { presenterName: "Alex Rayne" });
    expect(captions[0]).toMatchObject({ speaker: "Alex Rayne", text: "At number seven, Shockmaster!", startMs: 0 });
  });

  it("describes the chart graphic and the audience reaction", () => {
    const captions = buildTotpCaptionCues(cues);
    expect(captions.some((caption) => caption.text.includes('UK #7 ▲ 4 — Shockmaster, "Dead Radio"'))).toBe(true);
    expect(captions.at(-1)?.text).toContain("studio audience");
  });

  it("resolves the caption showing at a playback position", () => {
    const captions = buildTotpCaptionCues(cues, { presenterName: "Alex Rayne" });
    expect(activeTotpCaption(captions, 1_000)?.speaker).toBe("Alex Rayne");
    expect(activeTotpCaption(captions, 60_000)).toBeNull();
  });

  it("exports a valid WebVTT sidecar", () => {
    const vtt = toTotpWebVtt(buildTotpCaptionCues(cues, { presenterName: "Alex Rayne" }));
    expect(vtt.startsWith("WEBVTT\n")).toBe(true);
    expect(vtt).toContain("00:00:00.000 --> ");
    expect(vtt).toContain("<v Alex Rayne>");
  });
});
