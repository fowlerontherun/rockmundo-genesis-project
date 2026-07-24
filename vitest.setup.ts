import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Smoke tests use mocked Supabase calls, but the generated client validates
// env configuration at import time. Provide safe defaults for the test runner.
const testEnv = import.meta.env as Record<string, string | undefined>;

if (!testEnv.VITE_SUPABASE_URL) {
  testEnv.VITE_SUPABASE_URL = "https://example.supabase.co";
}

if (!testEnv.VITE_SUPABASE_PUBLISHABLE_KEY) {
  testEnv.VITE_SUPABASE_PUBLISHABLE_KEY = "test-key";
}

const defineMissing = <T extends object, K extends PropertyKey>(target: T | undefined, key: K, value: unknown) => {
  if (!target || key in target) return;
  Object.defineProperty(target, key, {
    configurable: true,
    writable: true,
    value,
  });
};

if (typeof window !== "undefined") {
  defineMissing(window, "matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  defineMissing(window, "ResizeObserver", class ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  });
  defineMissing(window, "IntersectionObserver", class IntersectionObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn(() => []);
  });
  defineMissing(window, "scrollTo", vi.fn());
}

const testWindow = typeof window === "undefined" ? undefined : window;
defineMissing(globalThis as typeof globalThis & { ResizeObserver?: unknown }, "ResizeObserver", testWindow?.ResizeObserver);
defineMissing(globalThis as typeof globalThis & { IntersectionObserver?: unknown }, "IntersectionObserver", testWindow?.IntersectionObserver);
if (typeof Element !== "undefined") defineMissing(Element.prototype, "scrollIntoView", vi.fn());
if (typeof HTMLElement !== "undefined") defineMissing(HTMLElement.prototype, "scrollTo", vi.fn());
if (typeof HTMLCanvasElement !== "undefined") defineMissing(HTMLCanvasElement.prototype, "getContext", vi.fn(() => null));
