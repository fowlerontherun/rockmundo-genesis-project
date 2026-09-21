import { chromium } from "@playwright/test";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { once } from "node:events";
import {
  FPS,
  FRAME_MS,
  buildWebVtt,
  chapterFile,
  evaluateProbe,
  frameCount,
  locateFrame,
  presenterSequenceTrackSpecs,
  sha256Text,
  stableStringify,
} from "./lib.mjs";

const BROKER_URL = process.env.TOTP_RENDER_BROKER_URL;
const RENDER_URL = process.env.TOTP_RENDER_PAGE_URL ?? "http://127.0.0.1:4173/totp-render.html";
const MAX_ATTEMPTS = 3;
const TUS_CHUNK_BYTES = 6 * 1024 * 1024;

if (!BROKER_URL) throw new Error("TOTP_RENDER_BROKER_URL is required.");

async function oidcToken() {
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!requestUrl || !requestToken) throw new Error("GitHub Actions OIDC is unavailable.");
  const separator = requestUrl.includes("?") ? "&" : "?";
  const response = await fetch(`${requestUrl}${separator}audience=rockmundo-totp-render`, {
    headers: { Authorization: `Bearer ${requestToken}` },
  });
  if (!response.ok) throw new Error(`Could not obtain GitHub OIDC token: ${response.status} ${await response.text()}`);
  const body = await response.json();
  if (!body.value) throw new Error("GitHub OIDC endpoint returned no identity token.");
  return body.value;
}

async function broker(token, body) {
  const response = await fetch(BROKER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let parsed = {};
  try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = { error: raw }; }
  if (!response.ok) throw new Error(parsed.error ?? `Render broker failed with HTTP ${response.status}`);
  return parsed;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}\n${stderr.slice(-5000)}`));
    });
  });
}

async function fileSha256(file) {
  return await new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(file);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Could not download ${url}: HTTP ${response.status}`);
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(destination));
  return destination;
}

function hashSeed(value) {
  let hash = 0;
  for (const char of String(value)) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return hash;
}

function pickSound(sounds, types, intensity, seed) {
  const candidates = sounds
    .filter((row) => types.includes(row.sound_type) && row.audio_url)
    .sort((a, b) => Math.abs(Number(a.intensity_level ?? 5) - intensity) - Math.abs(Number(b.intensity_level ?? 5) - intensity) || String(a.id).localeCompare(String(b.id)));
  if (!candidates.length) return null;
  const best = Math.abs(Number(candidates[0].intensity_level ?? 5) - intensity);
  const nearest = candidates.filter((row) => Math.abs(Number(row.intensity_level ?? 5) - intensity) === best);
  return nearest[hashSeed(seed) % nearest.length] ?? nearest[0];
}

