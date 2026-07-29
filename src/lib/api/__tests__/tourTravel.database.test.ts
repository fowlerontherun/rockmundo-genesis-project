import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");

const { supabase } = await import("@/integrations/supabase/client");
const { regenerateTourTravelLegs, syncTourMemberTravel } = await import("@/lib/api/tourTravel");

const rpcMock = vi.fn();

beforeEach(() => {
  rpcMock.mockReset();
  (supabase as any).rpc = rpcMock;
});

describe("authoritative tour travel repair service", () => {
  it("regenerates missing travel legs through one idempotent RPC", async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        tour_id: "tour-1",
        created: 3,
        existing: 0,
        already_repaired: false,
        request_id: "request-1",
      },
      error: null,
    });

    await expect(regenerateTourTravelLegs("tour-1", "request-1")).resolves.toMatchObject({
      created: 3,
      already_repaired: false,
    });

    expect(rpcMock).toHaveBeenCalledWith("regenerate_tour_travel_legs", {
      p_tour_id: "tour-1",
      p_request_id: "request-1",
    });
  });

  it("syncs newly eligible members through one transaction", async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        tour_id: "tour-1",
        tour_name: "UK Run",
        created: 4,
        skipped_existing: 6,
        request_id: "request-2",
      },
      error: null,
    });

    await expect(syncTourMemberTravel("tour-1", "request-2")).resolves.toMatchObject({
      created: 4,
      skipped_existing: 6,
    });

    expect(rpcMock).toHaveBeenCalledWith("sync_tour_member_travel", {
      p_tour_id: "tour-1",
      p_request_id: "request-2",
    });
  });

  it("propagates repair failures without falling back to direct writes", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: new Error("tour_travel_repair_route_impossible"),
    });

    await expect(regenerateTourTravelLegs("tour-1", "request-3")).rejects.toThrow(
      "tour_travel_repair_route_impossible",
    );
  });
});
