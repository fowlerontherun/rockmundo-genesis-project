import test from "node:test";
import assert from "node:assert/strict";
import { buildWorkerCaptions, captionIssues, evaluateWorkerQc, sha256Text, stableStringify } from "./index.mjs";

test("stableStringify and SHA-256 are deterministic", () => {
  const a = stableStringify({ z: 1, a: { y: 2, x: 3 } });
  const b = stableStringify({ a: { x: 3, y: 2 }, z: 1 });
  assert.equal(a, b);
  assert.equal(sha256Text(a), sha256Text(b));
  assert.equal(sha256Text(a).length, 64);
});

test("worker captions split long presenter copy inside readability limits", () => {
  const manifest = {
    presenter_key: "Alex Rayne",
    segments: [{
      performance_id: "p1",
      presenter_intro: "A very long presenter introduction that is deliberately written with enough words to be split into more than one readable subtitle card for the final programme.",
      qualifying_rank: 1,
      band_name: "Shockmaster",
      song_title: "Dead Radio",
    }],
  };
  const plan = {
    items: [
      { kind: "presenter_link", performance_id: "p1", start_ms: 0, duration_ms: 8000 },
      { kind: "performance", performance_id: "p1", start_ms: 8000, duration_ms: 180000 },
    ],
  };
  const cues = buildWorkerCaptions(manifest, plan);
  assert.ok(cues.length >= 3);
  assert.deepEqual(captionIssues(cues), []);
});

test("worker QC rejects black, frozen, silent and drifting output", () => {
  const plan = { total_duration_ms: 10000, programme_spec: { frame_rate: 30 }, chapters: [{}, {}] };
  const result = evaluateWorkerQc(plan, {
    duration_ms: 10000, width: 1920, height: 1080, frame_rate: 30,
    video_codec: "h264", audio_codec: "aac", audio_channels: 2,
    programme_loudness_lufs: -14, true_peak_dbtp: -1.2, chapter_count: 2,
    frame_count: 300, video_duration_ms: 10000, audio_duration_ms: 9900,
    audio_sample_rate: 48000, black_frame_count: 1, frozen_frame_count: 1,
    silence_gap_count: 1, caption_issues: 0,
  });
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((failure) => failure.code === "audio_video_drift_under_frame"));
  assert.ok(result.failures.some((failure) => failure.code === "no_black_frames"));
  assert.ok(result.failures.some((failure) => failure.code === "no_frozen_frames"));
  assert.ok(result.failures.some((failure) => failure.code === "no_silence_gaps"));
});
