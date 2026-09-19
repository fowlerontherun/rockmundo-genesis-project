import { describe, expect, it } from "vitest";
import { buildTotpPreflight } from "../preflight";
import { canonicalise, manifestChecksum, type TotpEpisodeManifest, type TotpManifestSegment, type TotpTrackRights } from "../episodeManifest";

const rights: TotpTrackRights = {
  owner: "Example Master Owner",
  licence: "broadcast-agreement-1",
  territories: ["WORLD"],
  expires_on: null,
  content_id_allowlisted: true,
  youtube_live_permitted: true,
  status: "cleared",
};

function segment(overrides: Partial<TotpManifestSegment> = {}): TotpManifestSegment {
  const intro = "Here they are!";
  return {
    index: 1,
    performance_id: "perf-1",
    band_id: "band-1",
    band_name: "The Test Band",
    song_id: "song-1",
    song_title: "Test Song",
    stage_key: "main",
    qualifying_rank: 1,
    presenter_intro: intro,
    assets: [
      { kind: "song_audio", url: "https://example.com/a.mp3", duration_ms: 210_000, sha256: null, version: null, script_checksum: null },
      { kind: "presenter_audio", url: "https://example.com/p.wav", duration_ms: 2_000, sha256: "a".repeat(64), version: 1, script_checksum: manifestChecksum(canonicalise(intro)) },
    ],
    rights,
    ...overrides,
  };
}

function manifest(segments: TotpManifestSegment[]): TotpEpisodeManifest {
  return {
    manifest_version: 1,
    episode_id: "ep-1",
    episode_number: 12,
    episode_date: "2026-09-25",
    broadcast_at: "2026-09-25T19:30:00Z",
    check_in_at: "2026-09-25T18:00:00Z",
    presenter_key: "alex_rayne",
    show_variant: "regular",
    broadcast_profile: "standard",
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
    total_runtime_ms: segments.length * 212_000,
    production_state: "gameplay",
    checksum: "abc123def456",
  };
}

describe("buildTotpPreflight", () => {
  it("blocks when nothing has been built", () => {
    const report = buildTotpPreflight({ manifest: null });
    expect(report.renderReady).toBe(false);
    expect(report.blockers.map((item) => item.code)).toContain("manifest_built");
  });

  it("blocks when the saved sheet is out of date", () => {
    const live = manifest([segment(), segment({ index: 2, performance_id: "perf-2" }), segment({ index: 3, performance_id: "perf-3" })]);
    const report = buildTotpPreflight({
      manifest: live,
      stored: { checksum: "stale", production_state: "gameplay" } as never,
    });
    expect(report.blockers.map((item) => item.code)).toContain("sheet_saved");
  });

  it("clears content blockers but keeps sign-off locked until rehearsal QC passes", () => {
    const live = manifest([segment(), segment({ index: 2, performance_id: "perf-2" }), segment({ index: 3, performance_id: "perf-3" })]);
    const report = buildTotpPreflight({
      manifest: live,
      stored: { checksum: live.checksum, production_state: "production_ready" } as never,
      automationHealthy: true,
      compliance: { passed: true, blockerCount: 0, warningCount: 0, manifestChecksum: live.checksum },
    });
    expect(report.blockers).toHaveLength(0);
    expect(report.renderReady).toBe(false);
    expect(report.publishReady).toBe(false);
  });

  it("flags missing song audio as a blocker", () => {
    const live = manifest([segment({
      assets: [
        { kind: "song_audio", url: null, duration_ms: null, sha256: null, version: null, script_checksum: null },
      ],
    })]);
    const report = buildTotpPreflight({ manifest: live, stored: { checksum: live.checksum, production_state: "gameplay" } as never });
    expect(report.blockers.map((item) => item.code)).toContain("song_audio");
    expect(report.rehearsalReady).toBe(false);
  });

  it("only marks publish ready once a master and rehearsal exist", () => {
    const live = manifest([segment(), segment({ index: 2, performance_id: "perf-2" }), segment({ index: 3, performance_id: "perf-3" })]);
    const report = buildTotpPreflight({
      manifest: live,
      stored: { checksum: live.checksum, production_state: "rendered_master" } as never,
      renderJobs: [
        { state: "succeeded", manifest_checksum: live.checksum, error_message: null, qc: { passed: true }, plan: { purpose: "rehearsal" } } as never,
        { state: "succeeded", manifest_checksum: live.checksum, error_message: null, qc: { passed: true }, plan: { purpose: "master" } } as never,
      ],
      automationHealthy: true,
      compliance: { passed: true, blockerCount: 0, warningCount: 0, manifestChecksum: live.checksum },
    });
    expect(report.publishReady).toBe(true);
  });

  it("blocks publication until the rights and safety screening is clear", () => {
    const live = manifest([segment(), segment({ index: 2, performance_id: "perf-2" }), segment({ index: 3, performance_id: "perf-3" })]);
    const base = {
      manifest: live,
      stored: { checksum: live.checksum, production_state: "rendered_master" } as never,
      renderJobs: [
        { state: "succeeded", manifest_checksum: live.checksum, error_message: null, qc: { passed: true }, plan: { purpose: "rehearsal" } } as never,
        { state: "succeeded", manifest_checksum: live.checksum, error_message: null, qc: { passed: true }, plan: { purpose: "master" } } as never,
      ],
      automationHealthy: true,
    };

    const unscreened = buildTotpPreflight(base);
    expect(unscreened.blockers.map((item) => item.code)).toContain("compliance_screened");
    expect(unscreened.publishReady).toBe(false);

    const stale = buildTotpPreflight({
      ...base,
      compliance: { passed: true, blockerCount: 0, warningCount: 0, manifestChecksum: "older-sheet" },
    });
    expect(stale.blockers.map((item) => item.code)).toContain("compliance_screened");

    const failed = buildTotpPreflight({
      ...base,
      compliance: { passed: false, blockerCount: 2, warningCount: 1, manifestChecksum: live.checksum },
    });
    expect(failed.blockers.map((item) => item.code)).toContain("compliance_clear");
  });

  it("only unlocks broadcast sign-off after a QC-approved full rehearsal for this checksum", () => {
    const live = manifest([segment(), segment({ index: 2, performance_id: "perf-2" }), segment({ index: 3, performance_id: "perf-3" })]);
    const base = {
      manifest: live,
      stored: { checksum: live.checksum, production_state: "gameplay" } as never,
      automationHealthy: true,
      compliance: { passed: true, blockerCount: 0, warningCount: 0, manifestChecksum: live.checksum },
    };
    const withoutRehearsal = buildTotpPreflight(base);
    expect(withoutRehearsal.renderReady).toBe(false);

    const staleRehearsal = buildTotpPreflight({
      ...base,
      renderJobs: [{ state: "succeeded", manifest_checksum: "old", qc: { passed: true }, plan: { purpose: "rehearsal" } } as never],
    });
    expect(staleRehearsal.renderReady).toBe(false);

    const passed = buildTotpPreflight({
      ...base,
      renderJobs: [{ state: "succeeded", manifest_checksum: live.checksum, qc: { passed: true }, plan: { purpose: "rehearsal" } } as never],
    });
    expect(passed.renderReady).toBe(true);
  });

});