import { describe, expect, it } from "vitest";
import { buildTotpPreflight } from "../preflight";
import type { TotpEpisodeManifest, TotpManifestSegment } from "../episodeManifest";
import { inGameTrackRights } from "../episodeManifestApi";

function segment(overrides: Partial<TotpManifestSegment> = {}): TotpManifestSegment {
  return {
    index: 1,
    performance_id: "perf-1",
    band_id: "band-1",
    band_name: "The Test Band",
    song_id: "song-1",
    song_title: "Test Song",
    stage_key: "main",
    qualifying_rank: 1,
    presenter_intro: "Here they are!",
    assets: [{ kind: "song_audio", url: "https://example.com/a.mp3", duration_ms: 210_000 }],
    rights: inGameTrackRights(),
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
    chart_snapshot_date: "2026-09-24",
    segments,
    total_runtime_ms: segments.length * 210_000,
    checksum: "abc123def456",
  } as TotpEpisodeManifest;
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

  it("clears every blocker for a complete, saved episode", () => {
    const live = manifest([segment(), segment({ index: 2, performance_id: "perf-2" }), segment({ index: 3, performance_id: "perf-3" })]);
    const report = buildTotpPreflight({
      manifest: live,
      stored: { checksum: live.checksum, production_state: "production_ready" } as never,
      automationHealthy: true,
    });
    expect(report.blockers).toHaveLength(0);
    expect(report.renderReady).toBe(true);
    expect(report.publishReady).toBe(false);
  });

  it("flags missing song audio as a blocker", () => {
    const live = manifest([segment({ assets: [{ kind: "song_audio", url: null, duration_ms: null }] })]);
    const report = buildTotpPreflight({ manifest: live, stored: { checksum: live.checksum, production_state: "gameplay" } as never });
    expect(report.blockers.map((item) => item.code)).toContain("song_audio");
    expect(report.rehearsalReady).toBe(false);
  });

  it("only marks publish ready once a master and rehearsal exist", () => {
    const live = manifest([segment(), segment({ index: 2, performance_id: "perf-2" }), segment({ index: 3, performance_id: "perf-3" })]);
    const report = buildTotpPreflight({
      manifest: live,
      stored: { checksum: live.checksum, production_state: "rendered_master" } as never,
      renderJobs: [{ state: "succeeded", manifest_checksum: live.checksum, error_message: null } as never],
      rehearsalCheckedAt: "2026-09-24T10:00:00Z",
      automationHealthy: true,
    });
    expect(report.publishReady).toBe(true);
  });
});
