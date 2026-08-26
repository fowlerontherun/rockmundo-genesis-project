import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc(this: unknown) {
      if (!this) throw new Error("rpc_client_unbound");
      return Promise.resolve({ data: null, error: null });
    },
  },
}));

describe("festival projection RPC client", () => {
  it("keeps rpc bound to the Supabase client", async () => {
    const { getFestivalEditionSitePlan } = await import("../repository");
    await expect(
      getFestivalEditionSitePlan(
        "3f7b70f6-7b1e-43e9-b890-a2d65164285a",
        "1360260f-c1b2-4335-8cbe-f96338534eba",
      ),
    ).rejects.not.toThrow("rpc_client_unbound");
  });
});
