import { describe, expect, it } from "vitest";
import type { GigViewerReplay } from "../events/types";
import type { GigExperienceDTO } from "../types";
import { expandReplayToFullSongDurations } from "./playerReplayTimeline";

const replay = {
  id: "replay-1",
  gigId: "gig-1",
  gigOutcomeId: "outcome-1",
  viewerVersion: 1,
  eventSchemaVersion: 1,
  simulationSeed: "seed",
  durationMs: 40_000,
  generatedAt: "2026-08-11T00:00:00Z",
  checksum: "stored-checksum",
  status: "ready",
  events: [
    event(0, 0, 10_000, "song-1", "First song"),
    event(1, 10_000, 10_000, "song-2", "Second song"),
    {
      ...event(2, 20_000, 20_000, null, ""),
      phase: "finale",
      eventType: "finale_started",
      visualPayload: { type: "moment_effect", effect: "confetti", intensity: 1 },
    },
  ],
} satisfies GigViewerReplay;

function event(sequence: number, scheduledOffsetMs: number, durationMs: number, songId: string | null, title: string) {
  return {
    id: `event-${sequence}`,
    gigId: "gig-1",
    sequence,
    phase: "song_performance" as const,
    eventType: "song_started" as const,
    scheduledOffsetMs,
    durationMs,
    importance: "normal" as const,
    songId,
    messageKey: "gig.viewer.song_started",
    messageParams: { title },
    visualPayload: { type: "song_start" as const, songId, title, position: sequence, montage: false },
  };
}

function experience(sourceType: "generated_full" | "preview") {
  return {
    songs: [
      { id: "performance-1", songId: "song-1", audio: { available: true, sourceType, durationSeconds: 180 } },
      { id: "performance-2", songId: "song-2", audio: { available: true, sourceType, durationSeconds: 240 } },
    ],
  } as GigExperienceDTO;
}

describe("player full-song replay timeline", () => {
  it("expands each generated full track while leaving the finale intact", () => {
    const expanded = expandReplayToFullSongDurations(replay, experience("generated_full"));

    expect(expanded).not.toBe(replay);
    expect(expanded.events[0].durationMs).toBe(180_000);
    expect(expanded.events[1].scheduledOffsetMs).toBe(180_000);
    expect(expanded.events[1].durationMs).toBe(240_000);
    expect(expanded.events[2].scheduledOffsetMs).toBe(420_000);
    expect(expanded.events[2].durationMs).toBe(20_000);
    expect(expanded.durationMs).toBe(440_000);
    expect(expanded.checksum).toBeNull();
  });

  it("does not stretch preview-only or unavailable audio", () => {
    expect(expandReplayToFullSongDurations(replay, experience("preview"))).toBe(replay);
    expect(expandReplayToFullSongDurations(replay, null)).toBe(replay);
  });
});
