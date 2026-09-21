import { describe, expect, it } from "vitest";
import {
  buildTotpRenderPlan,
  buildTotpRehearsalRenderPlan,
  buildTotpSegmentPreviewRenderPlan,
  evaluateTotpRenderQc,
  toTotpChapterFile,
  type TotpRenderProbe,
} from "./renderSpec";
import { canonicalise, manifestChecksum, type TotpEpisodeManifest } from "./episodeManifest";

const rights = {
  owner: "Example Master Owner",
  licence: "broadcast-agreement-1",
  territories: ["WORLD"],
  expires_on: null,
  content_id_allowlisted: true,
  youtube_live_permitted: true,
  status: "cleared" as const,
};

const introChecksum = manifestChecksum(canonicalise("Here they are"));

const manifest: TotpEpisodeManifest = {
  manifest_version: 1,
  episode_id: "episode-1",
  episode_number: 7,
  episode_date: "2026-09-19",
  broadcast_at: "2026-09-19T19:00:00.000Z",
  check_in_at: "2026-09-19T18:00:00.000Z",
  presenter_key: "alex_rayne",
  show_variant: null,
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
  segments: [
    {
      index: 0,
      performance_id: "perf-1",
      band_id: "band-1",
      band_name: "Shockmaster",
      song_id: "song-1",
      song_title: "Dead Radio",
      stage_key: "main",
      qualifying_rank: 1,
      presenter_intro: "Here they are",
      assets: [
        { kind: "song_audio", url: "https://audio/1.mp3", duration_ms: 200_000, sha256: null, version: null, script_checksum: null },
        { kind: "presenter_audio", url: "https://audio/p1.wav", duration_ms: 3_250, sha256: "b".repeat(64), version: 1, script_checksum: introChecksum },
      ],
      rights,
    },
    {
      index: 1,
      performance_id: "perf-2",
      band_id: "band-2",
      band_name: "Neon Vows",
      song_id: "song-2",
      song_title: "Glass Parade",
      stage_key: "main",
      qualifying_rank: 2,
      presenter_intro: null,
      assets: [{ kind: "song_audio", url: null, duration_ms: null, sha256: null, version: null, script_checksum: null }],
      rights,
    },
  ],
  total_runtime_ms: 203_250,
  production_state: "production_ready",
  checksum: "abc123",
};