async function renderVideo({ plan, replays, token, workerId, jobId, workDir }) {
  const videoOnly = path.join(workDir, "video-only.mp4");
  const totalFrames = frameCount(plan);
  const encoderArgs = [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "image2pipe", "-framerate", String(FPS), "-vcodec", "mjpeg", "-i", "pipe:0",
    "-frames:v", String(totalFrames),
    "-c:v", "libx264", "-preset", "medium", "-crf", "18",
    "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-movflags", "+faststart", "-map_metadata", "-1",
    videoOnly,
  ];
  const encoder = spawn("ffmpeg", encoderArgs, { stdio: ["pipe", "pipe", "pipe"] });
  let encoderError = "";
  encoder.stderr.on("data", (chunk) => { encoderError += chunk; });
  const encoderDone = new Promise((resolve, reject) => {
    encoder.on("error", reject);
    encoder.on("close", (code) => code === 0
      ? resolve()
      : reject(new Error(`Frame encoder exited ${code}: ${encoderError.slice(-5000)}`)));
  });

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-gl=swiftshader",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--disable-dev-shm-usage",
      "--force-device-scale-factor=1",
    ],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    page.on("console", (message) => {
      if (message.type() === "error") console.error("[renderer]", message.text());
    });
    await page.goto(RENDER_URL, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForFunction(() => typeof window.__totpRenderBootstrap === "function", null, { timeout: 60_000 });
    await page.evaluate(({ plan, replays }) => window.__totpRenderBootstrap({ plan, replays }), { plan, replays });
    await page.waitForFunction(() => window.__totpRenderReady === true, null, { timeout: 60_000 });

    const surface = page.locator("[data-totp-offline-render]");
    let previousItem = -1;
    let lastHeartbeat = Date.now();

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      const absoluteMs = frameIndex * FRAME_MS;
      const frame = locateFrame(plan, absoluteMs);
      await page.evaluate((next) => window.__totpRenderSetFrame(next), frame);

      if (frame.itemIndex !== previousItem) {
        const kind = plan.items[frame.itemIndex]?.kind;
        if (["presenter_link", "performance", "applause"].includes(kind)) {
          await page.waitForSelector('[data-renderer-status="ready"]', { state: "attached", timeout: 90_000 });
        }
        previousItem = frame.itemIndex;
      }

      const jpeg = await surface.screenshot({
        type: "jpeg",
        quality: 90,
        animations: "disabled",
      });
      if (!encoder.stdin.write(jpeg)) await once(encoder.stdin, "drain");

      if (Date.now() - lastHeartbeat > 12_000 || frameIndex === totalFrames - 1) {
        const progress = Math.min(70, Math.max(1, Math.round(((frameIndex + 1) / totalFrames) * 70)));
        await broker(token, { operation: "heartbeat", workerId, jobId, progress });
        lastHeartbeat = Date.now();
        console.log(`[TOTP] rendered ${frameIndex + 1}/${totalFrames} frames (${progress}%)`);
      }
    }

    encoder.stdin.end();
    await encoderDone;
    return videoOnly;
  } catch (error) {
    encoder.stdin.destroy();
    encoder.kill("SIGKILL");
    throw error;
  } finally {
    await browser.close();
  }
}

