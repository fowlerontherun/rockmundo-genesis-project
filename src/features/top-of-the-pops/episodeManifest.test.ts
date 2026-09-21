import { describe, expect, it } from "vitest";
import {
  buildTotpEpisodeManifest,
  promoteTotpManifest,
  validateTotpEpisodeManifest,
  type TotpManifestInput,
  type TotpTrackRights,
  canonicalise,
  manifestChecksum,
} from "./episodeManifest";
import type { TotpEpisode } from "./api";

const cleared: TotpTrackRights = {
  owner: "Rockmundo Records",
  licence: "broadcast-2026",
  territories: ["WORLD"],
  expires_on: "2027-01-01",
  content_id_allowlisted: true,
  youtube_live_permitted: true,
  status: "cleared",
};

const episode: TotpEpisode = {
  id: "ep-1",
  episode_number: 12,
  episode_date: "2026-09-19",
  status: "scheduled",
  check_in_at: "2026-09-19T18:00:00Z",
  broadcast_at: "2026-09-19T19:00:00Z",
  presenter_key: "presenter_a",
  show_variant: null,
  broadcast_profile: "standard",
  performances: [
    {
      performance_id: "p2",
      running_order: 2,
      band_id: "b2",
      band_name: "Neon Verge",
      song_id: "s2",
      song_title: "Second Light",
      stage_key: "stage_b",
      presenter_intro: "Next up...",
      qualifying_rank: 4,
    },
    {
      performance_id: "p1",
      running_order: 1,
      band_id: "b1",
      band_name: "The Kestrels",
      song_id: "s1",
      song_title: "Opening Night",
      stage_key: "main_stage",
      presenter_intro: "Welcome!",
      qualifying_rank: 2,
    },
  ],
};

function input(overrides: Partial<TotpManifestInput> = {}): TotpManifestInput {
  return {
    episode,
    songAudio: {
      p1: { url: "https://cdn/p1.mp3", duration_ms: 180_000 },
      p2: { url: "https://cdn/p2.mp3", duration_ms: 200_000 },
    },
    presenterAudio: {
      p1: {
        url: "https://cdn/presenter-p1.wav",
        duration_ms: 1_000,
        sha256: "a".repeat(64),
        version: 1,
        script_checksum: manifestChecksum(canonicalise("Welcome!")),
      },
      p2: {
        url: "https://cdn/presenter-p2.wav",
        duration_ms: 1_000,
        sha256: "b".repeat(64),
        version: 1,
        script_checksum: manifestChecksum(canonicalise("Next up...")),
      },
    },
    rights: { s1: cleared, s2: cleared },
    ...overrides,
  };
}

