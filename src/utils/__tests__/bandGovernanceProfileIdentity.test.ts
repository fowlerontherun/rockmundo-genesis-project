import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}));

import { supabase } from "@/integrations/supabase/client";
import { disbandBand, getEligibleLeaders, transferLeadership } from "@/utils/bandMembers";

describe("band governance selected-character client flows", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes profile UUIDs, not account UUIDs, to leadership transfer", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: null } as never);
    await expect(transferLeadership("band", "leader-profile", "successor-profile"))
      .resolves.toEqual({ success: true });
    expect(supabase.rpc).toHaveBeenCalledWith("transfer_band_leadership_atomic", {
      p_band_id: "band",
      p_current_leader_id: "leader-profile",
      p_new_leader_id: "successor-profile",
    });
  });

  it("disbands through one atomic database call and rejects unconfirmed writes", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: true, error: null } as never);
    await expect(disbandBand("band", "leader-profile")).resolves.toEqual({ success: true });
    expect(supabase.rpc).toHaveBeenCalledWith("disband_band_atomic", {
      p_band_id: "band",
      p_leader_profile_id: "leader-profile",
    });
    expect(supabase.from).not.toHaveBeenCalled();
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: false, error: null } as never);
    await expect(disbandBand("band", "leader-profile")).rejects.toThrow("not confirmed");
  });

  it("excludes inactive, touring, former, dead and deleted successor profiles", async () => {
    const query = {
      select: vi.fn(), eq: vi.fn(), neq: vi.fn(), is: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.neq.mockReturnValue(query);
    query.is.mockImplementation((column: string) => column === "profiles.died_at"
      ? Promise.resolve({ data: [{ profile_id: "candidate", profiles: { display_name: "Candidate" } }], error: null })
      : query);
    vi.mocked(supabase.from).mockReturnValueOnce(query as never);
    await expect(getEligibleLeaders("band", "leader-profile")).resolves.toHaveLength(1);
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining("band_members_profile_id_fkey!inner"));
    expect(query.eq).toHaveBeenCalledWith("member_status", "active");
    expect(query.eq).toHaveBeenCalledWith("is_touring_member", false);
    expect(query.eq).toHaveBeenCalledWith("profiles.is_active", true);
    expect(query.neq).toHaveBeenCalledWith("profile_id", "leader-profile");
    expect(query.is).toHaveBeenCalledWith("profiles.deleted_at", null);
    expect(query.is).toHaveBeenCalledWith("profiles.died_at", null);
  });
});
