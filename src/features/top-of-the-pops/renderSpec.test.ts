import { describe, expect, it } from "vitest";
import {
  buildTotpRenderPlan,
  evaluateTotpRenderQc,
  toTotpChapterFile,
  type TotpRenderProbe,
} from "./renderSpec";
import type { TotpEpisodeManifest } from "./episodeManifest";

const rights = {
  owner: "Rockmundo in-game master",
  licence: "rockmundo-broadcast",
  territories: ["WORLD"],
  expires_on: null,
  content_id_allowlisted: true,
  youtube_live_permitted: true,
  status: "cleared" as const,
};

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
      assets: [{ kind: "song_audio", url: "https://audio/1.mp3", duration_ms: 200_000 }],
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
      assets: [{ kind: "song_audio", url: null, duration_ms: null }],
      rights,
    },
  ],
  total_runtime_ms: 400_000,
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

  it("falls back to a standard performance length when audio duration is missing", () => {
    const plan = buildTotpRenderPlan(manifest);
    const performances = plan.items.filter((item) => item.kind === "performance");
    expect(performances[0].duration_ms).toBe(200_000);
    expect(performances[1].duration_ms).toBe(180_000);
  });

  it("is deterministic and names delivery files from the episode", () => {
    const a = buildTotpRenderPlan(manifest);
    const b = buildTotpRenderPlan(manifest);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.delivery.master).toBe("totp-episode-007-2026-09-19-master.mp4");
    expect(a.delivery.captions.endsWith(".vtt")).toBe(true);
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
      width: 1920,
      height: 1080,
      frame_rate: 30,
      video_codec: "h264",
      audio_codec: "aac",
      audio_channels: 2,
      programme_loudness_lufs: -14.2,
      true_peak_dbtp: -1.4,
      chapter_count: plan.chapters.length,
      frame_count: Math.round((plan.total_duration_ms / 1000) * 30),
      video_duration_ms: plan.total_duration_ms,
      audio_duration_ms: plan.total_duration_ms,
      audio_sample_rate: 48_000,
      black_frame_count: 0,
      frozen_frame_count: 0,
      caption_issues: 0,
    };
    expect(evaluateTotpRenderQc(plan, probe)).toEqual({ passed: true, failures: [] });
  });

  it("reports every quality-control failure", () => {
    const plan = buildTotpRenderPlan(manifest);
    const result = evaluateTotpRenderQc(plan, {
      duration_ms: plan.total_duration_ms + 9_000,
      width: 1280,
      height: 720,
      frame_rate: 25,
      video_codec: "vp9",
      audio_codec: "opus",
      audio_channels: 1,
      programme_loudness_lufs: -9,
      true_peak_dbtp: 0.4,
      chapter_count: 1,
      frame_count: 1,
      video_duration_ms: plan.total_duration_ms,
      audio_duration_ms: plan.total_duration_ms - 5_000,
      audio_sample_rate: 44_100,
      black_frame_count: 1,
      frozen_frame_count: 1,
      caption_issues: 2,
    });
    expect(result.passed).toBe(false);
    expect(result.failures.map((failure) => failure.code)).toEqual([
      "duration_within_tolerance",
      "resolution_matches_spec",
      "frame_rate_matches_spec",
      "video_codec_matches_spec",
      "audio_codec_matches_spec",
      "audio_channels_matches_spec",
      "programme_loudness_in_range",
      "true_peak_below_ceiling",
      "chapters_present",
      "frame_count_matches",
      "audio_sample_rate_matches",
      "audio_video_drift_under_frame",
      "no_black_frames",
      "no_frozen_frames",
      "captions_valid",
    ]);
  });
});
