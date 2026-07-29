import { beforeEach, describe, expect, it, vi } from "vitest";
import { catchUpToTour } from "@/lib/api/tourCatchUp";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));

describe("catchUpToTour", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses one authoritative RPC for payment and travel creation", async () => {
    vi.mocked(supabase.rpc as any).mockResolvedValue({
      data: {
        tour_id: "tour-1",
        profile_id: "profile-1",
        travel_id: "travel-1",
        fee: 1500,
        arrival_time: "2026-07-29T00:00:00Z",
        already_booked: false,
        request_id: "request-1",
      },
      error: null,
    });

    const result = await catchUpToTour("tour-1", "profile-1", "request-1");

    expect(supabase.rpc).toHaveBeenCalledWith("catch_up_to_tour", {
      p_tour_id: "tour-1",
      p_profile_id: "profile-1",
      p_request_id: "request-1",
    });
    expect(result.fee).toBe(1500);
  });

  it("propagates database failures without a client-side fallback", async () => {
    vi.mocked(supabase.rpc as any).mockResolvedValue({
      data: null,
      error: new Error("tour_catch_up_insufficient_funds"),
    });

    await expect(
      catchUpToTour("tour-1", "profile-1", "request-2"),
    ).rejects.toThrow("tour_catch_up_insufficient_funds");
  });
});