async function buildAudio({ plan, replays, crowdSounds, workDir }) {
  const cache = new Map();
  const audioDir = path.join(workDir, "audio");
  await fsp.mkdir(audioDir, { recursive: true });
  let serial = 0;

  async function source(url, expectedSha256 = null) {
    if (!url) return null;
    let file = cache.get(url) ?? null;
    if (!file) {
      file = path.join(audioDir, `source-${String(++serial).padStart(3, "0")}.bin`);
      await download(url, file);
      cache.set(url, file);
    }
    if (expectedSha256) {
      const actualSha256 = await fileSha256(file);
      if (actualSha256.toLowerCase() !== String(expectedSha256).toLowerCase()) {
        throw new Error(`Frozen audio checksum mismatch for ${url}.`);
      }
    }
    return file;
  }

  const byPerformance = new Map(replays.map((row) => [row.performance_id, row]));
  const tracks = [];
  for (const item of plan.items) {
    const replay = item.performance_id ? byPerformance.get(item.performance_id) : null;
    const reaction = Math.max(-10, Math.min(10, Number(replay?.payload?.liveTv?.audienceReaction ?? 0)));

    if (item.kind === "performance") {
      const file = await source(item.audio_url ?? replay?.payload?.song?.audioUrl ?? null);
      if (!file) throw new Error(`Performance ${item.performance_id} has no canonical song audio.`);
      tracks.push({ file, startMs: item.start_ms, durationMs: item.duration_ms, gain: 0.9, loop: false });
      const ambient = pickSound(crowdSounds, ["ambient_chatter"], 4 + Math.max(0, reaction / 2), `${item.performance_id}:ambient`);
      if (ambient) {
        tracks.push({ file: await source(ambient.audio_url), startMs: item.start_ms, durationMs: item.duration_ms, gain: 0.055 + Math.max(0, reaction) * 0.003, loop: true });
      }
    }

    if (item.kind === "programme_continuity" || item.kind === "chart_rundown") {
      if (item.audio_url) {
        const file = await source(item.audio_url);
        if (!file) throw new Error(`${item.kind} has no canonical presenter audio.`);
        tracks.push({ file, startMs: item.start_ms, durationMs: item.duration_ms, gain: 0.95, loop: false });
      }
    }

    if (item.kind === "presenter_link") {
      if (item.audio_url) {
        const file = await source(item.audio_url);
        if (!file) throw new Error(`Presenter link for ${item.performance_id} has no recorded presenter audio.`);
        tracks.push({ file, startMs: item.start_ms, durationMs: item.duration_ms, gain: 0.95, loop: false });
      } else if (Array.isArray(item.audio_sequence) && item.audio_sequence.length > 0) {
        for (const fragmentTrack of presenterSequenceTrackSpecs(item)) {
          const file = await source(fragmentTrack.url, fragmentTrack.sha256);
          tracks.push({
            file,
            startMs: fragmentTrack.startMs,
            durationMs: fragmentTrack.durationMs,
            gain: fragmentTrack.gain,
            loop: fragmentTrack.loop,
          });
        }
      } else {
        throw new Error(`Presenter link for ${item.performance_id} has no exact take or frozen reusable audio. Browser speech synthesis is not allowed in a master.`);
      }
    }

    if (item.kind === "applause") {
      const applause = pickSound(crowdSounds, ["applause", "crowd_cheer_large", "crowd_cheer_medium"], 9, `${item.performance_id}:applause`);
      if (!applause) throw new Error("No approved applause/crowd audio is available for the broadcast master.");
      tracks.push({ file: await source(applause.audio_url), startMs: item.start_ms, durationMs: item.duration_ms, gain: Math.min(0.92, 0.82 + Math.max(0, reaction) * 0.018), loop: false });
    }
  }

  const durationSeconds = plan.total_duration_ms / 1000;
  const mixed = path.join(workDir, "mix-unmastered.wav");
  const args = [];
  for (const track of tracks) args.push("-i", track.file);
  const filters = [`anullsrc=r=48000:cl=stereo:d=${durationSeconds.toFixed(3)}[base]`];
  const labels = ["[base]"];
  tracks.forEach((track, index) => {
    const label = `a${index}`;
    const loop = track.loop ? "aloop=loop=-1:size=2147483647," : "";
    filters.push(`[${index}:a]${loop}atrim=0:${(track.durationMs / 1000).toFixed(3)},asetpts=PTS-STARTPTS,volume=${track.gain.toFixed(4)},adelay=${Math.round(track.startMs)}|${Math.round(track.startMs)}[${label}]`);
    labels.push(`[${label}]`);
  });
  filters.push(`${labels.join("")}amix=inputs=${labels.length}:duration=longest:dropout_transition=0,atrim=0:${durationSeconds.toFixed(3)},aresample=48000[aout]`);

  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    ...args,
    "-filter_complex", filters.join(";"),
    "-map", "[aout]", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s24le", mixed,
  ]);

  return mixed;
}

function parseLoudnorm(stderr) {
  const matches = [...stderr.matchAll(/\{[\s\S]*?"input_i"[\s\S]*?\}/g)];
  if (!matches.length) throw new Error("FFmpeg did not return loudness measurements.");
  return JSON.parse(matches.at(-1)[0]);
}

async function masterAudio(input) {
  const first = await run("ffmpeg", [
    "-hide_banner", "-nostats", "-i", input,
    "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json",
    "-f", "null", "-",
  ]);
  const measured = parseLoudnorm(first.stderr);
  return {
    filter: [
      "loudnorm=I=-14:TP=-1:LRA=11",
      `measured_I=${measured.input_i}`,
      `measured_TP=${measured.input_tp}`,
      `measured_LRA=${measured.input_lra}`,
      `measured_thresh=${measured.input_thresh}`,
      `offset=${measured.target_offset}`,
      "linear=true:print_format=summary",
    ].join(":"),
    measured,
  };
}

