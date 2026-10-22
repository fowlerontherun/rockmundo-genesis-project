import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CookingLiveKitchen } from "./CookingLiveKitchen";

const state = vi.hoisted(() => ({
  profileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  requests: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/hooks/useActiveProfile", () => ({
  useActiveProfile: () => ({ profileId: state.profileId }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const query: Record<string, any> = {};
      for (const method of ["select", "eq", "in", "order", "limit", "gt", "is"]) {
        query[method] = () => query;
      }
      query.maybeSingle = async () => ({
        data: table === "cooking_sessions" && state.profileId.startsWith("aaaa")
          ? { id: "11111111-1111-4111-8111-111111111111", recipe_slug: "rice-bowl" }
          : null,
        error: null,
      });
      const rows = Promise.resolve({ data: [], error: null });
      query.then = rows.then.bind(rows);
      return query;
    },
    functions: {
      invoke: async (_name: string, args: { body: Record<string, unknown> }) => {
        state.requests.push(args.body);
        return {
          data: {
            session: {
              id: args.body.sessionId,
              recipe_slug: "rice-bowl",
              mode: "manual",
              status: "running",
              started_at: "2026-10-22T08:00:00.000Z",
              expires_at: "2090-10-22T08:02:00.000Z",
              finished_at: null,
              execution_score: null,
              result_batch_id: null,
            },
            actions: [],
            serverNow: "2026-10-22T08:00:05.000Z",
          },
          error: null,
        };
      },
    },
  },
}));

afterEach(() => {
  cleanup();
  state.requests.length = 0;
  state.profileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
});

describe("live kitchen character isolation", () => {
  it("uses the current profile in authenticated status requests", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <CookingLiveKitchen />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(state.requests.length).toBeGreaterThan(0));
    expect(state.requests[0]).toMatchObject({
      profileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      action: "status",
      sessionId: "11111111-1111-4111-8111-111111111111",
    });
    client.clear();
  });

  it("discards a previous character's selected cooking session after switching", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = () => (
      <QueryClientProvider client={client}>
        <CookingLiveKitchen />
      </QueryClientProvider>
    );
    const { rerender } = render(view());
    await screen.findByText("Rice Bowl");

    state.profileId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    rerender(view());
    await screen.findByText(/No production pan recipes are enabled yet/);
    expect(screen.queryByText("Rice Bowl")).toBeNull();
    client.clear();
  });
});
