import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function expectNoSeriousOrCritical(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
}

test('admin demo and viewer states have no serious or critical axe findings', async ({ page }) => {
  await page.goto('/admin/gig-viewer-demo');
  await expectNoSeriousOrCritical(page);
  await page.getByRole('button', { name: 'Launch viewer' }).click();
  await expect(page.getByRole('heading', { name: 'Gig Replay' })).toBeVisible();
  await expectNoSeriousOrCritical(page);
  await page.getByRole('button', { name: 'Enable Audio' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  await expectNoSeriousOrCritical(page);
  await page.getByRole('button', { name: 'Skip to result' }).click();
  await expectNoSeriousOrCritical(page);
});

test('keyboard-only viewer flow remains operable', async ({ page }) => {
  await page.goto('/admin/gig-viewer-demo');
  await page.keyboard.press('Tab');
  await page.getByLabel('Preset selector').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('option', { name: 'Sold-out club' }).click();
  await page.getByRole('button', { name: 'Launch viewer' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Enable Audio' }).focus();
  await page.keyboard.press('Enter');
  for (const name of ['Play', 'Pause', 'Mute', 'Unmute', '2×', '1×', 'Next song', 'Next highlight', 'Skip to result', 'View Result', 'Close Viewer']) {
    const button = page.getByRole('button', { name });
    if (await button.isVisible().catch(() => false)) {
      await button.focus();
      await page.keyboard.press('Enter');
    }
  }
  await expect(page.locator(':focus')).toBeVisible();
});