describe("TOTP episode manifest", () => {
  it("orders segments by running order and is deterministic", () => {
    const first = buildTotpEpisodeManifest(input());
    const second = buildTotpEpisodeManifest(input());

    expect(first.segments.map((segment) => segment.performance_id)).toEqual(["p1", "p2"]);
    expect(first.checksum).toBe(second.checksum);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.total_runtime_ms).toBe(382_000);
    expect(first.production_state).toBe("gameplay");
  });

  it("accepts a frozen reusable presenter sequence as production-ready audio", () => {
    const sequenceScript = "And now, it's The Kestrels!";
    const sequenceEpisode: TotpEpisode = {
      ...episode,
      performances: episode.performances.map((performance) =>
        performance.performance_id === "p1"
          ? { ...performance, presenter_intro: sequenceScript }
          : performance,
      ),
    };
    const manifest = buildTotpEpisodeManifest(input({
      episode: sequenceEpisode,
      presenterAudio: {
        p2: input().presenterAudio!.p2,
      },
      presenterSequences: {
        p1: {
          duration_ms: 2_165,
          script_checksum: manifestChecksum(canonicalise(sequenceScript)),
          gap_ms: 65,
          fragments: [
            { role: "phrase", url: "https://cdn/phrase.webm", duration_ms: 1_200, sha256: "c".repeat(64), version: null },
            { role: "band_name", url: "https://cdn/band.webm", duration_ms: 900, sha256: "d".repeat(64), version: 2 },
          ],
        },
      },
    }));

    expect(validateTotpEpisodeManifest(manifest)).toEqual([]);
    expect(manifest.total_runtime_ms).toBe(383_165);
    expect(manifest.segments[0].assets.find((asset) => asset.kind === "presenter_audio_sequence")?.fragments).toHaveLength(2);
  });

  it("changes the checksum when any programme content changes", () => {
    const base = buildTotpEpisodeManifest(input());
    const changed = buildTotpEpisodeManifest(
      input({ songAudio: { p1: { url: "https://cdn/p1.mp3", duration_ms: 181_000 }, p2: { url: "https://cdn/p2.mp3", duration_ms: 200_000 } } }),
    );
    expect(changed.checksum).not.toBe(base.checksum);
  });

  it("blocks segments without audio, duration or cleared rights", () => {
    const manifest = buildTotpEpisodeManifest(
      input({
        songAudio: { p1: { url: null, duration_ms: null }, p2: { url: "https://cdn/p2.mp3", duration_ms: 0 } },
        rights: { s1: { ...cleared, status: "pending" } },
      }),
    );

    const codes = validateTotpEpisodeManifest(manifest).map((issue) => issue.code);
    expect(codes).toContain("missing_song_audio");
    expect(codes).toContain("missing_duration");
    expect(codes).toContain("rights_not_cleared");
  });

  it("requires frozen non-act presenter continuity before external production", () => {
    const manifest = buildTotpEpisodeManifest(
      input({
        presenterDialogue: [
          {
            cue_id: "opening",
            kind: "opening",
            performance_id: null,
            script_text: "Welcome to Top of the Pops.",
            audio: null,
          },
          {
            cue_id: "closing",
            kind: "closing",
            performance_id: null,
            script_text: "Thanks for joining us.",
            audio: {
              url: "https://cdn/closing.wav",
              duration_ms: 2_500,
              sha256: "c".repeat(64),
              version: 1,
              script_checksum: manifestChecksum(canonicalise("Thanks for joining us.")),
            },
          },
        ],
      }),
    );

    expect(validateTotpEpisodeManifest(manifest).map((issue) => issue.code)).toContain("missing_programme_continuity_audio");
    expect(promoteTotpManifest(manifest, "production_ready").manifest.production_state).toBe("gameplay");
  });

  it("only requires the chart presenter take when the frozen chart contains real positions", () => {
    const chartLine = {
      cue_id: "chart",
      kind: "chart" as const,
      performance_id: null,
      script_text: "And now, the charts.",
      audio: null,
    };
    const withoutChart = buildTotpEpisodeManifest(input({ presenterDialogue: [chartLine] }));
    expect(validateTotpEpisodeManifest(withoutChart).map((issue) => issue.code)).not.toContain("missing_programme_continuity_audio");

    const withChart = buildTotpEpisodeManifest(input({
      presenterDialogue: [chartLine],
      chartRundown: {
        episode_id: episode.id,
        chart_snapshot_date: "2026-09-18",
        streaming: [{
          rank: 1,
          song_id: "s1",
          band_id: "b1",
          song_title: "Opening Night",
          artist_name: "The Kestrels",
          trend: "up",
          trend_change: 1,
          weekly_plays: 1000,
        }],
        digital_sales: [],
        streaming_count: 1,
        digital_sales_count: 0,
      },
    }));
    expect(validateTotpEpisodeManifest(withChart).map((issue) => issue.code)).toContain("missing_programme_continuity_audio");
  });

  it("flags expired licences against the evaluation date", () => {
    const manifest = buildTotpEpisodeManifest(
      input({ rights: { s1: { ...cleared, expires_on: "2026-01-01" }, s2: cleared } }),
    );
    const codes = validateTotpEpisodeManifest(manifest, "2026-09-19").map((issue) => issue.code);
    expect(codes).toContain("rights_expired");
  });

  it("refuses promotion while blocking issues remain and promotes when clean", () => {
    const dirty = buildTotpEpisodeManifest(input({ rights: {} }));
    const refused = promoteTotpManifest(dirty, "production_ready");
    expect(refused.blocked.length).toBeGreaterThan(0);
    expect(refused.manifest.production_state).toBe("gameplay");

    const clean = buildTotpEpisodeManifest(input());
    const promoted = promoteTotpManifest(clean, "production_ready");
    expect(promoted.blocked).toEqual([]);
    expect(promoted.manifest.production_state).toBe("production_ready");
  });

  it("treats a missing presenter introduction as a warning only", () => {
    const manifest = buildTotpEpisodeManifest(
      input({
        episode: {
          ...episode,
          performances: episode.performances.map((performance) => ({
            ...performance,
            presenter_intro: null,
          })),
        },
      }),
    );
    const issues = validateTotpEpisodeManifest(manifest);
    expect(issues.every((issue) => issue.severity === "warning")).toBe(true);
    expect(promoteTotpManifest(manifest, "production_ready").manifest.production_state).toBe(
      "production_ready",
    );
  });
});
