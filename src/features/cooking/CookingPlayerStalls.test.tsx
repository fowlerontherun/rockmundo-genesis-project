import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CookingPlayerStalls } from "./CookingPlayerStalls";

const state = vi.hoisted(() => ({
  enabled: false,
  profileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  cityId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  listings: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/hooks/useActiveProfile", () => ({
  useActiveProfile: () => ({
    profileId: state.profileId,
    profile: { current_city_id: state.cityId },
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ name, args });
      if (name === "browse_cooking_food_stalls") {
        return { data: { enabled: state.enabled, cityId: state.cityId, listings: state.listings }, error: null };
      }
      if (name === "purchase_cooking_food_stall_listing") {
        return { data: { status: "completed", subtotal: 150, fee: 7, batchId: "new" }, error: null };
      }
      return { data: { status: "completed" }, error: null };
    },
    from: (_table: string) => {
      const query: Record<string, unknown> = {};
      for (const method of ["select", "eq", "gt", "order", "limit"]) query[method] = () => query;
      const rows = Promise.resolve({ data: [], error: null });
      query.then = rows.then.bind(rows);
      return query;
    },
  },
}));

function renderStalls() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><CookingPlayerStalls /></QueryClientProvider>);
  return { client, ...view };
}

afterEach(() => {
  cleanup();
  state.enabled = false;
  state.listings = [];
  state.rpcCalls = [];
  state.profileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  state.cityId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  window.sessionStorage.clear();
});

describe("illustrated player cooking stalls", () => {
  it("remains informational when the trusted release control is OFF", async () => {
    const { client } = renderStalls();
    await screen.findByText(/Player food trading is being prepared/);
    expect(screen.queryByRole("button", { name: /Buy \$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "List fresh portions" })).toBeNull();
    expect(state.rpcCalls).toEqual([{
      name: "browse_cooking_food_stalls",
      args: { p_profile_id: state.profileId, p_limit: 40 },
    }]);
    client.clear();
  });

  it("purchases only through the authenticated server RPC when enabled", async () => {
    state.enabled = true;
    state.listings = [{
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      recipeSlug: "rice-bowl",sellerName: "Local cook",quality: 80,
      portions: 2,pricePerPortion: 150,
      expiresAt: "2099-10-23T10:00:00Z",
      batchExpiresAt: "2099-10-23T10:00:00Z",
    }];
    const { client } = renderStalls();
    const buy = await screen.findByRole("button", { name: /Buy \$150/ });
    fireEvent.click(buy);
    await waitFor(() => expect(state.rpcCalls.some(call =>
      call.name === "purchase_cooking_food_stall_listing" &&
      call.args.p_buyer_profile_id === state.profileId &&
      call.args.p_listing_id === "dddddddd-dddd-4ddd-8ddd-dddddddddddd" &&
      call.args.p_portions === 1 &&
      typeof call.args.p_request_id === "string",
    )).toBe(true));
    await screen.findByText(/Food purchased for \$150/);
    client.clear();
  });

  it("does not expose a previous character's cached city listings", async () => {
    state.enabled = true;
    state.listings = [{
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      recipeSlug: "apple-pie",sellerName: "Neighbour",quality: 70,
      portions: 1,pricePerPortion: 100,
      expiresAt: "2099-10-23T10:00:00Z",batchExpiresAt: "2099-10-23T10:00:00Z",
    }];
    const { client, rerender } = renderStalls();
    await screen.findByRole("button", { name: /Buy \$100/ });
    state.profileId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    state.cityId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    state.listings = [];
    rerender(<QueryClientProvider client={client}><CookingPlayerStalls /></QueryClientProvider>);
    await waitFor(() => expect(screen.queryByRole("button", { name: /Buy \$100/ })).toBeNull());
    expect(state.rpcCalls.some(call => call.name === "browse_cooking_food_stalls"
      && call.args.p_profile_id === state.profileId)).toBe(true);
    client.clear();
  });
});
