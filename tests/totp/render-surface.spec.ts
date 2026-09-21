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
    items: [
      {
        index: 0,
        kind: "opening_titles",
        label: "Opening titles",
        start_ms: 0,
        duration_ms: 2000,
        performance_id: null,
        audio_url: null,
      },
      {
        index: 1,
        kind: "programme_continuity",
        label: "Programme opening",
        start_ms: 2000,
        duration_ms: 2000,
        performance_id: null,
        audio_url: null,
        continuity_kind: "opening",
        continuity_text: "The studio is packed, the cameras are rolling, and we're ready to go!",
      },
      {
        index: 2,
        kind: "chart_rundown",
        label: "Digital Sales Top 40 10–1",
        start_ms: 4000,
        duration_ms: 2000,
        performance_id: null,
        audio_url: null,
        chart_page: {
          id: "digital_sales:10-1",
          chartType: "digital_sales",
          chartLabel: "Digital Sales Top 40",
          rangeLabel: "10–1",
          minRank: 1,
          maxRank: 10,
          sourceCount: 1,
          entries: [{
            rank: 1,
            song_id: "song-1",
            band_id: "band-1",
            song_title: "Test Song",
            artist_name: "Test Band",
            trend: "up",
            trend_change: 1,
            weekly_plays: 12345,
          }],
        },
      },
    ],
    chapters: [{ title: "Opening titles", start_ms: 0, end_ms: 2000 }],
    total_duration_ms: 6000,
    expected_frame_count: 180,
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
    await (window as any).__totpRenderSetFrame({ itemIndex: 1, localMs: 1000 });
  });
  await expect(surface).toHaveAttribute("data-totp-render-item", "programme_continuity");
  const second = await surface.screenshot({ type: "png" });
  expect(second.byteLength).toBeGreaterThan(10_000);

  await page.evaluate(async () => {
    await (window as any).__totpRenderSetFrame({ itemIndex: 2, localMs: 1000 });
  });
  await expect(surface).toHaveAttribute("data-totp-render-item", "chart_rundown");
  const third = await surface.screenshot({ type: "png" });
  expect(third.byteLength).toBeGreaterThan(10_000);
});