async function encode({ plan, videoOnly, mixedAudio, workDir }) {
  const master = path.join(workDir, plan.delivery.master);
  const proxy = path.join(workDir, plan.delivery.proxy);
  const totalSeconds = (plan.total_duration_ms / 1000).toFixed(3);

  const mastered = await masterAudio(mixedAudio);
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", videoOnly, "-i", mixedAudio,
    "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy",
    "-af", mastered.filter,
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
    "-t", totalSeconds,
    "-movflags", "+faststart",
    "-map_metadata", "-1",
    master,
  ]);

  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", master,
    "-vf", "scale=1280:720:flags=lanczos",
    "-c:v", "libx264", "-preset", "medium", "-crf", "21",
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
    "-movflags", "+faststart",
    "-map_metadata", "-1",
    proxy,
  ]);

  return { master, proxy };
}

async function imageAt(master, destination, ms) {
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", (ms / 1000).toFixed(3), "-i", master,
    "-frames:v", "1", "-q:v", "2", destination,
  ]);
}

function rational(value) {
  if (!value) return 0;
  const [a, b] = String(value).split("/").map(Number);
  return b ? a / b : a;
}

async function probeMaster(master) {
  const probe = await run("ffprobe", [
    "-v", "error", "-count_frames",
    "-show_entries", "format=duration:stream=index,codec_type,codec_name,width,height,avg_frame_rate,nb_read_frames,duration,sample_rate,channels",
    "-of", "json", master,
  ]);
  const parsed = JSON.parse(probe.stdout);
  const video = parsed.streams.find((row) => row.codec_type === "video") ?? {};
  const audio = parsed.streams.find((row) => row.codec_type === "audio") ?? {};
  const loud = await run("ffmpeg", [
    "-hide_banner", "-nostats", "-i", master,
    "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json",
    "-f", "null", "-",
  ]);
  const loudness = parseLoudnorm(loud.stderr);
  return {
    duration_ms: Math.round(Number(parsed.format?.duration ?? 0) * 1000),
    width: Number(video.width ?? 0),
    height: Number(video.height ?? 0),
    frame_rate: rational(video.avg_frame_rate),
    frame_count: Number(video.nb_read_frames ?? 0),
    video_codec: String(video.codec_name ?? ""),
    audio_codec: String(audio.codec_name ?? ""),
    audio_channels: Number(audio.channels ?? 0),
    audio_sample_rate: Number(audio.sample_rate ?? 0),
    video_duration_ms: Math.round(Number(video.duration ?? parsed.format?.duration ?? 0) * 1000),
    audio_duration_ms: Math.round(Number(audio.duration ?? parsed.format?.duration ?? 0) * 1000),
    programme_loudness_lufs: Number(loudness.input_i),
    true_peak_dbtp: Number(loudness.input_tp),
  };
}

function sumDurations(text, regex) {
  return [...text.matchAll(regex)].reduce((sum, match) => sum + Number(match[1] ?? 0), 0);
}

async function diagnostics(master) {
  const [black, freeze, silence] = await Promise.all([
    run("ffmpeg", ["-hide_banner", "-nostats", "-i", master, "-an", "-vf", "blackdetect=d=0.4:pix_th=0.02", "-f", "null", "-"]),
    run("ffmpeg", ["-hide_banner", "-nostats", "-i", master, "-an", "-vf", "freezedetect=n=0.001:d=2", "-f", "null", "-"]),
    run("ffmpeg", ["-hide_banner", "-nostats", "-i", master, "-vn", "-af", "silencedetect=n=-50dB:d=2", "-f", "null", "-"]),
  ]);
  return {
    blackSeconds: sumDurations(black.stderr, /black_duration:([0-9.]+)/g),
    freezeSeconds: sumDurations(freeze.stderr, /freeze_duration: ([0-9.]+)/g),
    silenceSeconds: sumDurations(silence.stderr, /silence_duration: ([0-9.]+)/g),
    captionOverflow: 0,
  };
}

function tusMetadata(fields) {
  return Object.entries(fields)
    .map(([key, value]) => `${key} ${Buffer.from(String(value)).toString("base64")}`)
    .join(",");
}

