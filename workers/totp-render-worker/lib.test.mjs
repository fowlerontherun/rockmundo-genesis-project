import test from "node:test";
import assert from "node:assert/strict";
import { buildWebVtt, evaluateProbe, frameCount, locateFrame, stableStringify, wrapCaption } from "./lib.mjs";

const plan = {
  total_duration_ms: 10_000,
  programme_spec: { width: 1920, height: 1080, frame_rate: 30, audio_channels: 2 },
  loudness_target: { programmeLoudnessLufs: -14, truePeakCeilingDbtp: -1 },
  items: [
    { start_ms: 0, duration_ms: 2_000, kind: "opening_titles", performance_id: null },
    { start_ms: 2_000, duration_ms: 3_000, kind: "presenter_link", performance_id: "p1" },
    { start_ms: 5_000, duration_ms: 4_000, kind: "performance", performance_id: "p1" },
    { start_ms: 9_000, duration_ms: 1_000, kind: "applause", performance_id: "p1" },
  ],
  chapters: [],
};

test("stableStringify is key-order independent", () => {
  assert.equal(stableStringify({ b: 2, a: 1 }), stableStringify({ a: 1, b: 2 }));
});

test("frame selection is continuous across item boundaries", () => {
  assert.deepEqual(locateFrame(plan, 0), { itemIndex: 0, localMs: 0 });
  assert.deepEqual(locateFrame(plan, 2_000), { itemIndex: 1, localMs: 0 });
  assert.deepEqual(locateFrame(plan, 9_999), { itemIndex: 3, localMs: 999 });
  assert.equal(frameCount(plan), 300);
});

test("captions are at most two wrapped lines", () => {
  const text = wrapCaption("This is a deliberately long presenter line which must remain inside a television title-safe caption block");
  assert.ok(text.split("\n").length <= 2);
  assert.ok(text.split("\n").every((line) => line.length <= 42));
});

test("WebVTT is derived from the authoritative programme plan", () => {
  const vtt = buildWebVtt(plan, [{
    performance_id: "p1",
    payload: {
      presenterDisplayName: "Alex Rayne",
      band: { name: "Shockmaster" },
      song: { title: "Dead Radio", qualifyingRank: 1 },
      cues: [{ type: "presenter", presenterText: "Straight in at number one.", durationMs: 2200 }],
    },
  }]);
  assert.match(vtt, /^WEBVTT/);
  assert.match(vtt, /Shockmaster/);
  assert.match(vtt, /Alex Rayne/);
});

test("QC rejects A/V drift greater than one frame", () => {
  const qc = evaluateProbe(plan, {
    duration_ms: 10_000,
    width: 1920,
    height: 1080,
    frame_rate: 30,
    frame_count: 300,
    video_codec: "h264",
    audio_codec: "aac",
    audio_channels: 2,
    audio_sample_rate: 48_000,
    video_duration_ms: 10_000,
    audio_duration_ms: 10_060,
    programme_loudness_lufs: -14,
    true_peak_dbtp: -1.2,
  });
  assert.equal(qc.passed, false);
  assert.ok(qc.failures.some((row) => row.code === "audio_video_drift"));
});
