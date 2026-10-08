import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

const { referralAwareDestination } = await import("./referralDestination");

describe("referralAwareDestination", () => {
  beforeEach(() => rpc.mockReset());

  it("adds the active player's referral and source to the destination", async () => {
    rpc.mockResolvedValue({ data: { code: "rm123456" }, error: null });

    const result = await referralAwareDestination(
      "profile-1",
      "https://rockmundo.uk/music/charts?tab=mine#latest",
      "song_chart_share",
    );

    const url = new URL(result);
    expect(rpc).toHaveBeenCalledWith("get_referral_dashboard", { p_profile_id: "profile-1" });
    expect(url.searchParams.get("ref")).toBe("RM123456");
    expect(url.searchParams.get("source")).toBe("song_chart_share");
    expect(url.searchParams.get("tab")).toBe("mine");
    expect(url.hash).toBe("#latest");
  });

  it("falls back to the original destination when referral lookup fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    const destination = "https://rockmundo.uk/tour-manager?tour=tour-1";

    await expect(referralAwareDestination("profile-1", destination, "tour_share"))
      .resolves.toBe(destination);
  });

  it("does not call the referral RPC without a profile", async () => {
    const destination = "https://rockmundo.uk/world/festivals";
    await expect(referralAwareDestination(null, destination, "festival_share"))
      .resolves.toBe(destination);
    expect(rpc).not.toHaveBeenCalled();
  });
});
