import "@testing-library/jest-dom/vitest";

// Smoke tests use mocked Supabase calls, but the generated client validates
// env configuration at import time. Provide safe defaults for the test runner.
const testEnv = import.meta.env as Record<string, string | undefined>;

if (!testEnv.VITE_SUPABASE_URL) {
  testEnv.VITE_SUPABASE_URL = "https://example.supabase.co";
}

if (!testEnv.VITE_SUPABASE_PUBLISHABLE_KEY) {
  testEnv.VITE_SUPABASE_PUBLISHABLE_KEY = "test-key";
}
