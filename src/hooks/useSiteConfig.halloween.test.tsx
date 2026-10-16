// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSiteConfig } from "./useSiteConfig";

const catalog = vi.hoisted(() => ({
  status: "published",
  fails: false,
  missing: false,
  requested: [] as string[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      catalog.requested.push(table);
      if (table === "system_settings") {
        return {
          select: () => ({
            in: async () => ({
              data: [
                { key: "server_status", value: { status: "degraded", message: "Maintenance" } },
                { key: "halloween_2026_event", value: { enabled: true, rewards_live: true } },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === "avatar_clothing_items") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: catalog.missing ? null : { curated_asset_status: catalog.status },
                error: catalog.fails ? { message: "Catalogue temporarily unavailable" } : null,
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  },
}));

beforeEach(() => {
  catalog.status = "published";
  catalog.fails = false;
  catalog.missing = false;
  catalog.requested.length = 0;
});
afterEach(cleanup);

async function fetchConfig() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useSiteConfig(), { wrapper });
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  return hook.result.current.data;
}

describe("public Halloween publication gate", () => {
  it("only certifies the published hat, not an asset merely staged for visual QA", async () => {
    expect((await fetchConfig())?.halloweenHatPublished).toBe(true);
    catalog.status = "asset_ready";
    expect((await fetchConfig())?.halloweenHatPublished).toBe(false);
    expect(catalog.requested).toContain("avatar_clothing_items");
  });

  it("fails closed for a missing asset without hiding normal site status", async () => {
    catalog.missing = true;
    const config = await fetchConfig();
    expect(config?.halloweenHatPublished).toBe(false);
    expect(config?.server).toEqual({ status: "degraded", message: "Maintenance" });
    expect(config?.halloween.enabled).toBe(true);
  });

  it("keeps existing site settings available if the public catalogue request fails", async () => {
    catalog.fails = true;
    const config = await fetchConfig();
    expect(config?.halloweenHatPublished).toBe(false);
    expect(config?.server.message).toBe("Maintenance");
    expect(config?.halloween.rewards_live).toBe(true);
  });
});
