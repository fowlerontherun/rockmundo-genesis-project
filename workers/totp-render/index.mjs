import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import { renderGateway } from "./gateway.mjs";

const FFMPEG = process.env.FFMPEG_BIN || "ffmpeg";
const FFPROBE = process.env.FFPROBE_BIN || "ffprobe";
const APP_ORIGIN = (process.env.ROCKMUNDO_APP_ORIGIN || "http://127.0.0.1:4173").replace(/\/$/, "");
const BUCKET = "totp-broadcast-masters";
const TUS_CHUNK = 6 * 1024 * 1024;

export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

export function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function sha256File(file) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(file), hash);
  return hash.digest("hex");
}

async function run(command, args, options = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 || options.allowFailure) resolve({ code, stdout, stderr });
      else reject(new Error(`${command} failed (${code}): ${stderr.slice(-6000)}`));
    });
  });
}

function parseFraction(value) {
  if (!value) return 0;
  if (!String(value).includes("/")) return Number(value) || 0;
  const [a, b] = String(value).split("/").map(Number);
  return b ? a / b : 0;
}

async function fetchToFile(url, destination) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Could not download render media ${url} (${response.status}).`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
}

async function ensureDownloaded(url, directory, cache) {
  if (!url) return null;
  if (cache.has(url)) return cache.get(url);
  const target = path.join(directory, `media-${String(cache.size + 1).padStart(3, "0")}.bin`);
  await fetchToFile(url, target);
  cache.set(url, target);
  return target;
}

async function mediaHasAudio(file) {
  if (!file) return false;
  const result = await run(FFPROBE, [
    "-v", "error",
    "-select_streams", "a:0",
    "-show_entries", "stream=index",
    "-of", "csv=p=0",
    file,
  ], { allowFailure: true });
  return result.code === 0 && result.stdout.trim().length > 0;
}

function seedFor(value) {
  return parseInt(sha256Text(value).slice(0, 8), 16) >>> 0;
}

function selectCrowdSound(sounds, types, seed) {
  const candidates = (Array.isArray(sounds) ? sounds : [])
    .filter((sound) => types.includes(String(sound.sound_type)) && sound.audio_url)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (!candidates.length) return null;
  return candidates[seedFor(seed) % candidates.length];
}

async function buildAudioSegment({ item, index, directory, mediaCache, productionMedia, crowdSounds, manifestChecksum }) {
  const seconds = Math.max(0.05, Number(item.duration_ms) / 1000);
  const output = path.join(directory, `audio-${String(index).padStart(3, "0")}.wav`);
  const seed = seedFor(`${manifestChecksum}:${index}:${item.kind}`);

  let mainUrl = item.audio_url || null;
  let mainGain = 0.8;
  let mainRequired = false;
  let bedTypes = ["ambient_chatter"];

  if (item.kind === "performance") {
    mainGain = 0.9;
    mainRequired = true;
  } else if (item.kind === "presenter_link") {
    mainGain = 0.95;
    mainRequired = true;
  } else if (item.kind === "opening_titles") {
    mainUrl = productionMedia?.programme_intro?.url || productionMedia?.opening?.url || null;
    mainGain = 0.72;
  } else if (item.kind === "end_credits") {
    mainUrl = productionMedia?.closing?.url || null;
    mainGain = 0.76;
  } else if (item.kind === "applause") {
    const applause = selectCrowdSound(crowdSounds, ["applause", "crowd_cheer_large", "crowd_cheer_medium"], `${manifestChecksum}:applause:${index}`);
    mainUrl = applause?.audio_url || null;
    mainGain = 0.72;
    bedTypes = [];
  }

  const ambient = bedTypes.length
    ? selectCrowdSound(crowdSounds, bedTypes, `${manifestChecksum}:bed:${index}`)
    : null;
  let mainPath = await ensureDownloaded(mainUrl, directory, mediaCache);
  let bedPath = await ensureDownloaded(ambient?.audio_url || null, directory, mediaCache);

  if (mainPath && !(await mediaHasAudio(mainPath))) {
    if (mainRequired) throw new Error(`${item.label} has a source file with no audio stream.`);
    mainPath = null;
  }
  if (bedPath && !(await mediaHasAudio(bedPath))) bedPath = null;

  const commonOut = ["-ar", "48000", "-ac", "2", "-c:a", "pcm_s24le", "-t", seconds.toFixed(3), output];

  if (mainPath && bedPath) {
    await run(FFMPEG, [
      "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
      "-i", mainPath,
      "-stream_loop", "-1", "-i", bedPath,
      "-filter_complex",
      `[0:a]aresample=48000,aformat=channel_layouts=stereo,volume=${mainGain},apad,atrim=0:${seconds.toFixed(3)}[main];[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.045,atrim=0:${seconds.toFixed(3)}[bed];[main][bed]amix=inputs=2:normalize=0,atrim=0:${seconds.toFixed(3)},asetpts=N/SR/TB[out]`,
      "-map", "[out]",
      ...commonOut,
    ]);
    return output;
  }

  if (mainPath) {
    await run(FFMPEG, [
      "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
      "-i", mainPath,
      "-f", "lavfi", "-i", `anoisesrc=color=pink:amplitude=0.003:seed=${seed}:sample_rate=48000`,
      "-filter_complex",
      `[0:a]aresample=48000,aformat=channel_layouts=stereo,volume=${mainGain},apad,atrim=0:${seconds.toFixed(3)}[main];[1:a]pan=stereo|c0=c0|c1=c0,atrim=0:${seconds.toFixed(3)}[bed];[main][bed]amix=inputs=2:normalize=0,atrim=0:${seconds.toFixed(3)},asetpts=N/SR/TB[out]`,
      "-map", "[out]",
      ...commonOut,
    ]);
    return output;
  }

  if (mainRequired) throw new Error(`${item.label} is missing approved broadcast audio.`);

  if (bedPath) {
    await run(FFMPEG, [
      "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
      "-stream_loop", "-1", "-i", bedPath,
      "-af", `aresample=48000,aformat=channel_layouts=stereo,volume=0.2,atrim=0:${seconds.toFixed(3)},asetpts=N/SR/TB`,
      ...commonOut,
    ]);
    return output;
  }

  const amplitude = item.kind === "applause" ? 0.045 : 0.008;
  await run(FFMPEG, [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-f", "lavfi", "-i", `anoisesrc=color=pink:amplitude=${amplitude}:seed=${seed}:sample_rate=48000`,
    "-af", `pan=stereo|c0=c0|c1=c0,atrim=0:${seconds.toFixed(3)},afade=t=in:st=0:d=0.15,afade=t=out:st=${Math.max(0, seconds - 0.3).toFixed(3)}:d=0.3`,
    ...commonOut,
  ]);
  return output;
}

function concatEscape(value) {
  return value.replace(/'/g, "'\\''");
}

async function normalizeProgrammeAudio(input, output) {
  const analysis = await run(FFMPEG, [
    "-hide_banner", "-nostdin", "-i", input,
    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
    "-f", "null", "-",
  ]);
  const blocks = analysis.stderr.match(/\{\s*"input_i"[\s\S]*?"target_offset"\s*:\s*"[^"]+"\s*\}/g);
  if (!blocks?.length) throw new Error("FFmpeg did not return loudness analysis.");
  const measured = JSON.parse(blocks.at(-1));
  const filter = [
    "loudnorm=I=-14:TP=-1.5:LRA=11",
    `measured_I=${measured.input_i}`,
    `measured_LRA=${measured.input_lra}`,
    `measured_TP=${measured.input_tp}`,
    `measured_thresh=${measured.input_thresh}`,
    `offset=${measured.target_offset}`,
    "linear=true",
    "print_format=summary",
  ].join(":");
  await run(FFMPEG, [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-i", input,
    "-af", filter,
    "-ar", "48000", "-ac", "2", "-c:a", "pcm_s24le",
    output,
  ]);
}

function metadataEscape(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/=/g, "\\=")
    .replace(/;/g, "\\;")
    .replace(/#/g, "\\#")
    .replace(/\n/g, " ");
}

function formatVttTimestamp(ms) {
  const value = Math.max(0, Math.round(ms));
  const h = Math.floor(value / 3600000);
  const m = Math.floor((value % 3600000) / 60000);
  const s = Math.floor((value % 60000) / 1000);
  const x = value % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(x).padStart(3, "0")}`;
}

