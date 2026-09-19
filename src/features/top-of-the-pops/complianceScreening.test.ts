import { describe, expect, it } from "vitest";
import {
  checkTotpCaptionReadability,
  screenTotpEpisode,
  screenTotpText,
  type TotpEpisodeConsent,
} from "./complianceScreening";
import type { TotpEpisodeManifest, TotpManifestSegment, TotpTrackRights } from "./episodeManifest";

const clearedRights: TotpTrackRights = {
  owner: "Rockmundo in-game master",
  licence: "rockmundo-broadcast",
  territories: ["WORLD"],
  expires_on: null,
  content_id_allowlisted: true,
  youtube_live_permitted: true,
  status: "cleared",
};

function segment(overrides: Partial<TotpManifestSegment> = {}): TotpManifestSegment {
  return {
    index: 1,
    performance_id: "perf-1",
    band_id: "band-1",
    band_name: "The Neon Tides",
    song_id: "song-1",
    song_title: "Coastline",
    stage_key: "main_stage",
    qualifying_rank: 4,
    presenter_intro: "Straight in at number four, here are The Neon Tides with Coastline.",
    assets: [{ kind: "song_audio", url: "https://audio/song-1.mp3", duration_ms: 185_000 }],
    rights: clearedRights,
    ...overrides,
  };
}

function manifest(segments: TotpManifestSegment[]): TotpEpisodeManifest {
  return {
    manifest_version: 1,
    episode_id: "episode-1",
    episode_number: 12,
    episode_date: "2026-09-18",
    broadcast_at: "2026-09-18T19:30:00Z",
    check_in_at: "2026-09-18T18:00:00Z",
    presenter_key: "alex_rayne",
    show_variant: null,
    broadcast_profile: "regular",
    programme_spec: {
      width: 1920,
      height: 1080,
      frame_rate: 30,
      video_codec: "h264",
      audio_codec: "aac",
      audio_channels: 2,
      aspect_ratio: "16:9",
    },
    segments,
    total_runtime_ms: segments.reduce((total, item) => total + (item.assets[0]?.duration_ms ?? 0), 0),
    production_state: "gameplay",
    checksum: "checksum-1",
  };
}

const consent = (performanceId: string, consented = true): TotpEpisodeConsent => ({
  performance_id: performanceId,
  band_id: "band-1",
  band_name: "The Neon Tides",
  player_members: 3,
  consented_members: consented ? 3 : 1,
  consented,
});

describe("Top of the Pops compliance screening", () => {
  it("passes a clean episode with consent and captions", () => {
    const sheet = manifest([segment()]);
    const report = screenTotpEpisode({
      manifest: sheet,
      consents: [consent("perf-1")],
      captions: [
        { id: "c1", startMs: 0, endMs: 4_200, speaker: "Alex Rayne", text: "The Neon Tides with Coastline." },
      ],
    });
    expect(report.blockers).toHaveLength(0);
    expect(report.passed).toBe(true);
  });

  it("blocks an act without player permission", () => {
    const report = screenTotpEpisode({
      manifest: manifest([segment()]),
      consents: [consent("perf-1", false)],
      captions: [{ id: "c1", startMs: 0, endMs: 4_200, speaker: null, text: "The Neon Tides — Coastline" }],
    });
    expect(report.passed).toBe(false);
    expect(report.blockers.map((item) => item.code)).toContain("consent_signed");
  });

  it("blocks an open takedown", () => {
    const report = screenTotpEpisode({
      manifest: manifest([segment()]),
      consents: [consent("perf-1")],
      captions: [{ id: "c1", startMs: 0, endMs: 4_200, speaker: null, text: "The Neon Tides — Coastline" }],
      takedowns: [
        {
          id: "td-1",
          episode_id: "episode-1",
          performance_id: "perf-1",
          action: "remove",
          reason: "Player withdrew permission",
          replacement_note: null,
          active: true,
          created_at: "2026-09-19T10:00:00Z",
        },
      ],
    });
    expect(report.blockers.map((item) => item.code)).toContain("takedowns_clear");
  });

  it("flags prohibited and strong wording", () => {
    const hits = screenTotpText(
      manifest([
        segment({ band_name: "Retard Parade", song_title: "Fucking Brilliant", presenter_intro: "A lovely link." }),
      ]),
    );
    expect(hits.find((hit) => hit.field === "band_name")?.level).toBe("prohibited");
    expect(hits.find((hit) => hit.field === "song_title")?.level).toBe("flagged");
  });

  it("reports captions that are too long or too fast", () => {
    const issues = checkTotpCaptionReadability([
      { id: "c1", startMs: 0, endMs: 900, speaker: null, text: "A very quick line indeed" },
      { id: "c2", startMs: 1_000, endMs: 3_000, speaker: null, text: "x".repeat(120) },
    ]);
    expect(issues.map((issue) => issue.code)).toContain("too_short");
    expect(issues.map((issue) => issue.code)).toContain("too_long");
  });

  it("is deterministic", () => {
    const sheet = manifest([segment(), segment({ performance_id: "perf-2", index: 2, song_title: "Harbour Lights" })]);
    const input = { manifest: sheet, consents: [consent("perf-1"), consent("perf-2")] };
    expect(screenTotpEpisode(input).checksum).toBe(screenTotpEpisode(input).checksum);
  });
});
