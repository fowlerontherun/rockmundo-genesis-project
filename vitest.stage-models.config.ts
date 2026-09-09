import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config';

/** Stage/player model verification is entirely offline, including shell hooks. */
export default mergeConfig(base, defineConfig({
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://example.invalid'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('offline-stage-model-test-key'),
  },
  test: {
    setupFiles: ['./vitest.stage-models.setup.ts'],
    include: [
      'src/features/gig-demo-3d/**/*.test.{ts,tsx}',
      'src/features/player-model/**/*.test.{ts,tsx}',
      'src/features/gig-experience/viewer/three/**/*.test.{ts,tsx}',
      'src/features/gig-experience/viewer/tests/gigViewerControlsAccessibility.test.tsx',
      'src/features/gig-experience/viewer/tests/performerLifecycle.test.ts',
      'src/features/gig-experience/viewer/tests/browser/gigReplayBrowserGate.test.tsx',
    ],
  },
}));
