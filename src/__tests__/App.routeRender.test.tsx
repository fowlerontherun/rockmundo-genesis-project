// @vitest-environment node
import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import App from "../App";
import { festivalRoutePatterns } from "../features/festivals/routes";

const routeState = vi.hoisted(() => ({ path: "/" }));

// BrowserRouter is the only browser-only part of the real App boundary. A
// MemoryRouter lets server rendering execute the same providers and Routes
// tree, including construction of every route element.
vi.mock("react-router-dom", async importOriginal => {
  const router = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...router,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => (
      <router.MemoryRouter initialEntries={[routeState.path]}>{children}</router.MemoryRouter>
    ),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
    removeChannel: vi.fn(),
  },
}));

const materialisePattern = (pattern: string) => {
  const withParams = pattern.replace(/:[A-Za-z][A-Za-z0-9]*/g, "route-smoke-id");
  return `/${withParams.replace(/\*$/, "route-smoke-child")}`.replace(/\/{2,}/g, "/");
};

const appSource = readFileSync("src/App.tsx", "utf8").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const literalPaths = Array.from(
  appSource.matchAll(/<Route\s+path="([^"]+)"/g),
  (match) => match[1],
).filter((path) => path !== "*");

const routePaths = [...new Set([
  "/",
  ...literalPaths.map(materialisePattern),
  ...Object.values(festivalRoutePatterns).map(materialisePattern),
])].sort();

describe("P4 App route-tree render smoke matrix", () => {
  it("discovers a broad route inventory from the live App tree", () => {
    // Guards against accidentally shrinking this back to the old hand-picked
    // festival-only list. RockMundo currently has a large authenticated route
    // surface and P4 should automatically expand when new literal routes land.
    expect(routePaths.length).toBeGreaterThan(100);
  });

  it.each(routePaths)("constructs and renders %s without throwing", path => {
    routeState.path = path;
    expect(() => renderToString(<App />)).not.toThrow();
  });
});
