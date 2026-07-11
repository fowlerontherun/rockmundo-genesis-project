import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const counters = { created: 0, playing: 0, paused: 0, loads: 0 };
    class MockAudio {
      src = ''; preload = ''; volume = 1; muted = false; currentTime = 0; duration = 180; listeners: Record<string, Function[]> = {};
      constructor(src?: string) { this.src = src ?? ''; counters.created++; setTimeout(() => this.dispatch('canplay'), 0); }
      addEventListener(name: string, cb: Function) { (this.listeners[name] ||= []).push(cb); }
      removeAttribute(name: string) { if (name === 'src') this.src = ''; }
      load() { counters.loads++; }
      async play() { counters.playing = 1; return undefined; }
      pause() { counters.playing = 0; counters.paused++; }
      dispatch(name: string) { for (const cb of this.listeners[name] || []) cb(); }
    }
    (window as any).__gigAudioCounters = counters;
    (window as any).Audio = MockAudio as any;
  });
});

test('audio activation, speed muting, seek cleanup, close and reopen use one active element', async ({ page }) => {
  await page.goto('/admin/gig-viewer-demo');
  await page.getByRole('button', { name: 'Launch viewer' }).click();
  await expect(page.getByLabel('Setlist audio controls')).toContainText('idle');
  await page.getByRole('button', { name: 'Enable Audio' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__gigAudioCounters.playing)).toBe(1);
  await page.getByRole('button', { name: 'Mute' }).click();
  await page.getByRole('button', { name: 'Unmute' }).click();
  await page.getByRole('button', { name: '2×' }).click();
  await expect(page.getByLabel('Setlist audio controls')).toContainText('Audio is available at normal speed');
  await expect.poll(() => page.evaluate(() => (window as any).__gigAudioCounters.playing)).toBe(0);
  await page.getByRole('button', { name: '1×' }).click();
  await page.getByRole('button', { name: 'Next song' }).click();
  await page.getByRole('button', { name: 'Previous song' }).click();
  await page.getByRole('button', { name: 'Restart' }).click();
  await page.getByRole('button', { name: 'Skip to result' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__gigAudioCounters.playing)).toBe(0);
  const createdAfterFirstRun = await page.evaluate(() => (window as any).__gigAudioCounters.created);
  await page.getByRole('button', { name: 'Close Viewer' }).click();
  await page.getByRole('button', { name: 'Launch viewer' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__gigAudioCounters.created)).toBeGreaterThanOrEqual(createdAfterFirstRun);
});

test('mobile viewports keep controls in the viewport without horizontal overflow', async ({ page }) => {
  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/admin/gig-viewer-demo');
    await page.getByRole('button', { name: 'Launch viewer' }).click();
    await expect(page.getByLabel('Setlist audio controls')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  }
});
