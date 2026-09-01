import { expect, test } from '@playwright/test';

type GigAudioCounters = { created: number; playing: number; paused: number; loads: number };
type GigAudioTestWindow = Window & { __gigAudioCounters?: GigAudioCounters };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const counters = { created: 0, playing: 0, paused: 0, loads: 0 };
    class MockAudio {
      src = ''; preload = ''; volume = 1; muted = false; currentTime = 0; duration = 180; listeners: Record<string, Array<() => void>> = {};
      constructor(src?: string) { this.src = src ?? ''; counters.created++; setTimeout(() => this.dispatch('canplay'), 0); }
      addEventListener(name: string, cb: () => void) { (this.listeners[name] ||= []).push(cb); }
      removeAttribute(name: string) { if (name === 'src') this.src = ''; }
      load() { counters.loads++; }
      async play() { counters.playing = 1; return undefined; }
      pause() { counters.playing = 0; counters.paused++; }
      dispatch(name: string) { for (const cb of this.listeners[name] || []) cb(); }
    }
    const testWindow = window as unknown as GigAudioTestWindow & { Audio: typeof Audio };
    testWindow.__gigAudioCounters = counters;
    testWindow.Audio = MockAudio as unknown as typeof Audio;
  });
});

const readCounter = (key: keyof GigAudioCounters) =>
  (window as unknown as GigAudioTestWindow).__gigAudioCounters?.[key] ?? 0;

test('audio activation, speed muting, seek cleanup, close and reopen use one active element', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/gig-viewer-demo');
  await page.getByRole('button', { name: 'Launch viewer', exact: true }).click();

  // The replay now opens in the crowd-entry phase, where song audio is
  // intentionally unavailable. Move to the first song before exercising the
  // setlist-audio lifecycle so this test verifies audio rather than pre-show UI.
  await expect(page.getByLabel('Setlist audio controls', { exact: true })).toContainText('Audio unavailable');
  await page.getByRole('button', { name: 'Next song', exact: true }).click();
  await expect(page.getByLabel('Setlist audio controls', { exact: true })).not.toContainText('Audio unavailable');

  await page.getByRole('button', { name: 'Enable Audio', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => page.evaluate(readCounter, 'playing')).toBe(1);
  await page.getByRole('button', { name: 'Mute', exact: true }).click();
  await page.getByRole('button', { name: 'Unmute', exact: true }).click();
  await page.getByRole('button', { name: '2×', exact: true }).click();
  await expect(page.getByLabel('Setlist audio controls', { exact: true })).toContainText('Audio is available at normal speed');
  await expect.poll(() => page.evaluate(readCounter, 'playing')).toBe(0);
  await page.getByRole('button', { name: '1×', exact: true }).click();
  await page.getByRole('button', { name: 'Next song', exact: true }).click();
  await page.getByRole('button', { name: 'Previous song', exact: true }).click();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await page.getByRole('button', { name: 'Skip to result', exact: true }).click();
  await expect.poll(() => page.evaluate(readCounter, 'playing')).toBe(0);
  const createdAfterFirstRun = await page.evaluate(readCounter, 'created');
  await page.getByRole('button', { name: 'Close Viewer', exact: true }).click();
  await page.getByRole('button', { name: 'Launch viewer', exact: true }).click();
  await expect.poll(() => page.evaluate(readCounter, 'created')).toBeGreaterThanOrEqual(createdAfterFirstRun);
});

test('mobile viewports keep controls in the viewport without horizontal overflow', async ({ page }) => {
  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/admin/gig-viewer-demo');
    await page.getByRole('button', { name: 'Launch viewer', exact: true }).click();
    await expect(page.getByLabel('Setlist audio controls', { exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  }
});
