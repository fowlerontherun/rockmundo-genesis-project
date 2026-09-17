import { describe, expect, it } from "vitest";
import type { TotpTestPreviewPerformance } from "./testPreviewApi";
import {
  buildTotpTestReplay,
  buildTotpTestRewardPreview,
  combineTotpTestEffects,
  getTotpTestIncident,
  getTotpTestInterviewEffects,
  getTotpTestPostShowEffects,
  getTotpTestRecoveryEffects,
  getTotpTestStyleOutcome,
  totpRawFameForRank,
} from "./testLifecycle";

const performance: TotpTestPreviewPerformance = {
  running_order: 2,
  band_id: "11111111-1111-4111-8111-111111111111",
  band_name: "Test Band",
  song_id: "22222222-2222-4222-8222-222222222222",
  song_title: "Test Song",
  genre: "Rock",
  qualifying_rank: 7,
  qualifying_chart: "streaming",
  selection_bucket: "top10",
  stage_key: "rock_stage",
  presenter_intro: "At number 7 this week, please welcome Test Band performing Test Song!",
};

describe("Top of the Pops accelerated test lifecycle", () => {
  it("keeps the virtual incident deterministic for the same seed and act", () => {
    expect(getTotpTestIncident("admin-test", performance)).toEqual(getTotpTestIncident("admin-test", performance));
  });

  it("mirrors the production interview effect values", () => {
    expect(getTotpTestInterviewEffects("confident")).toEqual({
      reputation: 1,
      fan_sentiment: 0.5,
      media_intensity: 2,
      audience_reaction: 0,
    });
    expect(getTotpTestInterviewEffects("humble").fan_sentiment).toBe(2);
    expect(getTotpTestInterviewEffects("cheeky").media_intensity).toBe(3);
  });

  it("mirrors production recovery and post-show effect values", () => {
    expect(getTotpTestRecoveryEffects("broken_string", "showman")).toEqual({
      reputation: 0,
      fan_sentiment: 0.5,
      media_intensity: 1.5,
      audience_reaction: 3,
    });
    expect(getTotpTestPostShowEffects("fans").fan_sentiment).toBe(2);
  });

  it("uses the production rank-base fame table", () => {
    expect(totpRawFameForRank(1)).toBe(1000);
    expect(totpRawFameForRank(3)).toBe(800);
    expect(totpRawFameForRank(10)).toBe(600);
    expect(totpRawFameForRank(20)).toBe(400);
    expect(totpRawFameForRank(30)).toBe(250);
    expect(totpRawFameForRank(40)).toBe(150);
  });

  it("applies the chosen production style multiplier to the rank-base preview", () => {
    const polished = getTotpTestStyleOutcome("admin-test", performance, "polished");
    expect(polished?.fame_multiplier).toBe(1.03);
    expect(buildTotpTestRewardPreview(7, polished?.fame_multiplier ?? 1)).toEqual({
      rank_base_fame: 600,
      style_multiplier: 1.03,
      style_adjusted_rank_base_fame: 618,
    });
  });

  it("caps combined audience reaction to the canonical replay range", () => {
    const combined = combineTotpTestEffects(
      { reputation: 0, fan_sentiment: 0, media_intensity: 0, audience_reaction: 8 },
      { reputation: 0, fan_sentiment: 0, media_intensity: 0, audience_reaction: 8 },
    );
    expect(combined.audience_reaction).toBe(10);
  });

  it("builds a temporary TOTP replay for the real 3D broadcast canvas", () => {
    const replay = buildTotpTestReplay(performance, "admin-test", "2026-09-17T20:30:00.000Z", 4);
    expect(replay.stage_key).toBe("rock_stage");
    expect(replay.payload.band.name).toBe("Test Band");
    expect(replay.payload.song.title).toBe("Test Song");
    expect(replay.payload.liveTv?.audienceReaction).toBe(4);
    expect(replay.payload.cues.some((cue) => cue.type === "presenter")).toBe(true);
    expect(replay.payload.cues.some((cue) => cue.type === "performance")).toBe(true);
  });
});
