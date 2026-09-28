import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4181';

export default defineConfig({
  testDir: './tests/avatar-v2',
  testMatch: /real-source-browser-proof\.spec\.ts/,
  timeout: 65_000,
  expect: { timeout: 45_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'work/avatar-v2-playwright-report', open: 'never' }]],
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    browserName: 'chromium',
    launchOptions: {
      args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4181 --strictPort',
    url: baseURL + '/avatar-v2-browser-smoke.html',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  outputDir: 'work/avatar-v2-playwright-results',
});
