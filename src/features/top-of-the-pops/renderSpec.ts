import type { TotpEpisodeManifest } from "./episodeManifest";
import { TOTP_MIX_TARGET } from "./broadcastAudioMix";

/**
 * Phase 2 deterministic render plan.
 *
 * The plan turns an immutable episode manifest into an exact shot list with
 * timecodes, chapters, poster/thumbnail marks and delivery filenames. Building
 * it twice from the same manifest must produce identical output so a headless
 * worker can render a reproducible master file.
 */

export const TOTP_RENDER_PLAN_VERSION = 1 as const;

/** Fixed continuity allowances, in milliseconds. */
export const TOTP_RENDER_TIMING = Object.freeze({
  openingTitlesMs: 12_000,
  presenterLinkMs: 8_000,
  performanceFallbackMs: 180_000,
  audienceApplauseMs: 4_000,
  endCreditsMs: 14_000,
});

export type TotpRenderItemKind =
  | "opening_titles"
  | "presenter_link"
  | "performance"
  | "applause"
  | "end_credits";

export interface TotpRenderItem {
  index: number;
  kind: TotpRenderItemKind;
  label: string;
  start_ms: number;
  duration_ms: number;
  performance_id: string | null;
  audio_url: string | null;
}

export interface TotpRenderChapter {
  title: string;
  start_ms: number;
  end_ms: number;
}

export interface TotpRenderDelivery {
  master: string;
  proxy: string;
  poster: string;
  captions: string;
  chapters: string;
}

export interface TotpRenderQcCheck {
  code:
    | "duration_within_tolerance"
    | "resolution_matches_spec"
    | "frame_rate_matches_spec"
    | "video_codec_matches_spec"
    | "audio_codec_matches_spec"
    | "audio_channels_matches_spec"
    | "programme_loudness_in_range"
    | "true_peak_below_ceiling"
    | "chapters_present";
  description: string;
}

export interface TotpRenderPlan {
  plan_version: typeof TOTP_RENDER_PLAN_VERSION;
  episode_id: string;
  episode_number: number;
  manifest_checksum: string;
  programme_spec: TotpEpisodeManifest["programme_spec"];
  items: TotpRenderItem[];
  chapters: TotpRenderChapter[];
  total_duration_ms: number;
  poster_at_ms: number;
  thumbnail_at_ms: number[];
  delivery: TotpRenderDelivery;
  loudness_target: typeof TOTP_MIX_TARGET;
  qc_checks: TotpRenderQcCheck[];
}

const QC_CHECKS: TotpRenderQcCheck[] = [
  { code: "duration_within_tolerance", description: "Rendered duration is within 2 seconds of the planned runtime." },
  { code: "resolution_matches_spec", description: "Video is exactly 1920x1080." },
  { code: "frame_rate_matches_spec", description: "Video frame rate is 30fps." },
  { code: "video_codec_matches_spec", description: "Video stream is H.264." },
  { code: "audio_codec_matches_spec", description: "Audio stream is AAC." },
  { code: "audio_channels_matches_spec", description: "Audio is stereo." },
  { code: "programme_loudness_in_range", description: "Programme loudness is -14 LUFS +/- 1.0 LU." },
  { code: "true_peak_below_ceiling", description: "True peak does not exceed -1 dBTP." },
  { code: "chapters_present", description: "One chapter exists for every act plus titles and credits." },
];

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "episode";
}

