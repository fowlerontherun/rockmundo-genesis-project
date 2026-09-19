import { describe, expect, it } from "vitest";
import {
  buildTotpEpisodeManifest,
  promoteTotpManifest,
  validateTotpEpisodeManifest,
  type TotpManifestInput,
  type TotpTrackRights,
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
    expect(first.total_runtime_ms).toBe(380_000);
    expect(first.production_state).toBe("gameplay");
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
