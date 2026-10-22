import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CookingLiveTechniques } from "./CookingLiveTechniques";

const state = vi.hoisted(() => ({
  profileId: null as string | null,
  active: null as { id: string; recipe_slug: string } | null,
  available: [] as Array<{ slug: string; name: string; method: string; portions: number }>,
  ingredients: [] as string[],
  events: [] as Array<{ action_sequence: number; action_type: string;
    ingredient_slug: string | null; heat: string | null; recorded_at: string }>,
  session: null as null | { id: string; recipe_slug: string; status: string;
    started_at: string; expires_at: string; execution_score: number | null },
  requests: [] as Array<Record<string, unknown>>,
}));
const profileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
vi.mock("@/hooks/useActiveProfile", () => ({
  useActiveProfile: () => ({ profileId: state.profileId, profile: null }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const clauses: Record<string, unknown> = {};
      const query: Record<string, unknown> = {};
      query.select = () => query;
      query.eq = (column: string, value: unknown) => { clauses[column] = value; return query; };
      query.in = () => query;
      query.order = () => query;
      query.limit = () => query;
      query.maybeSingle = async () => ({
        data: table === "cooking_sessions" ? state.active
          : table === "cooking_recipes" ? {
              slug: clauses.slug, name: "Apple pie", method: "oven", portions: 6,
            } : null,
        error: null,
      });
      const getRows = () => ({ data: table === "cooking_recipes" ? state.available
        : table === "cooking_recipe_ingredients"
          ? state.ingredients.map(ingredient_slug => ({ ingredient_slug }))
          : [], error: null });
      query.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve(getRows()).then(resolve, reject);
      return query;
    },
    functions: {
      invoke: async (_name: string, args: { body: Record<string, unknown> }) => {
        state.requests.push(args.body);
        if (args.body.action === "status") {
          return { data: {
            session: state.session,
            actions: state.events,
            serverNow: new Date().toISOString(),
          }, error: null };
        }
        if (args.body.action === "serve") {
          return { data: { status: "served", plated: state.ingredients.length }, error: null };
        }
        throw new Error("Unexpected cooking gateway action");
      },
    },
  },
}));
function withQueryClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><CookingLiveTechniques /></QueryClientProvider>);
  return client;
}
afterEach(() => {
  cleanup();
  state.profileId = null;
  state.active = null;
  state.available = [];
  state.ingredients = [];
  state.events = [];
  state.session = null;
  state.requests.length = 0;
});

describe("illustrated live technique release and session isolation", () => {
  it("shows a visual locked workstation when no server recipe is enabled", async () => {
    const client = withQueryClient();
    expect(await screen.findByText(/Live baking, soups and drinks are not released yet/))
      .toBeInTheDocument();
    expect(screen.getByRole("img", { name: /apple pie ready dish illustration/i }))
      .toBeVisible();
    expect(screen.queryByRole("button", { name: "Start cooking" })).toBeNull();
    expect(state.requests).toHaveLength(0);
    client.clear();
  });

  it("restores an unfinished oven session even when its recipe was deactivated", async () => {
    const now = Date.now();
    state.profileId = profileId;
    state.active = { id: sessionId, recipe_slug: "apple-pie" };
    state.available = []; // Release control was switched off mid-session.
    state.ingredients = ["apples", "flour"];
    state.session = {
      id: sessionId, recipe_slug: "apple-pie", status: "running",
      started_at: new Date(now - 5_000).toISOString(),
      expires_at: new Date(now + 115_000).toISOString(),
      execution_score: null,
    };
    const client = withQueryClient();
    await waitFor(() => expect(screen.getByTestId("cooking-equipment-scene"))
      .toHaveAttribute("data-method", "oven"));
    expect(screen.getByText("Apple Pie")).toBeInTheDocument();
    expect(client.getQueryData(["cooking-techniques-active-session", profileId])).toMatchObject({
      id: sessionId, method: "oven",
    });
    expect(client.getQueryData(["cooking-active-session", profileId])).toBeUndefined();
    expect(state.requests.some(request => request.action === "status")).toBe(true);
    client.clear();
  });

  it("plates multiple ingredients with one authenticated server request", async () => {
    const now = Date.now();
    state.profileId = profileId;
    state.active = { id: sessionId, recipe_slug: "apple-pie" };
    state.available = [{ slug: "apple-pie", name: "Apple pie", method: "oven", portions: 6 }];
    state.ingredients = ["apples", "flour"];
    state.session = {
      id: sessionId, recipe_slug: "apple-pie", status: "running",
      started_at: new Date(now - 19_000).toISOString(),
      expires_at: new Date(now + 101_000).toISOString(),
      execution_score: null,
    };
    state.events = [
      { action_sequence: 1, action_type: "add", ingredient_slug: "apples",
        heat: null, recorded_at: new Date(now - 18_000).toISOString() },
      { action_sequence: 2, action_type: "add", ingredient_slug: "flour",
        heat: null, recorded_at: new Date(now - 17_000).toISOString() },
      { action_sequence: 3, action_type: "heat", ingredient_slug: null,
        heat: "medium", recorded_at: new Date(now - 16_000).toISOString() },
    ];
    const client = withQueryClient();
    const serve = await screen.findByRole("button", { name: "Plate all ingredients" });
    await waitFor(() => expect(serve).toBeEnabled());
    fireEvent.click(serve);
    await waitFor(() => expect(state.requests.filter(x => x.action === "serve")).toHaveLength(1));
    expect(state.requests.filter(x => x.action === "remove")).toHaveLength(0);
    expect(state.requests.find(x => x.action === "serve")).toMatchObject({
      profileId, sessionId,
    });
    client.clear();
  });
});