async function tusUpload({ endpoint, apikey, slot, file }) {
  const stat = await fsp.stat(file);
  const create = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(stat.size),
      "Upload-Metadata": tusMetadata({
        bucketName: "totp-broadcast-masters",
        objectName: slot.path,
        contentType: slot.contentType,
        cacheControl: "3600",
      }),
      "x-signature": slot.token,
      "x-upsert": "true",
      ...(apikey ? { apikey } : {}),
    },
  });
  if (!create.ok) throw new Error(`Could not start upload for ${slot.filename}: ${create.status} ${await create.text()}`);
  const location = create.headers.get("location");
  if (!location) throw new Error(`Storage did not return a resumable upload URL for ${slot.filename}.`);
  const uploadUrl = new URL(location, endpoint).toString();

  const handle = await fsp.open(file, "r");
  try {
    let offset = 0;
    while (offset < stat.size) {
      const length = Math.min(TUS_CHUNK_BYTES, stat.size - offset);
      const buffer = Buffer.allocUnsafe(length);
      const { bytesRead } = await handle.read(buffer, 0, length, offset);
      const response = await fetch(uploadUrl, {
        method: "PATCH",
        headers: {
          "Tus-Resumable": "1.0.0",
          "Upload-Offset": String(offset),
          "Content-Type": "application/offset+octet-stream",
          "Content-Length": String(bytesRead),
          "x-signature": slot.token,
          "x-upsert": "true",
          ...(apikey ? { apikey } : {}),
        },
        body: buffer.subarray(0, bytesRead),
      });
      if (!response.ok) throw new Error(`Upload failed for ${slot.filename}: ${response.status} ${await response.text()}`);
      const nextOffset = Number(response.headers.get("upload-offset") ?? offset + bytesRead);
      if (!(nextOffset > offset)) throw new Error(`Storage did not advance the upload offset for ${slot.filename}.`);
      offset = nextOffset;
    }
  } finally {
    await handle.close();
  }
}

async function uploadArtifacts({ token, workerId, jobId, files }) {
  const requested = [];
  for (const file of files) {
    const stat = await fsp.stat(file.path);
    requested.push({ kind: file.kind, filename: path.basename(file.path), contentType: file.contentType, bytes: stat.size });
  }
  const slots = await broker(token, { operation: "upload_slots", workerId, jobId, artifacts: requested });
  const byName = new Map(slots.slots.map((slot) => [slot.filename, slot]));
  const artifacts = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const slot = byName.get(path.basename(file.path));
    if (!slot) throw new Error(`Missing upload slot for ${file.path}`);
    await tusUpload({ endpoint: slots.resumableEndpoint, apikey: slots.apikey, slot, file: file.path });
    artifacts.push({
      kind: file.kind,
      filename: slot.filename,
      storage_path: slot.path,
      url: null,
      bytes: (await fsp.stat(file.path)).size,
      sha256: await fileSha256(file.path),
    });
    await broker(token, { operation: "heartbeat", workerId, jobId, progress: 90 + Math.round(((index + 1) / files.length) * 8) });
  }
  return artifacts;
}

async function inputFingerprint(workDir, manifest, replays) {
  const audioDir = path.join(workDir, "audio");
  const files = await fsp.readdir(audioDir).catch(() => []);
  const media = [];
  for (const name of files.filter((value) => value.startsWith("source-")).sort()) {
    media.push({ name, sha256: await fileSha256(path.join(audioDir, name)) });
  }
  return sha256Text(stableStringify({
    manifest,
    replays,
    media,
    renderer_commit: process.env.GITHUB_SHA ?? "unknown",
  }));
}

