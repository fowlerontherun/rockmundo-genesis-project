import { describe, expect, it } from "vitest";
import type { TotpBroadcastReplay } from "./api";
import { orderTotpEpisodeReplays } from "./TotpFullEpisodePlayer";

function replay(id: string, runningOrder: number): TotpBroadcastReplay {
  return {
    id,
    performance_id: `performance-${id}`,
    replay_version: 3,
    stage_key: "main_stage",
    presenter_key: "alex_rayne",
    duration_ms: 60_000,
    checksum: id.padEnd(32, "0"),
    generated_at: "2026-09-17T20:00:00Z",
    payload: {
      schemaVersion: 1,
      episodeId: "episode",
      episodeNumber: 1,
      episodeDate: "2026-09-17",
      broadcastAt: "2026-09-17T20:00:00Z",
      performanceId: `performance-${id}`,
      runningOrder,
      presenterKey: "alex_rayne",
      band: { id: `band-${id}`, name: `Band ${id}`, members: [] },
      song: { id: `song-${id}`, title: `Song ${id}`, genre: "rock", qualifyingRank: 10 },
      stage: "main_stage",
      performanceDurationMs: 45_000,
      totalDurationMs: 60_000,
      cues: [],
    },
  };
}

describe("Top of the Pops full episode ordering", () => {
  it("plays canonical archive entries in locked running order", () => {
    const ordered = orderTotpEpisodeReplays([
      replay("third", 3),
      replay("first", 1),
      replay("second", 2),
    ]);

    expect(ordered.map((item) => item.id)).toEqual(["first", "second", "third"]);
  });

  it("uses replay id as a stable tie-breaker without mutating the source array", () => {
    const source = [replay("b", 2), replay("a", 2)];
    const ordered = orderTotpEpisodeReplays(source);

    expect(ordered.map((item) => item.id)).toEqual(["a", "b"]);
    expect(source.map((item) => item.id)).toEqual(["b", "a"]);
  });
});
