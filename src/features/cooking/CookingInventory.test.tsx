import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CookingInventory } from "./CookingInventory";

const state = vi.hoisted(() => ({
  profileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  ingredients: [] as Array<Record<string,unknown>>,
  meals: [] as Array<Record<string,unknown>>,
  effects: [] as Array<Record<string,unknown>>,
}));

vi.mock("@/hooks/useActiveProfile", () => ({
  useActiveProfile: () => ({ profileId: state.profileId }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const query: Record<string,unknown> = {};
      for (const method of ["select","eq","gt","order"]) query[method] = () => query;
      const data = table === "cooking_ingredient_lots" ? state.ingredients :
        table === "cooking_food_batches" ? state.meals : state.effects;
      const result = Promise.resolve({ data,error: null });
      query.then = result.then.bind(result);
      return query;
    },
  },
}));
const origin = Date.parse("2026-10-26T10:00:00Z");
const stamp = (minutes: number) => new Date(origin + minutes * 60_000).toISOString();
const mkFood = (id: string, portions: number, minutes: number) => ({
  id, profile_id: state.profileId, recipe_slug: "apple-pie",
  portions, quality: 85, prepared_at: stamp(-60), expires_at: stamp(minutes),
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><CookingInventory /></QueryClientProvider>);
  return client;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  state.ingredients = [];
  state.meals = [];
  state.effects = [];
  state.profileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
});

describe("live cooking kitchen freshness display", () => {
  it("shows edible versus spoiled portions and genuine per-batch freshness bars", async () => {
    vi.spyOn(Date,"now").mockReturnValue(origin);
    state.ingredients = [
      { id: "lot", ingredient_slug: "apples", quantity: 3, quality: 90, expires_at: stamp(120) },
      { id: "old-lot", ingredient_slug: "rice", quantity: 2, quality: 70, expires_at: stamp(-5) },
    ];
    state.meals = [mkFood("soon", 2, 90),mkFood("expired",1,-10),mkFood("empty",0,60)];
    const client = setup();
    const area = await screen.findByRole("region", { name: "Kitchen freshness overview" });
    expect(area).toHaveTextContent("Pantry units");
    expect(area).toHaveTextContent("Edible portions");
    expect(area).toHaveTextContent("Use soon");
    expect(area).toHaveTextContent("Spoiled portions");
    expect(area).toHaveTextContent("3");
    expect(screen.getByText("1 hr 30 min left")).toBeVisible();
    expect(screen.getByText("2 hr left")).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Apple pie shelf life remaining" })).toHaveAttribute(
      "aria-valuenow","60",
    );
    expect(screen.getByRole("button", { name: "Eat 1 portion" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Spoiled" })).toBeDisabled();
    expect(screen.getAllByRole("img",{name: /apple pie ready dish illustration/i})).toHaveLength(2);
    expect(screen.queryByText("0 portion(s)")).toBeNull();
    client.clear();
  });

  it("turns a fresh meal into spoiled food on browser focus without server refetch", async () => {
    const clock = vi.spyOn(Date,"now").mockReturnValue(origin);
    state.meals = [mkFood("soon",2,2)];
    state.effects = [{
      effect_slug: "practice-xp",effect_percent: 5,expires_at: stamp(2),
    }];
    const client = setup();
    expect(await screen.findByRole("button",{name:"Eat 1 portion"})).toBeEnabled();
    expect(screen.getByText("2 min left")).toBeVisible();
    expect(screen.getByRole("region",{name:"Recorded food effects"})).toBeVisible();
    clock.mockReturnValue(origin+3*60_000);
    await act(async () => { fireEvent(window,new Event("focus")); });
    await waitFor(() => expect(screen.getByRole("button",{name:"Spoiled"})).toBeDisabled());
    expect(screen.getByText("Spoiled — cannot eat")).toBeVisible();
    expect(screen.queryByRole("region",{name:"Recorded food effects"})).toBeNull();
    expect(screen.getByRole("progressbar",{name:"Apple pie shelf life remaining"}))
      .toHaveAttribute("aria-valuenow","0");
    client.clear();
  });
});
