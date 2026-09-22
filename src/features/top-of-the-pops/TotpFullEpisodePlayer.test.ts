import { describe, expect, it } from "vitest";
import type { TotpBroadcastReplay, TotpPresenterFragmentBundle } from "./api";
import { buildTotpActPresenterSequence, buildTotpBetweenPresenterSequence, orderTotpEpisodeReplays } from "./TotpFullEpisodePlayer";

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

  it("assembles reusable phrase audio before the matching current band-name clip", () => {
    const item = replay("first", 1);
    item.payload.band = { id: "band-first", name: "Band first", members: [] };
    const fragments: TotpPresenterFragmentBundle = {
      presenter_key: "alex_rayne",
      phrases: {
        "and-now-its": {
          storage_path: "presenters/alex_rayne/reusable-phrases/and-now-its-deadbeef.webm",
          uploaded_at: "2026-09-21T12:00:00Z",
        },
      },
      bands: {
        "band-first": {
          band_id: "band-first",
          band_name: "Band first",
          audio_url: "https://media.example/band-first.webm",
          duration_ms: 800,
          sha256: "a".repeat(64),
          version: 2,
        },
      },
    };

    const sequence = buildTotpActPresenterSequence(item, "And now, it's Band first!", fragments);
    expect(sequence).toHaveLength(2);
    expect(sequence?.[0].url).toContain("and-now-its-deadbeef.webm");
    expect(sequence?.[0].gapAfterMs).toBe(70);
    expect(sequence?.[1].url).toBe("https://media.example/band-first.webm");
  });

  it("falls back to an available reusable phrase when the authored wording is not spliceable", () => {
    const item = replay("first", 1);
    const fragments: TotpPresenterFragmentBundle = {
      presenter_key: "alex_rayne",
      phrases: {
        "and-now-its": {
          storage_path: "presenters/alex_rayne/reusable-phrases/and-now-its-deadbeef.webm",
          uploaded_at: null,
        },
      },
      bands: {
        "band-first": {
          band_id: "band-first",
          band_name: "Old Band Name",
          audio_url: "https://media.example/band-first.webm",
          duration_ms: 800,
          sha256: "b".repeat(64),
          version: 1,
        },
      },
    };

    expect(buildTotpActPresenterSequence(item, "Christmas number one: Band first!", fragments)).toBeNull();
    expect(buildTotpActPresenterSequence(item, "And now, it's Band first!", fragments)).toBeNull();

    fragments.bands["band-first"].band_name = "Band first";
    const fallback = buildTotpActPresenterSequence(item, "Christmas number one: Band first!", fragments);
    expect(fallback).toHaveLength(2);
    expect(fallback?.[0].url).toContain("and-now-its-deadbeef.webm");
    expect(fallback?.[1].url).toBe("https://media.example/band-first.webm");
  });


  it("builds a richer between-act sequence around both recorded band names", () => {
    const current = replay("first", 1);
    const next = replay("second", 2);
    const fragments: TotpPresenterFragmentBundle = {
      presenter_key: "alex_rayne",
      phrases: {
        "what-a-performance-from": {
          storage_path: "presenters/alex_rayne/reusable-phrases/what-a-performance-from-a.webm",
          uploaded_at: null,
        },
        "up-next-its": {
          storage_path: "presenters/alex_rayne/reusable-phrases/up-next-its-b.webm",
          uploaded_at: null,
        },
      },
      bands: {
        "band-first": {
          band_id: "band-first",
          band_name: "Band first",
          audio_url: "https://media.example/band-first.webm",
          duration_ms: 700,
          sha256: "a".repeat(64),
          version: 1,
        },
        "band-second": {
          band_id: "band-second",
          band_name: "Band second",
          audio_url: "https://media.example/band-second.webm",
          duration_ms: 700,
          sha256: "b".repeat(64),
          version: 1,
        },
      },
    };

    const sequence = buildTotpBetweenPresenterSequence(current, next, fragments);
    expect(sequence).toHaveLength(4);
    expect(sequence?.[1].url).toBe("https://media.example/band-first.webm");
    expect(sequence?.[3].url).toBe("https://media.example/band-second.webm");
  });

  it("uses replay id as a stable tie-breaker without mutating the source array", () => {
    const source = [replay("b", 2), replay("a", 2)];
    const ordered = orderTotpEpisodeReplays(source);

    expect(ordered.map((item) => item.id)).toEqual(["a", "b"]);
    expect(source.map((item) => item.id)).toEqual(["b", "a"]);
  });
});
