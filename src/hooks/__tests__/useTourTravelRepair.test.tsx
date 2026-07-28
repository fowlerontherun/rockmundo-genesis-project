import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { useTourTravelRepair } from "@/hooks/useTourTravelRepair";
import {
  regenerateTourTravelLegs,
  syncTourMemberTravel,
} from "@/lib/api/tourTravel";

vi.mock("@/lib/api/tourTravel", () => ({
  regenerateTourTravelLegs: vi.fn(),
  syncTourMemberTravel: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe("useTourTravelRepair", () => {
  beforeEach(() => vi.clearAllMocks());

  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  );

  it("regenerates travel through the authoritative API", async () => {
    vi.mocked(regenerateTourTravelLegs).mockResolvedValue({
      tour_id: "tour-1",
      created: 2,
      existing: 0,
      already_repaired: false,
      request_id: "request-1",
    });

    const { result } = renderHook(() => useTourTravelRepair(), { wrapper });
    await result.current.regenerateTravelLegs.mutateAsync("tour-1");

    expect(regenerateTourTravelLegs).toHaveBeenCalledWith("tour-1");
  });

  it("syncs member travel through the authoritative API", async () => {
    vi.mocked(syncTourMemberTravel).mockResolvedValue({
      tour_id: "tour-1",
      tour_name: "Summer Tour",
      created: 3,
      skipped_existing: 2,
      request_id: "request-2",
    });

    const { result } = renderHook(() => useTourTravelRepair(), { wrapper });
    await result.current.syncMemberTravel.mutateAsync("tour-1");

    expect(syncTourMemberTravel).toHaveBeenCalledWith("tour-1");
  });
});
