// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import App from "../App";

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

describe("App route-tree render smoke test", () => {
  const paths = [
    "/", "/world/festivals", "/festivals", "/festivals/simulation?source=legacy",
    "/festival-company/found",
    "/festival-company/11111111-1111-4111-8111-111111111111",
    "/festival-company/11111111-1111-4111-8111-111111111111/upgrades",
    "/festival-company/11111111-1111-4111-8111-111111111111/editions",
    "/festival-company/11111111-1111-4111-8111-111111111111/editions/22222222-2222-4222-8222-222222222222",
  ];

  it.each(paths)("constructs and renders %s without throwing", path => {
    routeState.path = path;
    expect(() => renderToString(<App />)).not.toThrow();
  });
});
