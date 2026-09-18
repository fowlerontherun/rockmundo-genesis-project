import { describe, expect, it } from "vitest";
import type { TotpBroadcastReplay } from "./api";
import {
  buildTotpContinuityCopy,
  buildTotpProgrammeRundown,
  orderTotpProgrammeReplays,
} from "./programmeContinuity";

function replay(id: string, runningOrder: number, chartRank: number, bandName: string, songTitle: string): TotpBroadcastReplay {
  return {
    id,
    performance_id: `performance-${id}`,
    replay_version: 4,
    stage_key: "main_stage",
    presenter_key: "alex_rayne",
    duration_ms: 120_000,
    checksum: `checksum-${id}`,
    generated_at: "2026-09-17T20:00:00Z",
    payload: {
      schemaVersion: 4,
      episodeId: "episode-1",
      episodeNumber: 1,
      episodeDate: "2026-09-17",
      broadcastAt: "2026-09-17T20:00:00Z",
      performanceId: `performance-${id}`,
      runningOrder,
      presenterKey: "alex_rayne",
      showVariant: "regular",
      band: { id: `band-${id}`, name: bandName, members: [] },
      song: { id: `song-${id}`, title: songTitle, genre: "rock", qualifyingRank: chartRank },
      stage: "main_stage",
      performanceDurationMs: 110_000,
      totalDurationMs: 120_000,
      cues: [],
    },
  };
}

const fixtures = [
  replay("c", 3, 1, "The Number Ones", "Top Spot"),
  replay("a", 1, 18, "Opening Act", "First Song"),
  replay("b", 2, 7, "Second Act", "Next Song"),
];

describe("Top of the Pops programme continuity", () => {
  it("keeps programme playback in locked running order", () => {
    expect(orderTotpProgrammeReplays(fixtures).map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("builds a chart-ranked rundown without pretending it is the full Top 40", () => {
    const rundown = buildTotpProgrammeRundown(fixtures);
    expect(rundown.map((item) => [item.chartRank, item.bandName])).toEqual([
      [1, "The Number Ones"],
      [7, "Second Act"],
      [18, "Opening Act"],
    ]);
  });

  it("opens with the first locked running-order act", () => {
    const copy = buildTotpContinuityCopy("opening", fixtures);
    expect(copy.headline).toContain("3 charting acts");
    expect(copy.nextAct?.bandName).toBe("Opening Act");
    expect(copy.nextAct?.chartRank).toBe(18);
  });

  it("links the completed act to the next act using frozen chart ranks", () => {
    const copy = buildTotpContinuityCopy("between", fixtures, 0);
    expect(copy.headline).toContain("Opening Act");
    expect(copy.body).toContain("#18");
    expect(copy.body).toContain("Second Act");
    expect(copy.body).toContain("#7");
  });

  it("calls out a performed number one in the closing sequence", () => {
    const copy = buildTotpContinuityCopy("closing", fixtures, 2);
    expect(copy.headline).toBe("Tonight's #1: The Number Ones");
    expect(copy.body).toContain("Top Spot");
  });

  it("does not invent a number one when the episode has no #1 performance", () => {
    const withoutNumberOne = fixtures.filter((item) => item.payload.song.qualifyingRank !== 1);
    const copy = buildTotpContinuityCopy("closing", withoutNumberOne, 1);
    expect(copy.headline).toBe("See you for the next show");
    expect(copy.body).toContain("see you on the next Top of the Pops");
  });
});