function splitCaption(text, max = 52) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines;
}

export function buildWorkerCaptions(manifest, plan) {
  const segments = new Map((manifest.segments || []).map((segment) => [segment.performance_id, segment]));
  const cues = [];
  let id = 0;
  for (const item of plan.items || []) {
    if (item.kind === "opening_titles") {
      cues.push({ id: ++id, startMs: item.start_ms, endMs: Math.min(item.start_ms + item.duration_ms, item.start_ms + 4500), text: "[opening theme]" });
    } else if (item.kind === "presenter_link") {
      const segment = segments.get(item.performance_id);
      const chunks = splitCaption(segment?.presenter_intro || "");
      const chunkMs = chunks.length ? item.duration_ms / chunks.length : 0;
      chunks.forEach((text, index) => cues.push({
        id: ++id,
        startMs: Math.round(item.start_ms + index * chunkMs),
        endMs: Math.round(item.start_ms + (index + 1) * chunkMs),
        text,
      }));
    } else if (item.kind === "performance") {
      const segment = segments.get(item.performance_id);
      if (segment) cues.push({
        id: ++id,
        startMs: item.start_ms,
        endMs: Math.min(item.start_ms + item.duration_ms, item.start_ms + 5000),
        text: `[music] UK #${segment.qualifying_rank} — ${segment.band_name}, “${segment.song_title}”`,
      });
    } else if (item.kind === "applause") {
      cues.push({ id: ++id, startMs: item.start_ms, endMs: item.start_ms + item.duration_ms, text: "[studio audience applauding]" });
    } else if (item.kind === "end_credits") {
      cues.push({ id: ++id, startMs: item.start_ms, endMs: Math.min(item.start_ms + item.duration_ms, item.start_ms + 5000), text: "[closing music]" });
    }
  }
  return cues;
}

