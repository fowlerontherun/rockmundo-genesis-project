import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { useTourCatchUp, getCatchUpErrorMessage } from "@/hooks/useTourCatchUp";
import { catchUpToTour } from "@/lib/api/tourCatchUp";

vi.mock("@/lib/api/tourCatchUp", () => ({ catchUpToTour: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe("useTourCatchUp", () => {
  beforeEach(() => vi.clearAllMocks());

  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  );

  it("uses the authoritative catch-up API", async () => {
    vi.mocked(catchUpToTour).mockResolvedValue({
      tour_id: "tour-1",
      profile_id: "profile-1",
      travel_id: "travel-1",
      fee: 1500,
      arrival_time: "2026-07-29T00:00:00Z",
      request_id: "request-1",
    });

    const { result } = renderHook(() => useTourCatchUp(), { wrapper });
    await result.current.catchUp.mutateAsync({
      tourId: "tour-1",
      profileId: "profile-1",
    });

    expect(catchUpToTour).toHaveBeenCalledWith("tour-1", "profile-1");
  });

  it("maps insufficient funds without implying a partial charge", () => {
    expect(getCatchUpErrorMessage("tour_catch_up_insufficient_funds")).toBe(
      "You need £1,500 to charter a catch-up flight.",
    );
    expect(getCatchUpErrorMessage("unknown")).toContain("No money was charged");
  });
});