export function buildTotpRenderPlan(manifest: TotpEpisodeManifest): TotpRenderPlan {
  const items: TotpRenderItem[] = [];
  const chapters: TotpRenderChapter[] = [];
  let cursor = 0;

  const push = (item: Omit<TotpRenderItem, "index" | "start_ms">): TotpRenderItem => {
    const entry: TotpRenderItem = { ...item, index: items.length, start_ms: cursor };
    items.push(entry);
    cursor += Math.max(0, item.duration_ms);
    return entry;
  };

  const titles = push({
    kind: "opening_titles",
    label: "Opening titles",
    duration_ms: TOTP_RENDER_TIMING.openingTitlesMs,
    performance_id: null,
    audio_url: null,
  });
  chapters.push({ title: "Opening titles", start_ms: titles.start_ms, end_ms: cursor });

  manifest.segments.forEach((segment, position) => {
    const presenterAsset = segment.assets.find((asset) => asset.kind === "presenter_audio") ?? null;
    const link = push({
      kind: "presenter_link",
      label: `Presenter link ${position + 1}`,
      duration_ms:
        presenterAsset?.duration_ms && presenterAsset.duration_ms > 0
          ? presenterAsset.duration_ms
          : TOTP_RENDER_TIMING.presenterLinkMs,
      performance_id: segment.performance_id,
      audio_url: presenterAsset?.url ?? null,
    });

    const songAsset = segment.assets.find((asset) => asset.kind === "song_audio") ?? null;
    push({
      kind: "performance",
      label: `${segment.band_name} — ${segment.song_title}`,
      duration_ms: songAsset?.duration_ms && songAsset.duration_ms > 0 ? songAsset.duration_ms : TOTP_RENDER_TIMING.performanceFallbackMs,
      performance_id: segment.performance_id,
      audio_url: songAsset?.url ?? null,
    });

    push({
      kind: "applause",
      label: "Studio applause",
      duration_ms: TOTP_RENDER_TIMING.audienceApplauseMs,
      performance_id: segment.performance_id,
      audio_url: null,
    });

    chapters.push({
      title: `${position + 1}. ${segment.band_name} — ${segment.song_title}`,
      start_ms: link.start_ms,
      end_ms: cursor,
    });
  });

  const credits = push({
    kind: "end_credits",
    label: "End credits",
    duration_ms: TOTP_RENDER_TIMING.endCreditsMs,
    performance_id: null,
    audio_url: null,
  });
  chapters.push({ title: "End credits", start_ms: credits.start_ms, end_ms: cursor });

  const base = `totp-episode-${String(manifest.episode_number).padStart(3, "0")}-${slug(manifest.episode_date)}`;
  const firstPerformance = items.find((item) => item.kind === "performance");
  const posterAt = firstPerformance ? firstPerformance.start_ms + Math.floor(firstPerformance.duration_ms / 2) : Math.floor(cursor / 2);

  return {
    plan_version: TOTP_RENDER_PLAN_VERSION,
    episode_id: manifest.episode_id,
    episode_number: manifest.episode_number,
    manifest_checksum: manifest.checksum,
    programme_spec: manifest.programme_spec,
    items,
    chapters,
    total_duration_ms: cursor,
    poster_at_ms: posterAt,
    thumbnail_at_ms: items
      .filter((item) => item.kind === "performance")
      .map((item) => item.start_ms + Math.floor(item.duration_ms / 3)),
    delivery: {
      master: `${base}-master.mp4`,
      proxy: `${base}-proxy.mp4`,
      poster: `${base}-poster.jpg`,
      captions: `${base}.vtt`,
      chapters: `${base}-chapters.txt`,
    },
    loudness_target: TOTP_MIX_TARGET,
    qc_checks: QC_CHECKS,
  };
}

export interface TotpRenderProbe {
  duration_ms: number;
  width: number;
  height: number;
  frame_rate: number;
  video_codec: string;
  audio_codec: string;
  audio_channels: number;
  programme_loudness_lufs: number;
  true_peak_dbtp: number;
  chapter_count: number;
}

export interface TotpRenderQcResult {
  passed: boolean;
  failures: { code: TotpRenderQcCheck["code"]; detail: string }[];
}

export function evaluateTotpRenderQc(plan: TotpRenderPlan, probe: TotpRenderProbe): TotpRenderQcResult {
  const failures: TotpRenderQcResult["failures"] = [];
  const fail = (code: TotpRenderQcCheck["code"], detail: string) => failures.push({ code, detail });

  if (Math.abs(probe.duration_ms - plan.total_duration_ms) > 2_000) {
    fail("duration_within_tolerance", `Rendered ${probe.duration_ms}ms against planned ${plan.total_duration_ms}ms.`);
  }
  if (probe.width !== plan.programme_spec.width || probe.height !== plan.programme_spec.height) {
    fail("resolution_matches_spec", `Got ${probe.width}x${probe.height}.`);
  }
  if (Math.abs(probe.frame_rate - plan.programme_spec.frame_rate) > 0.05) {
    fail("frame_rate_matches_spec", `Got ${probe.frame_rate}fps.`);
  }
  if (!probe.video_codec.toLowerCase().includes("h264") && !probe.video_codec.toLowerCase().includes("avc")) {
    fail("video_codec_matches_spec", `Got ${probe.video_codec}.`);
  }
  if (!probe.audio_codec.toLowerCase().includes("aac")) {
    fail("audio_codec_matches_spec", `Got ${probe.audio_codec}.`);
  }
  if (probe.audio_channels !== plan.programme_spec.audio_channels) {
    fail("audio_channels_matches_spec", `Got ${probe.audio_channels} channels.`);
  }
  if (Math.abs(probe.programme_loudness_lufs - plan.loudness_target.programmeLoudnessLufs) > 1) {
    fail("programme_loudness_in_range", `Got ${probe.programme_loudness_lufs} LUFS.`);
  }
  if (probe.true_peak_dbtp > plan.loudness_target.truePeakCeilingDbtp) {
    fail("true_peak_below_ceiling", `Got ${probe.true_peak_dbtp} dBTP.`);
  }
  if (probe.chapter_count !== plan.chapters.length) {
    fail("chapters_present", `Got ${probe.chapter_count} of ${plan.chapters.length} chapters.`);
  }

  return { passed: failures.length === 0, failures };
}

/** YouTube-style chapter list, one line per chapter, always starting at 00:00. */
export function toTotpChapterFile(plan: TotpRenderPlan): string {
  const stamp = (ms: number) => {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (value: number) => String(value).padStart(2, "0");
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  };
  return plan.chapters.map((chapter) => `${stamp(chapter.start_ms)} ${chapter.title}`).join("\n");
}