export function captionIssues(cues) {
  const issues = [];
  for (const cue of cues) {
    const duration = Math.max(1, cue.endMs - cue.startMs);
    if (duration < 800) issues.push({ id: cue.id, code: "too_short" });
    if (cue.text.length > 96) issues.push({ id: cue.id, code: "too_long" });
    if ((cue.text.length / duration) * 1000 > 25) issues.push({ id: cue.id, code: "too_fast" });
  }
  return issues;
}

function vttFromCues(cues) {
  return ["WEBVTT", "", ...cues.map((cue) =>
    `${cue.id}\n${formatVttTimestamp(cue.startMs)} --> ${formatVttTimestamp(cue.endMs)}\n${cue.text}`
  )].join("\n\n").trimEnd() + "\n";
}

function chaptersText(plan) {
  const stamp = (ms) => {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const hh = h > 0 ? `${String(h).padStart(2, "0")}:` : "";
    return `${hh}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };
  return (plan.chapters || []).map((chapter) => `${stamp(chapter.start_ms)} ${chapter.title}`).join("\n") + "\n";
}

function ffmetadata(plan) {
  const blocks = [";FFMETADATA1"];
  for (const chapter of plan.chapters || []) {
    blocks.push(
      "[CHAPTER]",
      "TIMEBASE=1/1000",
      `START=${Math.round(chapter.start_ms)}`,
      `END=${Math.round(chapter.end_ms)}`,
      `title=${metadataEscape(chapter.title)}`,
    );
  }
  return blocks.join("\n") + "\n";
}

async function seekRenderFrame(page, programmeMs) {
  await page.evaluate(async (ms) => {
    if (!window.__TOTP_RENDER_SEEK__) throw new Error("Render surface seek API is unavailable.");
    window.__TOTP_RENDER_SEEK__(ms);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    for (const animation of document.getAnimations()) {
      try {
        animation.pause();
        animation.currentTime = ms;
      } catch {
        // Some browser-owned animations cannot be controlled; they are ignored.
      }
    }
  }, programmeMs);
  await page.waitForFunction((ms) => {
    const frame = document.querySelector("[data-totp-render-frame]");
    return frame?.getAttribute("data-totp-render-frame") === String(ms);
  }, programmeMs, { timeout: 10000 });
  const fatal = await page.evaluate(() => window.__TOTP_RENDER_FATAL__ || null);
  if (fatal) throw new Error(String(fatal));
}

async function encodeFrames({ page, plan, videoPath, heartbeat }) {
  const fps = Number(plan.programme_spec.frame_rate || 30);
  const frameCount = Math.round((Number(plan.total_duration_ms) / 1000) * fps);
  const child = spawn(FFMPEG, [
    "-hide_banner", "-loglevel", "warning", "-nostdin", "-y",
    "-f", "image2pipe", "-framerate", String(fps), "-vcodec", "mjpeg", "-i", "pipe:0",
    "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "17",
    "-pix_fmt", "yuv420p", "-r", String(fps), "-fps_mode", "cfr",
    "-frames:v", String(frameCount), "-threads", "1",
    "-map_metadata", "-1", "-metadata", "creation_time=1970-01-01T00:00:00Z",
    videoPath,
  ], { stdio: ["pipe", "ignore", "pipe"] });

  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  const exit = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`Frame encoder failed (${code}): ${stderr.slice(-6000)}`)));
  });

  let lastHeartbeat = Date.now();
  for (let frame = 0; frame < frameCount; frame += 1) {
    const ms = Math.min(Number(plan.total_duration_ms) - 1, Math.floor((frame * 1000) / fps));
    await seekRenderFrame(page, ms);
    const jpeg = await page.screenshot({ type: "jpeg", quality: 92, animations: "disabled" });
    if (!child.stdin.write(jpeg)) await once(child.stdin, "drain");

    if (Date.now() - lastHeartbeat > 30000 || frame === frameCount - 1) {
      const progress = Math.max(2, Math.min(72, Math.round((frame / Math.max(1, frameCount - 1)) * 70) + 2));
      await heartbeat(progress);
      lastHeartbeat = Date.now();
    }
  }
  child.stdin.end();
  await exit;
  return frameCount;
}

async function captureStill(page, ms, destination) {
  await seekRenderFrame(page, Math.max(0, ms));
  await page.screenshot({ path: destination, type: "jpeg", quality: 94, animations: "disabled" });
}

async function buildAudio({ plan, manifest, directory, productionMedia, crowdSounds, heartbeat }) {
  const mediaCache = new Map();
  const segments = [];
  for (let index = 0; index < plan.items.length; index += 1) {
    segments.push(await buildAudioSegment({
      item: plan.items[index],
      index,
      directory,
      mediaCache,
      productionMedia,
      crowdSounds,
      manifestChecksum: manifest.checksum,
    }));
    if (index % 2 === 0) await heartbeat(74 + Math.min(8, Math.round((index / Math.max(1, plan.items.length)) * 8)));
  }
  const concatFile = path.join(directory, "audio-concat.txt");
  await writeFile(concatFile, segments.map((file) => `file '${concatEscape(file)}'`).join("\n") + "\n");
  const raw = path.join(directory, "programme-raw.wav");
  await run(FFMPEG, [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-f", "concat", "-safe", "0", "-i", concatFile,
    "-c:a", "pcm_s24le", "-ar", "48000", "-ac", "2",
    raw,
  ]);
  const normalized = path.join(directory, "programme-normalized.wav");
  await normalizeProgrammeAudio(raw, normalized);
  return normalized;
}

async function probeMaster(master, plan, captionIssueCount) {
  const probeResult = await run(FFPROBE, [
    "-v", "error", "-count_frames",
    "-show_streams", "-show_format", "-show_chapters",
    "-of", "json", master,
  ]);
  const parsed = JSON.parse(probeResult.stdout);
  const video = (parsed.streams || []).find((stream) => stream.codec_type === "video") || {};
  const audio = (parsed.streams || []).find((stream) => stream.codec_type === "audio") || {};

  const loud = await run(FFMPEG, [
    "-hide_banner", "-nostdin", "-i", master,
    "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json",
    "-f", "null", "-",
  ]);
  const loudBlocks = loud.stderr.match(/\{\s*"input_i"[\s\S]*?"target_offset"\s*:\s*"[^"]+"\s*\}/g);
  if (!loudBlocks?.length) throw new Error("Could not measure final programme loudness.");
  const loudness = JSON.parse(loudBlocks.at(-1));

  const detect = await run(FFMPEG, [
    "-hide_banner", "-nostdin", "-i", master,
    "-vf", "blackdetect=d=0.8:pic_th=0.9999:pix_th=0.02,freezedetect=n=-50dB:d=12",
    "-af", "silencedetect=n=-50dB:d=2.5",
    "-f", "null", "-",
  ]);
  const blackFrames = (detect.stderr.match(/black_start:/g) || []).length;
  const frozenFrames = (detect.stderr.match(/freeze_start:/g) || []).length;
  const silenceGaps = (detect.stderr.match(/silence_start:/g) || []).length;

  return {
    duration_ms: Math.round(Number(parsed.format?.duration || video.duration || 0) * 1000),
    width: Number(video.width || 0),
    height: Number(video.height || 0),
    frame_rate: parseFraction(video.avg_frame_rate || video.r_frame_rate),
    video_codec: String(video.codec_name || ""),
    audio_codec: String(audio.codec_name || ""),
    audio_channels: Number(audio.channels || 0),
    programme_loudness_lufs: Number(loudness.input_i),
    true_peak_dbtp: Number(loudness.input_tp),
    chapter_count: Array.isArray(parsed.chapters) ? parsed.chapters.length : 0,
    frame_count: Number(video.nb_read_frames || video.nb_frames || 0),
    video_duration_ms: Math.round(Number(video.duration || parsed.format?.duration || 0) * 1000),
    audio_duration_ms: Math.round(Number(audio.duration || parsed.format?.duration || 0) * 1000),
    audio_sample_rate: Number(audio.sample_rate || 0),
    black_frame_count: blackFrames,
    frozen_frame_count: frozenFrames,
    silence_gap_count: silenceGaps,
    caption_issues: captionIssueCount,
    video_bitrate: Number(video.bit_rate || 0) || null,
    ffprobe_format: parsed.format?.format_name || null,
  };
}

export function evaluateWorkerQc(plan, probe) {
  const failures = [];
  const fail = (code, detail) => failures.push({ code, detail });
  if (Math.abs(probe.duration_ms - plan.total_duration_ms) > 2000) fail("duration_within_tolerance", `Rendered ${probe.duration_ms}ms against planned ${plan.total_duration_ms}ms.`);
  if (probe.width !== 1920 || probe.height !== 1080) fail("resolution_matches_spec", `Got ${probe.width}x${probe.height}.`);
  if (Math.abs(probe.frame_rate - 30) > 0.05) fail("frame_rate_matches_spec", `Got ${probe.frame_rate}fps.`);
  if (!probe.video_codec.toLowerCase().includes("h264")) fail("video_codec_matches_spec", `Got ${probe.video_codec}.`);
  if (!probe.audio_codec.toLowerCase().includes("aac")) fail("audio_codec_matches_spec", `Got ${probe.audio_codec}.`);
  if (probe.audio_channels !== 2) fail("audio_channels_matches_spec", `Got ${probe.audio_channels} channels.`);
  if (Math.abs(probe.programme_loudness_lufs - (-14)) > 1) fail("programme_loudness_in_range", `Got ${probe.programme_loudness_lufs} LUFS.`);
  if (probe.true_peak_dbtp > -1) fail("true_peak_below_ceiling", `Got ${probe.true_peak_dbtp} dBTP.`);
  if (probe.chapter_count !== plan.chapters.length) fail("chapters_present", `Got ${probe.chapter_count} of ${plan.chapters.length} chapters.`);
  const expectedFrames = Math.round((plan.total_duration_ms / 1000) * 30);
  if (probe.frame_count !== expectedFrames) fail("frame_count_matches", `Got ${probe.frame_count} frames; expected ${expectedFrames}.`);
  if (probe.audio_sample_rate !== 48000) fail("audio_sample_rate_matches", `Got ${probe.audio_sample_rate} Hz.`);
  const drift = Math.abs(probe.video_duration_ms - probe.audio_duration_ms);
  if (drift >= 1000 / 30) fail("audio_video_drift_under_frame", `Audio/video end drift is ${drift}ms.`);
  if (probe.black_frame_count > 0) fail("no_black_frames", `Detected ${probe.black_frame_count} black-frame section(s).`);
  if (probe.frozen_frame_count > 0) fail("no_frozen_frames", `Detected ${probe.frozen_frame_count} frozen-frame section(s).`);
  if (probe.silence_gap_count > 0) fail("no_silence_gaps", `Detected ${probe.silence_gap_count} silence gap(s) longer than 2.5 seconds.`);
  if (probe.caption_issues > 0) fail("captions_valid", `Caption QC reported ${probe.caption_issues} issue(s).`);
  return { passed: failures.length === 0, failures };
}

function b64(value) {
  return Buffer.from(String(value), "utf8").toString("base64");
}

async function tusUpload({ file, storagePath, contentType, token, endpoint, publishableKey, onProgress }) {
  const size = (await stat(file)).size;
  const metadata = [
    ["bucketName", BUCKET],
    ["objectName", storagePath],
    ["contentType", contentType],
    ["cacheControl", "31536000"],
  ].map(([key, value]) => `${key} ${b64(value)}`).join(",");

  const create = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${publishableKey}`,
      apikey: publishableKey,
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(size),
      "Upload-Metadata": metadata,
      "x-signature": token,
      "x-upsert": "false",
    },
  });
  if (!create.ok) throw new Error(`Could not start resumable artifact upload (${create.status}): ${await create.text()}`);
  const locationHeader = create.headers.get("location");
  if (!locationHeader) throw new Error("Supabase Storage did not return a TUS upload location.");
  const uploadUrl = new URL(locationHeader, endpoint).toString();

  const handle = await open(file, "r");
  try {
    let offset = 0;
    while (offset < size) {
      const length = Math.min(TUS_CHUNK, size - offset);
      const buffer = Buffer.allocUnsafe(length);
      const { bytesRead } = await handle.read(buffer, 0, length, offset);
      if (!bytesRead) throw new Error("Unexpected end of render artifact while uploading.");

      let response = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        response = await fetch(uploadUrl, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${publishableKey}`,
            apikey: publishableKey,
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": String(offset),
            "Content-Type": "application/offset+octet-stream",
            "x-signature": token,
          },
          body: buffer.subarray(0, bytesRead),
        });
        if (response.ok) break;
        if (attempt === 4) break;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        const head = await fetch(uploadUrl, {
          method: "HEAD",
          headers: {
            Authorization: `Bearer ${publishableKey}`,
            apikey: publishableKey,
            "Tus-Resumable": "1.0.0",
            "x-signature": token,
          },
        });
        const serverOffset = Number(head.headers.get("upload-offset"));
        if (head.ok && Number.isFinite(serverOffset)) offset = serverOffset;
      }
      if (!response?.ok) throw new Error(`Artifact upload failed (${response?.status}): ${await response?.text()}`);
      const serverOffset = Number(response.headers.get("upload-offset"));
      offset = Number.isFinite(serverOffset) ? serverOffset : offset + bytesRead;
      await onProgress?.(offset, size);
    }
  } finally {
    await handle.close();
  }
}

async function uploadArtifact(job, file, kind, contentType, label, heartbeat) {
  const sha256 = await sha256File(file);
  const filename = path.basename(file);
  const storagePath = `${job.episode_id}/${job.manifest_checksum}/${sha256}/${filename}`;
  const token = await renderGateway("upload_token", {
    job_id: job.id,
    sha256,
    storage_path: storagePath,
    content_type: contentType,
  });

  if (!token.exists) {
    let lastBeat = Date.now();
    await tusUpload({
      file,
      storagePath,
      contentType,
      token: token.token,
      endpoint: token.tus_endpoint,
      publishableKey: token.publishable_key,
      onProgress: async () => {
        if (Date.now() - lastBeat > 30000) {
          await heartbeat(94);
          lastBeat = Date.now();
        }
      },
    });
  }

  return {
    kind,
    filename,
    storage_path: storagePath,
    url: null,
    label,
    bytes: (await stat(file)).size,
    sha256,
  };
}

async function loadClaim() {
  const claimFile = process.env.TOTP_RENDER_CLAIM_FILE;
  if (claimFile) return JSON.parse(await readFile(claimFile, "utf8"));
  return await renderGateway("claim");
}

async function main() {
  const claim = await loadClaim();
  if (!claim?.job?.id) {
    console.log("No TOTP render job is waiting.");
    return;
  }

  const job = claim.job;
  const manifest = claim.manifest;
  const plan = job.plan;
  const replays = claim.replays || [];
  const productionMedia = claim.production_media || {};
  const crowdSounds = claim.crowd_sounds || [];
  let finalized = false;
  const workdir = await mkdtemp(path.join(tmpdir(), `totp-${job.id}-`));

  const heartbeat = async (progress) => {
    await renderGateway("heartbeat", { job_id: job.id, progress_percent: progress });
  };

  try {
    if (!manifest || manifest.checksum !== job.manifest_checksum) throw new Error("Manifest checksum does not match the claimed render job.");
    if (!plan?.items?.length || !plan?.programme_spec) throw new Error("Render plan is empty or invalid.");

    const timelineSha256 = sha256Text(stableStringify(plan));
    const inputSha256 = sha256Text(stableStringify({
      manifest,
      plan,
      replay_fingerprints: replays.map((replay) => ({
        id: replay.id,
        performance_id: replay.performance_id,
        checksum: replay.checksum,
        replay_version: replay.replay_version,
      })),
      production_media: productionMedia,
      crowd_sounds: crowdSounds.map((sound) => ({
        id: sound.id,
        sound_type: sound.sound_type,
        audio_url: sound.audio_url,
        duration_seconds: sound.duration_seconds,
      })),
    }));

    const captions = buildWorkerCaptions(manifest, plan);
    const captionQc = captionIssues(captions);
    const captionsPath = path.join(workdir, plan.delivery.captions);
    const chaptersPath = path.join(workdir, plan.delivery.chapters);
    const chapterMetaPath = path.join(workdir, "chapters.ffmeta");
    await writeFile(captionsPath, vttFromCues(captions));
    await writeFile(chaptersPath, chaptersText(plan));
    await writeFile(chapterMetaPath, ffmetadata(plan));

    await heartbeat(2);
    const browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage", "--use-angle=swiftshader"] });
    let page;
    try {
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
      });
      page = await context.newPage();
      await page.addInitScript((payload) => {
        window.__TOTP_RENDER_INPUT__ = payload;
      }, { manifest, plan, replays });
      await page.goto(`${APP_ORIGIN}/`, { waitUntil: "networkidle", timeout: 120000 });
      await page.evaluate(() => {
        history.replaceState({}, "", "/internal/totp-render");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      await page.waitForFunction(() => window.__TOTP_RENDER_READY__ === true, null, { timeout: 120000 });

      const videoOnly = path.join(workdir, "video-only.mp4");
      await encodeFrames({ page, plan, videoPath: videoOnly, heartbeat });

      const posterPath = path.join(workdir, plan.delivery.poster);
      await captureStill(page, plan.poster_at_ms, posterPath);
      const thumbnailPaths = [];
      for (let index = 0; index < Math.min(4, plan.thumbnail_at_ms.length); index += 1) {
        const filename = plan.delivery.poster.replace(/-poster\.jpg$/i, `-thumbnail-${index + 1}.jpg`);
        const target = path.join(workdir, filename);
        await captureStill(page, plan.thumbnail_at_ms[index], target);
        thumbnailPaths.push(target);
      }

      await heartbeat(74);
      const audio = await buildAudio({ plan, manifest, directory: workdir, productionMedia, crowdSounds, heartbeat });

      const masterPath = path.join(workdir, plan.delivery.master);
      await run(FFMPEG, [
        "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
        "-i", videoOnly, "-i", audio, "-i", chapterMetaPath,
        "-map", "0:v:0", "-map", "1:a:0",
        "-map_metadata", "-1", "-map_chapters", "2",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        "-t", (plan.total_duration_ms / 1000).toFixed(3),
        "-movflags", "+faststart",
        "-metadata", "creation_time=1970-01-01T00:00:00Z",
        masterPath,
      ]);

      const proxyPath = path.join(workdir, plan.delivery.proxy);
      await run(FFMPEG, [
        "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
        "-i", masterPath,
        "-vf", "scale=1280:720:flags=lanczos",
        "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-threads", "1",
        "-c:a", "aac", "-b:a", "160k",
        "-map_metadata", "-1", "-metadata", "creation_time=1970-01-01T00:00:00Z",
        "-movflags", "+faststart",
        proxyPath,
      ]);

      await heartbeat(86);
      const probe = await probeMaster(masterPath, plan, captionQc.length);
      const qc = evaluateWorkerQc(plan, probe);
      const masterSha256 = await sha256File(masterPath);

      const artifacts = [];
      artifacts.push(await uploadArtifact(job, masterPath, "master", "video/mp4", "1080p master", heartbeat));
      artifacts.push(await uploadArtifact(job, proxyPath, "proxy", "video/mp4", "720p preview", heartbeat));
      artifacts.push(await uploadArtifact(job, posterPath, "poster", "image/jpeg", "Poster", heartbeat));
      for (let index = 0; index < thumbnailPaths.length; index += 1) {
        artifacts.push(await uploadArtifact(job, thumbnailPaths[index], "thumbnail", "image/jpeg", `Thumbnail ${index + 1}`, heartbeat));
      }
      artifacts.push(await uploadArtifact(job, captionsPath, "captions", "text/vtt", "Subtitles", heartbeat));
      artifacts.push(await uploadArtifact(job, chaptersPath, "chapters", "text/plain", "Chapters", heartbeat));

      await renderGateway("complete", {
        job_id: job.id,
        artifacts,
        qc,
        probe,
        timeline_sha256: timelineSha256,
        master_sha256: masterSha256,
        input_sha256: inputSha256,
      });
      finalized = true;

      if (!qc.passed) {
        throw new Error(`Rendered master failed QC: ${qc.failures.map((failure) => failure.detail).join(" ")}`);
      }
      console.log(`TOTP master approved for episode ${manifest.episode_number}. SHA-256 ${masterSha256}`);
    } finally {
      await browser.close();
    }
  } catch (error) {
    if (!finalized) {
      try {
        await renderGateway("fail", {
          job_id: job.id,
          error: error instanceof Error ? error.message : String(error),
        });
      } catch (failError) {
        console.error("Could not mark render job failed:", failError);
      }
    }
    throw error;
  } finally {
    if (process.env.TOTP_KEEP_RENDER_WORKDIR !== "1") {
      await rm(workdir, { recursive: true, force: true });
    } else {
      console.log(`Keeping render workdir: ${workdir}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("[TOTP-RENDER-WORKER]", error);
    process.exitCode = 1;
  });
}
