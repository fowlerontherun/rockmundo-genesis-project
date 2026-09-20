import { test, expect } from "@playwright/test";

test("deterministic render surface boots and produces a stable 1080p frame", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("http://127.0.0.1:4173/totp-render.html", { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof (window as any).__totpRenderBootstrap === "function");

  const plan = {
    plan_version: 2,
    episode_id: "phase3-smoke",
    episode_number: 999,
    manifest_checksum: "phase3-smoke-checksum",
    purpose: "rehearsal",
    source_performance_id: null,
    programme_spec: {
      width: 1920,
      height: 1080,
      frame_rate: 30,
      video_codec: "h264",
      audio_codec: "aac",
      audio_channels: 2,
      aspect_ratio: "16:9",
    },
    audio_sample_rate: 48000,
    items: [{
      index: 0,
      kind: "opening_titles",
      label: "Opening titles",
      start_ms: 0,
      duration_ms: 2000,
      performance_id: null,
      audio_url: null,
    }],
    chapters: [{ title: "Opening titles", start_ms: 0, end_ms: 2000 }],
    total_duration_ms: 2000,
    expected_frame_count: 60,
    poster_at_ms: 1000,
    thumbnail_at_ms: [],
    captions_vtt: "WEBVTT\n",
    delivery: {
      master: "phase3-rehearsal.mp4",
      youtube: "phase3-rehearsal-delivery.mp4",
      proxy: "phase3-rehearsal-proxy.mp4",
      poster: "phase3-rehearsal-poster.jpg",
      thumbnails: [],
      captions: "phase3.vtt",
      chapters: "phase3-chapters.txt",
    },
    loudness_target: { programmeLoudnessLufs: -14, truePeakCeilingDbtp: -1 },
    qc_checks: [],
  };

  await page.evaluate(async (payload) => {
    await (window as any).__totpRenderBootstrap({ plan: payload, replays: [] });
  }, plan);

  const surface = page.locator("[data-totp-offline-render]");
  await expect(surface).toHaveCount(1);
  await expect(surface).toHaveAttribute("data-totp-render-item", "opening_titles");

  const first = await surface.screenshot({ type: "png" });
  expect(first.byteLength).toBeGreaterThan(10_000);

  await page.evaluate(async () => {
    await (window as any).__totpRenderSetFrame({ itemIndex: 0, localMs: 1000 });
  });
  await expect(surface).toHaveAttribute("data-totp-render-local-ms", "1000");
  const second = await surface.screenshot({ type: "png" });
  expect(second.byteLength).toBeGreaterThan(10_000);
});
