import { expect, test } from '@playwright/test';

const forbiddenMutations = [
  'start-gig', 'process-gig-song', 'complete-gig', 'generate-gig-viewer-replay',
  'gig_viewer_replays?select=*&', 'admin-generate-song-audio', 'songs?'
];

test.beforeEach(async ({ page }) => {
  // RockMundo's production desktop shell intentionally blocks viewports below
  // 1440px. This suite tests the admin gig viewer itself, so keep its desktop
  // journeys above that global shell threshold.
  await page.setViewportSize({ width: 1440, height: 900 });

  const mutations: string[] = [];
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    if (request.method() !== 'GET' && forbiddenMutations.some((needle) => url.includes(needle))) mutations.push(`${request.method()} ${url}`);
    if (url.includes('/rest/v1/gig_viewer_replays')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'demo-replay', gig_id: 'fixture-gig', viewer_version: 1, event_schema_version: 1, duration_ms: 180000, generation_status: 'ready', generated_at: '2026-07-11T00:00:00Z' }]) });
      return;
    }
    await route.continue();
  });
  await page.exposeFunction('__phase5MutationFailures', () => mutations);
});

test('admin fixture mode loads, changes controls, launches viewer, and stays read-only', async ({ page }) => {
  await page.goto('/admin/gig-viewer-demo');
  await expect(page.getByRole('heading', { name: 'Admin Gig Viewer Demo' })).toBeVisible();
  await expect(page.getByText('Demo data — no game records will be changed.')).toBeVisible();

  for (const [label, option] of [
    ['Preset selector', 'Empty club'], ['Venue selector', 'Arena'], ['Attendance selector', 'Half-full'],
    ['Band-size and role selector', 'Large ensemble'], ['Setlist-length selector', 'Long'],
    ['Momentum selector', 'Recovery'], ['Encore selector', 'Excellent encore'], ['Audio preset selector', 'Mixed audio'],
    ['Device preview selector', '390 × 844'],
  ] as const) {
    await page.getByLabel(label, { exact: true }).click();
    await page.getByRole('option', { name: option, exact: true }).click();
  }
  await page.getByLabel('Reduced-motion toggle', { exact: true }).click();
  await page.getByRole('button', { name: 'Launch viewer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gig Replay', exact: true })).toBeVisible();
  await expect(page.getByLabel('Setlist audio controls', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Launch report preview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Audio Diagnostics', exact: true })).toBeVisible();
  await page.getByLabel('Search gig ID', { exact: true }).fill('fixture');
  await page.getByRole('button', { name: 'Search completed gigs', exact: true }).click();
  await expect(page.getByText('metadata loaded read-only', { exact: false })).toBeVisible();
  await expect(page.getByText(/https:\/\//)).toHaveCount(0);
  const failures = await page.evaluate(() => {
    const getFailures = (window as Window & { __phase5MutationFailures?: () => string[] }).__phase5MutationFailures;
    return getFailures?.() ?? [];
  });
  expect(failures).toEqual([]);
});

test('direct unauthenticated access is denied when admin test bypass is disabled', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseURL}/admin/gig-viewer-demo?no-test-admin=1`);
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole('tab', { name: 'Sign In', exact: true })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Admin Gig Viewer Demo', exact: true })).toHaveCount(0);
  await context.close();
});
