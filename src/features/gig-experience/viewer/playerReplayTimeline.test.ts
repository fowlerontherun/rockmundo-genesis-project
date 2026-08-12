import { describe, expect, it } from "vitest";
import type { GigViewerReplay } from "../events/types";
import type { GigExperienceDTO } from "../types";
import { fitReplayToPlayerSongExcerpts } from "./playerReplayTimeline";

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

function experience(durationSeconds = 180) {
  return {
    songs: [
      { id: "performance-1", songId: "song-1", audio: { available: true, sourceType: "generated_full", durationSeconds } },
      { id: "performance-2", songId: "song-2", audio: { available: true, sourceType: "preview", durationSeconds: 240 } },
    ],
  } as GigExperienceDTO;
}

describe("player 20-second song replay timeline", () => {
  it("fits every song to 20 seconds while leaving the finale intact", () => {
    const expanded = fitReplayToPlayerSongExcerpts(replay, experience());

    expect(expanded).not.toBe(replay);
    expect(expanded.events[0].durationMs).toBe(20_000);
    expect(expanded.events[1].scheduledOffsetMs).toBe(20_000);
    expect(expanded.events[1].durationMs).toBe(20_000);
    expect(expanded.events[2].scheduledOffsetMs).toBe(40_000);
    expect(expanded.events[2].durationMs).toBe(20_000);
    expect(expanded.durationMs).toBe(60_000);
    expect(expanded.checksum).toBeNull();
  });

  it("caps an excerpt when the known track is shorter than 20 seconds", () => {
    const expanded = fitReplayToPlayerSongExcerpts(replay, experience(12));

    expect(expanded.events[0].durationMs).toBe(12_000);
    expect(expanded.events[1].scheduledOffsetMs).toBe(12_000);
    expect(expanded.events[1].durationMs).toBe(20_000);
  });

  it("uses 20-second visual excerpts when audio metadata is unavailable", () => {
    const expanded = fitReplayToPlayerSongExcerpts(replay, null);

    expect(expanded.events[0].durationMs).toBe(20_000);
    expect(expanded.events[1].durationMs).toBe(20_000);
  });

  it("preserves recorded performance-item choreography duration", () => {
    const itemIntro = {
      ...event(1, 10_000, 2_000, null, "Stage Dive"),
      performanceItemId: "item-1",
      messageKey: "gig.viewer.performance_item_started",
      visualPayload: { type: "song_start" as const, songId: null, title: "Stage Dive", position: 1, montage: false, itemType: "performance_item" as const, performanceItemId: "item-1" },
    };
    const itemAction = {
      ...event(2, 12_000, 4_000, null, "Stage Dive"),
      performanceItemId: "item-1",
      eventType: "song_crowd_reaction" as const,
      messageKey: "gig.viewer.performance_item_reaction",
      visualPayload: { type: "performance_item" as const, itemId: "item-1", name: "Stage Dive", category: "stage_action", action: "stage_dive" as const, intensity: 0.8 },
    };
    const finale = {
      ...event(3, 16_000, 20_000, null, ""),
      phase: "finale" as const,
      eventType: "finale_started" as const,
      visualPayload: { type: "moment_effect" as const, effect: "confetti" as const, intensity: 1 },
    };
    const withItem = { ...replay, durationMs: 36_000, events: [event(0, 0, 10_000, "song-1", "First song"), itemIntro, itemAction, finale] } satisfies GigViewerReplay;

    const expanded = fitReplayToPlayerSongExcerpts(withItem, experience());
    expect(expanded.events.map(({ scheduledOffsetMs, durationMs }) => ({ scheduledOffsetMs, durationMs }))).toEqual([
      { scheduledOffsetMs: 0, durationMs: 20_000 },
      { scheduledOffsetMs: 20_000, durationMs: 2_000 },
      { scheduledOffsetMs: 22_000, durationMs: 4_000 },
      { scheduledOffsetMs: 26_000, durationMs: 20_000 },
    ]);
  });
});