async function renderJob(claim, token) {
  const { job, manifest, plan, replays, crowdSounds, workerId } = claim;
  if (!job || !plan?.items?.length || !manifest) throw new Error("Render broker returned an incomplete job.");
  if (job.manifest_checksum !== manifest.checksum || plan.manifest_checksum !== manifest.checksum) {
    throw new Error("Render input checksum does not match the frozen episode manifest.");
  }
  if (Number(plan.programme_spec?.width) !== 1920 || Number(plan.programme_spec?.height) !== 1080 || Number(plan.programme_spec?.frame_rate) !== FPS) {
    throw new Error("Render plan is not the approved 1080p30 programme profile.");
  }

  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), `totp-${job.id}-`));
  console.log(`[TOTP] rendering episode ${plan.episode_number} job ${job.id} in ${workDir}`);
  try {
    const timelineSha256 = sha256Text(stableStringify(plan));
    const videoOnly = await renderVideo({ plan, replays, token, workerId, jobId: job.id, workDir });
    await broker(token, { operation: "heartbeat", workerId, jobId: job.id, progress: 72 });

    const mixedAudio = await buildAudio({ plan, replays, crowdSounds: crowdSounds ?? [], workDir });
    const inputSha256 = await inputFingerprint(workDir, manifest, replays);
    const { master, proxy } = await encode({ plan, videoOnly, mixedAudio, workDir });
    await broker(token, { operation: "heartbeat", workerId, jobId: job.id, progress: 82 });

    const poster = path.join(workDir, plan.delivery.poster);
    await imageAt(master, poster, plan.poster_at_ms);
    const thumbnails = [];
    for (let index = 0; index < Math.min(3, plan.thumbnail_at_ms?.length ?? 0); index += 1) {
      const file = path.join(workDir, `totp-episode-${String(plan.episode_number).padStart(3, "0")}-thumbnail-${index + 1}.jpg`);
      await imageAt(master, file, plan.thumbnail_at_ms[index]);
      thumbnails.push(file);
    }
    const captions = path.join(workDir, plan.delivery.captions);
    const chapters = path.join(workDir, plan.delivery.chapters);
    await fsp.writeFile(captions, buildWebVtt(plan, replays), "utf8");
    await fsp.writeFile(chapters, chapterFile(plan), "utf8");

    const probe = await probeMaster(master);
    const diag = await diagnostics(master);
    const qc = evaluateProbe(plan, probe, diag);
    const masterSha256 = await fileSha256(master);

    const files = [
      { kind: "master", path: master, contentType: "video/mp4" },
      { kind: "proxy", path: proxy, contentType: "video/mp4" },
      { kind: "poster", path: poster, contentType: "image/jpeg" },
      { kind: "captions", path: captions, contentType: "text/vtt" },
      { kind: "chapters", path: chapters, contentType: "text/plain" },
      ...thumbnails.map((file, index) => ({ kind: `thumbnail_${index + 1}`, path: file, contentType: "image/jpeg" })),
    ];

    const artifacts = await uploadArtifacts({ token, workerId, jobId: job.id, files });
    await broker(token, {
      operation: "complete",
      workerId,
      jobId: job.id,
      artifacts,
      qc,
      probe: { ...probe, diagnostics: diag },
      timelineSha256,
      masterSha256,
      inputSha256,
    });

    if (!qc.passed) {
      throw new Error(`Master failed QC: ${qc.failures.map((row) => row.detail).join(" | ")}`);
    }

    console.log(`[TOTP] episode ${plan.episode_number} master passed QC: ${masterSha256}`);
  } finally {
    if (process.env.TOTP_KEEP_RENDER_WORKDIR !== "1") await fsp.rm(workDir, { recursive: true, force: true });
  }
}

async function main() {
  const token = await oidcToken();
  const workerId = `github-${process.env.GITHUB_RUN_ID ?? "local"}-${process.env.GITHUB_RUN_ATTEMPT ?? "1"}`;
  const claim = await broker(token, { operation: "claim", workerId });
  if (!claim.job) {
    console.log("[TOTP] no render jobs are queued.");
    return;
  }
  try {
    await renderJob(claim, token);
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error("[TOTP] render failed:", message);
    try {
      if (claim.job?.id && claim.job?.attempts >= MAX_ATTEMPTS) {
        await broker(token, { operation: "fail", workerId, jobId: claim.job.id, error: message });
      }
    } catch (failError) {
      console.error("[TOTP] could not mark render failed:", failError);
    }
    process.exitCode = 1;
  }
}

await main();