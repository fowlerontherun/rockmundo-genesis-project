import { describe, expect, it } from "vitest";
import type { TotpBroadcastReplay } from "./api";
import { totpPerformanceStartMs } from "./TotpArchivePlayer";

function replayWithPerformanceOffset(offsetMs: number | null): TotpBroadcastReplay {
  return {
    id: "replay-1",
    performance_id: "performance-1",
    replay_version: 4,
    stage_key: "main_stage",
    presenter_key: "alex_rayne",
    duration_ms: 120_000,
    checksum: "checksum",
    generated_at: "2026-09-18T10:00:00Z",
    payload: {
      schemaVersion: 4,
      episodeId: "episode-1",
      episodeNumber: 1,
      episodeDate: "2026-09-18",
      broadcastAt: "2026-09-18T20:00:00Z",
      performanceId: "performance-1",
      runningOrder: 1,
      presenterKey: "alex_rayne",
      showVariant: "regular",
      band: { id: "band-1", name: "Shockmaster", members: [] },
      song: { id: "song-1", title: "Song", genre: "rock", qualifyingRank: 7 },
      stage: "main_stage",
      performanceDurationMs: 110_000,
      totalDurationMs: 117_700,
      cues: offsetMs === null ? [] : [
        { id: "presenter-intro", type: "presenter", offsetMs: 0, durationMs: offsetMs, cameraShot: "presenter_wide", stage: "main_stage" },
        { id: "performance-1", type: "performance", offsetMs, durationMs: 4_500, cameraShot: "studio_master", stage: "main_stage" },
      ],
    },
  };
}

describe("Top of the Pops replay clock sync", () => {
  it("starts song playback from the authoritative performance cue", () => {
    expect(totpPerformanceStartMs(replayWithPerformanceOffset(4_200))).toBe(4_200);
    expect(totpPerformanceStartMs(replayWithPerformanceOffset(5_100))).toBe(5_100);
  });

  it("uses the current 4.2 second contract only as a legacy fallback", () => {
    expect(totpPerformanceStartMs(replayWithPerformanceOffset(null))).toBe(4_200);
  });
});
