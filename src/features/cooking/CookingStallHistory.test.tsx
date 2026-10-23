import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CookingStallHistory, deriveCookingStallHistory, type CookingStallSale, type CookingStallExpiry, type CookingStallCancellation } from "./CookingStallHistory";

const profileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const sale: CookingStallSale = {
  id: "sale-1", listing_id: "listing-1", buyer_profile_id: otherId, seller_profile_id: profileId,
  portions: 2, subtotal: 200, city_fee: 10, seller_proceeds: 190,
  purchased_at: "2026-10-23T12:00:00Z",
  recipe_slug: "rice-bowl",quality: 80,food_expires_at: "2026-10-24T13:00:00Z",
};
const expiry: CookingStallExpiry = {
  id: "expiry-1", listing_id: "listing-2", seller_profile_id: profileId,
  returned_portions: 2, spoiled_portions: 0, processed_at: "2026-10-23T13:00:00Z",
  recipe_slug: "apple-pie",quality: 90,food_expires_at: "2026-10-25T13:00:00Z",
};
const cancellation: CookingStallCancellation = {
  id: "cancel-1", listing_id: "listing-3", seller_profile_id: profileId,
  returned_portions: 1, cancelled_at: "2026-10-23T14:00:00Z",
  recipe_slug: "fruit-tart", quality: 95, food_expires_at: "2026-10-25T13:00:00Z",
};
const state = vi.hoisted(() => ({
  selectedProfile: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  calls: [] as Array<{ table: string; column: string; profileId: string }>,
}));

vi.mock("@/hooks/useActiveProfile", () => ({
  useActiveProfile: () => ({ profileId: state.selectedProfile }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const query: Record<string, unknown> = {};
      for (const method of ["select", "order", "limit"]) query[method] = () => query;
      query.eq = (column: string, value: string) => {
        state.calls.push({ table, column, profileId: value });
        return query;
      };
      const data = table === "cooking_food_stall_cancellation_events"
        ? [{ id: "cancel-1", listing_id: "listing-3", seller_profile_id: state.selectedProfile,
          returned_portions: 1, cancelled_at: "2026-10-23T14:00:00Z",
          recipe_slug: "fruit-tart", quality: 95, food_expires_at: "2026-10-25T13:00:00Z" }]
        : table === "cooking_food_stall_expiry_events"
        ? [{ id: "expiry-1", listing_id: "listing-2", seller_profile_id: state.selectedProfile,
          returned_portions: 2, spoiled_portions: 0, processed_at: "2026-10-23T13:00:00Z",
          recipe_slug: "apple-pie",quality: 90,food_expires_at: "2026-10-25T13:00:00Z" }]
        : table === "cooking_food_stall_sales"
          ? [{ id: "sale-1", listing_id: "listing-1", buyer_profile_id: otherId,
            seller_profile_id: state.selectedProfile, portions: 2,subtotal: 200,
            city_fee: 10,seller_proceeds: 190,purchased_at: "2026-10-23T12:00:00Z",
            recipe_slug: "rice-bowl",quality: 80,food_expires_at: "2026-10-24T13:00:00Z" }]
          : [];
      const response = Promise.resolve({ data, error: null });
      query.then = response.then.bind(response);
      return query;
    },
  },
}));

afterEach(() => {
  cleanup();
  state.selectedProfile = profileId;
  state.calls.length = 0;
});

describe("food stall history receipts", () => {
  it("deduplicates receipts and preserves the server's fee arithmetic", () => {
    const result = deriveCookingStallHistory(profileId, [sale], [sale], [expiry], [cancellation]);
    expect(result.map(item => item.kind)).toEqual(["cancelled", "expired", "sold"]);
    expect(result).toHaveLength(3);
    expect(result[2].kind === "sold" && result[2].sale.seller_proceeds).toBe(190);
  });

  it("never renders unrelated player rows, even if a network response includes them", () => {
    const stolen = { ...sale, id: "stolen",seller_profile_id: otherId,buyer_profile_id: otherId };
    const stolenExpiry = { ...expiry,id: "stolen-expiry",seller_profile_id: otherId };
    const stolenCancellation = { ...cancellation,id: "stolen-cancel",seller_profile_id: otherId };
    expect(deriveCookingStallHistory(profileId,[stolen],[stolen],[stolenExpiry],[stolenCancellation])).toEqual([]);
    const bought = { ...sale, buyer_profile_id: profileId,seller_profile_id: otherId };
    const result = deriveCookingStallHistory(profileId,[bought],[],[]);
    expect(result.map(item => item.kind)).toEqual(["bought"]);
  });

  it("loads only selected-character transactions and displays recent earnings", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><CookingStallHistory /></QueryClientProvider>);
    await screen.findByText(/Food sold · Mushroom rice bowl/);
    expect(screen.getByText("$190")).toBeInTheDocument();
    expect(screen.getByText(/Quality 80\/100/)).toBeInTheDocument();
    expect(screen.getByText("$10", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("3 portions")).toBeInTheDocument();
    expect(state.calls).toEqual(expect.arrayContaining([
      { table: "cooking_food_stall_sales",column: "seller_profile_id",profileId },
      { table: "cooking_food_stall_sales",column: "buyer_profile_id",profileId },
      { table: "cooking_food_stall_expiry_events",column: "seller_profile_id",profileId },
      { table: "cooking_food_stall_cancellation_events",column: "seller_profile_id",profileId },
    ]));
    fireEvent.click(screen.getByRole("button", { name: "Expired listings" }));
    expect(screen.getByText(/Listing expired · Apple pie/)).toBeInTheDocument();
    expect(screen.queryByText(/Food sold · Mushroom rice bowl/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancelled" }));
    expect(screen.getByText(/Listing cancelled · Fruit tart/)).toBeInTheDocument();
    expect(screen.getByText(/1 fresh portion\(s\) returned to your kitchen/)).toBeInTheDocument();
    expect(screen.queryByText(/Listing expired · Apple pie/)).toBeNull();
    client.clear();
  });
});
