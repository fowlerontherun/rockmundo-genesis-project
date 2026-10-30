import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

// Local render-only fixture. No login or live game data is needed.
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4187', '--strictPort'], {
  env: { ...process.env, VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'render-fixture-key' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
let browser;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Vite did not start in 30s')), 30000);
    server.stdout.on('data', data => { if (data.toString().includes('Local:')) { clearTimeout(timer); resolve(); } });
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Vite exited: ${code}`)); });
  });
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('http://127.0.0.1:4187/tests/gig-experience/fixtures/visual-motion.html');
  await page.waitForFunction(() => ['ready', 'error'].includes(window.gigMotionState?.state), undefined, { timeout: 60000 });
  assert.equal(await page.evaluate(() => window.gigMotionState.state), 'ready');
  const capture = async (seconds, reaction = 'wave', reduced = false) => {
    const state = await page.evaluate(([t, r, motion]) => window.renderGigMotion(t, r, motion), [seconds, reaction, reduced]);
    await page.screenshot();
    return state;
  };
  const initial = await capture(0, 'bounce');
  assert.ok(initial.crowd.every(mesh => mesh.motion.every(Number.isFinite)), 'The initial automatic crowd must not pack NaN poses');
  const original = await capture(10);
  await capture(35, 'applause');
  assert.deepEqual(await capture(10), original, 'A backwards seek must reconstruct crowd and camera state');
  assert.notDeepEqual(await capture(11), original, 'Active crowd must move');
  const phones = await capture(10, 'phone_lights');
  await capture(35, 'applause');
  assert.deepEqual(await capture(10, 'phone_lights'), phones, 'Phone props must reconstruct with the moving hands');
  const still = await capture(10, 'phone_lights', true);
  assert.deepEqual(await capture(35, 'phone_lights', true), still, 'Reduced motion must freeze crowd articulation');
  for (const shot of ['front', 'side_pit', 'side_stage', 'drums', 'backline_reverse', 'crane']) {
    const pose = await page.evaluate(camera => window.renderGigMotion(10, 'wave', false, camera), shot);
    assert.ok(pose.sightline.clear >= pose.sightline.distance - .001, `${shot}: scenery must not obstruct the lens`);
    await page.screenshot();
  }
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('http://127.0.0.1:4187/tests/gig-experience/fixtures/visual-motion.html?venue=cafe_stage');
  await page.waitForFunction(() => window.gigMotionState?.state === 'ready', undefined, { timeout: 60000 });
  for (const shot of ['front', 'side_pit', 'side_stage', 'drums', 'backline_reverse']) {
    const pose = await page.evaluate(camera => window.renderGigMotion(10, 'wave', false, camera), shot);
    assert.ok(pose.sightline.clear >= pose.sightline.distance - .001, `Portrait café ${shot}: clear scenery`);
    await page.screenshot();
  }
  if (process.env.GIG_MOTION_SCREENSHOT) await page.screenshot({ path: process.env.GIG_MOTION_SCREENSHOT });
  assert.deepEqual(errors, [], 'The real WebGL render must have no shader or page errors');
  console.log('Gig WebGL smoke passed: shaders, backwards seek, animation and reduced motion.');
} finally {
  await browser?.close();
  server.kill();
}