describe("Top of the Pops render plan", () => {
  it("lays out titles, every act and credits with continuous timecodes", () => {
    const plan = buildTotpRenderPlan(manifest);
    expect(plan.items[0].kind).toBe("opening_titles");
    expect(plan.items.at(-1)?.kind).toBe("end_credits");
    expect(plan.items.filter((item) => item.kind === "performance")).toHaveLength(2);
    plan.items.slice(1).forEach((item, index) => {
      const previous = plan.items[index];
      expect(item.start_ms).toBe(previous.start_ms + previous.duration_ms);
    });
    expect(plan.total_duration_ms).toBe(plan.items.reduce((total, item) => total + item.duration_ms, 0));
  });

  it("uses the exact recorded presenter duration and falls back for missing song duration", () => {
    const plan = buildTotpRenderPlan(manifest);
    const links = plan.items.filter((item) => item.kind === "presenter_link");
    const performances = plan.items.filter((item) => item.kind === "performance");
    expect(links[0].duration_ms).toBe(3_250);
    expect(performances[0].duration_ms).toBe(200_000);
    expect(performances[1].duration_ms).toBe(180_000);
  });

  it("renders a frozen phrase and band-name sequence when no exact presenter take exists", () => {
    const sequenceManifest: TotpEpisodeManifest = {
      ...manifest,
      segments: manifest.segments.map((segment) =>
        segment.performance_id === "perf-1"
          ? {
              ...segment,
              assets: [
                segment.assets[0],
                {
                  kind: "presenter_audio_sequence",
                  url: null,
                  duration_ms: 2_465,
                  sha256: null,
                  version: null,
                  script_checksum: introChecksum,
                  gap_ms: 65,
                  fragments: [
                    { role: "phrase", url: "https://audio/phrase.webm", duration_ms: 1_200, sha256: "c".repeat(64), version: null },
                    { role: "band_name", url: "https://audio/band.webm", duration_ms: 1_200, sha256: "d".repeat(64), version: 4 },
                  ],
                },
              ],
            }
          : segment,
      ),
    };

    const plan = buildTotpRenderPlan(sequenceManifest);
    const link = plan.items.find((item) => item.kind === "presenter_link" && item.performance_id === "perf-1");
    expect(link?.audio_url).toBeNull();
    expect(link?.duration_ms).toBe(2_465);
    expect(link?.audio_sequence).toEqual([
      expect.objectContaining({ role: "phrase", url: "https://audio/phrase.webm", offset_ms: 0, duration_ms: 1_200 }),
      expect.objectContaining({ role: "band_name", url: "https://audio/band.webm", offset_ms: 1_265, duration_ms: 1_200 }),
    ]);
  });

  it("is deterministic and names delivery files from the episode", () => {
    const a = buildTotpRenderPlan(manifest);
    const b = buildTotpRenderPlan(manifest);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.purpose).toBe("master");
    expect(a.source_performance_id).toBeNull();
    expect(a.delivery.master).toBe("totp-episode-007-2026-09-19-master.mp4");
    expect(a.delivery.youtube).toBe("totp-episode-007-2026-09-19-youtube.mp4");
    expect(a.delivery.thumbnails).toHaveLength(2);
    expect(a.delivery.captions.endsWith(".vtt")).toBe(true);
    expect(a.captions_vtt).toContain("WEBVTT");
    expect(a.expected_frame_count).toBe(Math.round((a.total_duration_ms / 1000) * 30));
  });

  it("creates one chapter per act plus titles and credits", () => {
    const plan = buildTotpRenderPlan(manifest);
    expect(plan.chapters).toHaveLength(4);
    expect(toTotpChapterFile(plan).split("\n")[0]).toBe("00:00 Opening titles");
  });

  it("passes quality control for a conforming master", () => {
    const plan = buildTotpRenderPlan(manifest);
    const probe: TotpRenderProbe = {
      duration_ms: plan.total_duration_ms,
      audio_duration_ms: plan.total_duration_ms,
      width: 1920,
      height: 1080,
      frame_rate: 30,
      frame_count: plan.expected_frame_count,
      video_codec: "h264",
      audio_codec: "aac",
      audio_channels: 2,
      audio_sample_rate: 48_000,
      video_bitrate_kbps: 10_000,
      audio_bitrate_kbps: 192,
      has_audio: true,
      programme_loudness_lufs: -14.2,
      true_peak_dbtp: -1.4,
      black_frame_ratio: 0,
      frozen_frame_ratio: 0,
      caption_overflow_count: 0,
      chapter_count: plan.chapters.length,
    };
    expect(evaluateTotpRenderQc(plan, probe)).toEqual({ passed: true, failures: [] });
  });

  it("reports every quality-control failure", () => {
    const plan = buildTotpRenderPlan(manifest);
    const result = evaluateTotpRenderQc(plan, {
      duration_ms: plan.total_duration_ms + 9_000,
      audio_duration_ms: plan.total_duration_ms + 15_000,
      width: 1280,
      height: 720,
      frame_rate: 25,
      frame_count: plan.expected_frame_count - 10,
      video_codec: "vp9",
      audio_codec: "opus",
      audio_channels: 1,
      audio_sample_rate: 44_100,
      video_bitrate_kbps: 1_000,
      audio_bitrate_kbps: 96,
      has_audio: false,
      programme_loudness_lufs: -9,
      true_peak_dbtp: 0.4,
      black_frame_ratio: 0.08,
      frozen_frame_ratio: 0.12,
      caption_overflow_count: 2,
      chapter_count: 1,
    });
    expect(result.passed).toBe(false);
    expect(result.failures.map((failure) => failure.code)).toEqual([
      "duration_within_tolerance",
      "resolution_matches_spec",
      "frame_rate_matches_spec",
      "frame_count_matches_plan",
      "video_codec_matches_spec",
      "audio_codec_matches_spec",
      "audio_channels_matches_spec",
      "audio_sample_rate_matches_spec",
      "audio_video_drift_under_frame",
      "audio_stream_present",
      "programme_loudness_in_range",
      "true_peak_below_ceiling",
      "black_frames_absent",
      "frozen_frames_absent",
      "caption_overflow_absent",
      "chapters_present",
    ]);
  });

  it("builds a full rehearsal with the exact master timeline but separate artifacts", () => {
    const master = buildTotpRenderPlan(manifest);
    const rehearsal = buildTotpRehearsalRenderPlan(manifest);
    expect(rehearsal.purpose).toBe("rehearsal");
    expect(rehearsal.items).toEqual(master.items);
    expect(rehearsal.total_duration_ms).toBe(master.total_duration_ms);
    expect(rehearsal.expected_frame_count).toBe(master.expected_frame_count);
    expect(rehearsal.delivery.master).toContain("-rehearsal.mp4");
    expect(rehearsal.delivery.master).not.toBe(master.delivery.master);
  });

  it("builds a segment preview containing only the selected act", () => {
    const preview = buildTotpSegmentPreviewRenderPlan(manifest, "perf-1");
    expect(preview.purpose).toBe("segment_preview");
    expect(preview.source_performance_id).toBe("perf-1");
    expect(preview.items.every((item) => item.performance_id === "perf-1")).toBe(true);
    expect(preview.items[0].start_ms).toBe(0);
    expect(preview.items.filter((item) => item.kind === "performance")).toHaveLength(1);
    expect(preview.chapters).toHaveLength(1);
    expect(preview.delivery.master).toContain("-segment-preview-perf-1");
  });

});