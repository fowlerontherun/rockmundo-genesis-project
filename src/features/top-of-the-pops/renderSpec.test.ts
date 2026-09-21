import { describe, expect, it } from "vitest";
import {
  buildTotpRenderPlan,
  buildTotpRehearsalRenderPlan,
  buildTotpSegmentPreviewRenderPlan,
  evaluateTotpRenderQc,
  filterTotpRenderReplays,
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

  it("builds the same full programme structure as interactive playback when continuity is frozen", () => {
    const audioAsset = (url: string, durationMs: number, script: string) => ({
      kind: "presenter_audio" as const,
      url,
      duration_ms: durationMs,
      sha256: "f".repeat(64),
      version: 1,
      script_checksum: manifestChecksum(canonicalise(script)),
    });
    const fullManifest: TotpEpisodeManifest = {
      ...manifest,
      presenter_dialogue: [
        { cue_id: "opening", kind: "opening", performance_id: null, script_text: "Welcome to Top of the Pops.", asset: audioAsset("https://audio/opening.wav", 6_000, "Welcome to Top of the Pops.") },
        { cue_id: "act:perf-1", kind: "act_intro", performance_id: "perf-1", script_text: "Here they are", asset: audioAsset("https://audio/p1.wav", 3_250, "Here they are") },
        { cue_id: "between:perf-1", kind: "between", performance_id: "perf-1", script_text: "What a performance. Up next, Neon Vows.", asset: audioAsset("https://audio/between.wav", 4_900, "What a performance. Up next, Neon Vows.") },
        { cue_id: "chart", kind: "chart", performance_id: null, script_text: "And now, let's take a look at this week's UK charts.", asset: audioAsset("https://audio/chart.wav", 5_500, "And now, let's take a look at this week's UK charts.") },
        { cue_id: "act:perf-2", kind: "act_intro", performance_id: "perf-2", script_text: "Please welcome Neon Vows", asset: audioAsset("https://audio/p2.wav", 2_500, "Please welcome Neon Vows") },
        { cue_id: "closing", kind: "closing", performance_id: null, script_text: "Thanks for joining us tonight.", asset: audioAsset("https://audio/closing.wav", 6_300, "Thanks for joining us tonight.") },
      ],
      chart_rundown: {
        episode_id: "episode-1",
        chart_snapshot_date: "2026-09-18",
        digital_sales: [{
          rank: 1, song_id: "song-1", band_id: "band-1", song_title: "Dead Radio", artist_name: "Shockmaster",
          trend: "up", trend_change: 2, weekly_plays: 12000,
        }],
        streaming: [{
          rank: 12, song_id: "song-2", band_id: "band-2", song_title: "Glass Parade", artist_name: "Neon Vows",
          trend: "new", trend_change: null, weekly_plays: 9000,
        }],
        digital_sales_count: 1,
        streaming_count: 1,
      },
      segments: [
        manifest.segments[0],
        {
          ...manifest.segments[1],
          presenter_intro: "Please welcome Neon Vows",
          assets: [
            { kind: "song_audio", url: "https://audio/2.mp3", duration_ms: 190_000, sha256: null, version: null, script_checksum: null },
            audioAsset("https://audio/p2.wav", 2_500, "Please welcome Neon Vows"),
          ],
        },
      ],
    };

    const plan = buildTotpRenderPlan(fullManifest);
    expect(plan.items.map((item) => item.kind)).toEqual([
      "opening_titles",
      "programme_continuity",
      "presenter_link",
      "performance",
      "applause",
      "studio_transition",
      "programme_continuity",
      "chart_rundown",
      "chart_rundown",
      "presenter_link",
      "performance",
      "applause",
      "programme_continuity",
      "end_credits",
    ]);
    expect(plan.items.filter((item) => item.kind === "programme_continuity").map((item) => item.dialogue_kind)).toEqual(["opening", "between", "closing"]);
    const chartItems = plan.items.filter((item) => item.kind === "chart_rundown");
    expect(chartItems).toHaveLength(2);
    expect(chartItems[0].duration_ms).toBe(5_500);
    expect(chartItems[0].audio_url).toBe("https://audio/chart.wav");
    expect(chartItems[1].duration_ms).toBe(5_000);
    expect(chartItems[1].audio_url).toBeNull();
    expect(plan.items.find((item) => item.kind === "studio_transition")).toEqual(expect.objectContaining({
      from_performance_id: "perf-1",
      to_performance_id: "perf-2",
      duration_ms: 3_200,
    }));
    expect(plan.chapters.some((chapter) => chapter.title === "UK chart rundown")).toBe(true);
    expect(plan.captions_vtt).toContain("Welcome to Top of the Pops.");
    expect(plan.captions_vtt).toContain("Digital Sales Top 40");
  });

  it("filters archived replays to only acts frozen into the render plan", () => {
    const plan = buildTotpRenderPlan(manifest);
    const kept = {
      performance_id: "perf-1",
      payload: { band: { name: "Shockmaster" } },
    };
    const removed = {
      performance_id: "removed-perf",
      payload: { band: { name: "Removed Act" } },
    };

    expect(filterTotpRenderReplays(plan, [kept, removed] as never)).toEqual([kept]);
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