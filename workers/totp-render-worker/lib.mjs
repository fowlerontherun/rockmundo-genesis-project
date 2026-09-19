import crypto from "node:crypto";

export const FPS = 30;
export const FRAME_MS = 1000 / FPS;

export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

export function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function sha256Buffer(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function locateFrame(plan, absoluteMs) {
  const ms = Math.max(0, Math.min(Math.max(0, plan.total_duration_ms - 1), absoluteMs));
  for (let index = plan.items.length - 1; index >= 0; index -= 1) {
    const item = plan.items[index];
    if (ms >= item.start_ms) {
      return { itemIndex: index, localMs: Math.max(0, Math.min(item.duration_ms - 1, ms - item.start_ms)) };
    }
  }
  return { itemIndex: 0, localMs: 0 };
}

export function frameCount(plan) {
  return Math.round((plan.total_duration_ms / 1000) * FPS);
}

function vttStamp(ms) {
  const total = Math.max(0, Math.round(ms));
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  return [hours, minutes, seconds].map((v) => String(v).padStart(2, "0")).join(":") + "." + String(millis).padStart(3, "0");
}

export function wrapCaption(text, max = 42) {
  const words = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= max || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2).join("\n");
}

export function buildWebVtt(plan, replays) {
  const byPerformance = new Map(replays.map((row) => [row.performance_id, row]));
  const cues = [];
  let sequence = 0;
  for (const item of plan.items) {
    if (!item.performance_id) continue;
    const replay = byPerformance.get(item.performance_id);
    if (!replay) continue;
    if (item.kind === "presenter_link") {
      const cue = replay.payload?.cues?.find((row) => row.type === "presenter" && row.presenterText);
      if (cue?.presenterText) cues.push({
        start: item.start_ms,
        end: Math.min(item.start_ms + item.duration_ms, item.start_ms + Math.max(1200, cue.durationMs ?? item.duration_ms)),
        text: wrapCaption(`${replay.payload.presenterDisplayName ?? "Presenter"}: ${cue.presenterText}`),
      });
    }
    if (item.kind === "performance") {
      const rank = replay.payload?.song?.qualifyingRank;
      const band = replay.payload?.band?.name;
      const song = replay.payload?.song?.title;
      if (band && song) cues.push({
        start: item.start_ms + 650,
        end: Math.min(item.start_ms + item.duration_ms, item.start_ms + 4_000),
        text: wrapCaption(`UK #${rank ?? "—"} — ${band}, “${song}”`),
      });
    }
    if (item.kind === "applause") cues.push({
      start: item.start_ms,
      end: item.start_ms + item.duration_ms,
      text: "[studio audience cheering and applauding]",
    });
  }
  const blocks = cues.map((cue) => {
    sequence += 1;
    return `${sequence}\n${vttStamp(cue.start)} --> ${vttStamp(cue.end)}\n${cue.text}`;
  });
  return ["WEBVTT", "", ...blocks].join("\n\n").trimEnd() + "\n";
}

export function chapterFile(plan) {
  const stamp = (ms) => {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0
      ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };
  return plan.chapters.map((row) => `${stamp(row.start_ms)} ${row.title}`).join("\n") + "\n";
}

export function evaluateProbe(plan, probe, diagnostics = {}) {
  const failures = [];
  const fail = (code, detail) => failures.push({ code, detail });
  const expectedFrames = frameCount(plan);
  const actualFrames = Number(probe.frame_count ?? 0);
  const frameDurationMs = 1000 / Number(plan.programme_spec.frame_rate || FPS);
  const videoDurationMs = Number(probe.video_duration_ms ?? probe.duration_ms ?? 0);
  const audioDurationMs = Number(probe.audio_duration_ms ?? probe.duration_ms ?? 0);

  if (Math.abs(Number(probe.duration_ms) - plan.total_duration_ms) > 1000) fail("duration_within_tolerance", `Rendered ${probe.duration_ms}ms against planned ${plan.total_duration_ms}ms.`);
  if (Number(probe.width) !== plan.programme_spec.width || Number(probe.height) !== plan.programme_spec.height) fail("resolution_matches_spec", `Got ${probe.width}x${probe.height}.`);
  if (Math.abs(Number(probe.frame_rate) - plan.programme_spec.frame_rate) > 0.02) fail("frame_rate_matches_spec", `Got ${probe.frame_rate}fps.`);
  if (actualFrames && Math.abs(actualFrames - expectedFrames) > 1) fail("frame_count_matches_timeline", `Got ${actualFrames} frames; expected ${expectedFrames}.`);
  if (!String(probe.video_codec ?? "").toLowerCase().includes("h264")) fail("video_codec_matches_spec", `Got ${probe.video_codec ?? "none"}.`);
  if (!String(probe.audio_codec ?? "").toLowerCase().includes("aac")) fail("audio_codec_matches_spec", `Got ${probe.audio_codec ?? "none"}.`);
  if (Number(probe.audio_channels) !== plan.programme_spec.audio_channels) fail("audio_channels_matches_spec", `Got ${probe.audio_channels ?? 0} channels.`);
  if (Number(probe.audio_sample_rate) !== 48_000) fail("audio_sample_rate", `Got ${probe.audio_sample_rate ?? 0}Hz; expected 48000Hz.`);
  if (Math.abs(videoDurationMs - audioDurationMs) > frameDurationMs) fail("audio_video_drift", `Audio/video end drift is ${Math.abs(videoDurationMs - audioDurationMs).toFixed(1)}ms.`);
  if (!Number.isFinite(Number(probe.programme_loudness_lufs)) || Math.abs(Number(probe.programme_loudness_lufs) - plan.loudness_target.programmeLoudnessLufs) > 1) fail("programme_loudness_in_range", `Got ${probe.programme_loudness_lufs ?? "unknown"} LUFS.`);
  if (!Number.isFinite(Number(probe.true_peak_dbtp)) || Number(probe.true_peak_dbtp) > plan.loudness_target.truePeakCeilingDbtp) fail("true_peak_below_ceiling", `Got ${probe.true_peak_dbtp ?? "unknown"} dBTP.`);
  if (Number(diagnostics.blackSeconds ?? 0) > 1.25) fail("black_frames", `Detected ${Number(diagnostics.blackSeconds).toFixed(2)}s of black frames.`);
  if (Number(diagnostics.freezeSeconds ?? 0) > 3) fail("frozen_frames", `Detected ${Number(diagnostics.freezeSeconds).toFixed(2)}s of frozen output.`);
  if (Number(diagnostics.silenceSeconds ?? 0) > Math.max(8, plan.total_duration_ms / 1000 * 0.2)) fail("missing_audio", `Detected ${Number(diagnostics.silenceSeconds).toFixed(2)}s of silence.`);
  if (Number(diagnostics.captionOverflow ?? 0) > 0) fail("caption_overflow", `${diagnostics.captionOverflow} caption lines exceed the safe layout.`);
  return { passed: failures.length === 0, failures };
}
