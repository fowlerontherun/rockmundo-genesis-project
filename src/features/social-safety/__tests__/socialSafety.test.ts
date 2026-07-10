import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

const {
  blockProfile,
  fetchSocialSafetyStatus,
  muteProfile,
  reportSocialTarget,
  unblockProfile,
} = await import("../services/socialSafety");

const viewerProfileId = "11111111-1111-4111-8111-111111111111";
const targetProfileId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => vi.clearAllMocks());

describe("social safety service", () => {
  it("loads blocked and muted status through shared RPC guards", async () => {
    rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });

    await expect(fetchSocialSafetyStatus(viewerProfileId, targetProfileId)).resolves.toEqual({ isBlocked: true, isMuted: false });
    expect(rpc).toHaveBeenCalledWith("are_profiles_blocked", { first_profile_id: viewerProfileId, second_profile_id: targetProfileId });
    expect(rpc).toHaveBeenCalledWith("is_profile_muted", { viewer_profile_id: viewerProfileId, target_profile_id: targetProfileId });
  });

  it("validates target IDs before block RPC calls", async () => {
    await expect(blockProfile("not-a-uuid")).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls block_profile with a trimmed optional note", async () => {
    rpc.mockResolvedValueOnce({ data: { blocked_profile_id: targetProfileId }, error: null });

    await blockProfile(targetProfileId, " spam ");
    expect(rpc).toHaveBeenCalledWith("block_profile", { target_profile_id: targetProfileId, note: "spam" });
  });

  it("calls unblock_profile idempotently", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });

    await expect(unblockProfile(targetProfileId)).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("unblock_profile", { target_profile_id: targetProfileId });
  });

  it("rejects overlong mute notes before backend writes", async () => {
    await expect(muteProfile(targetProfileId, "x".repeat(281))).rejects.toThrow("280");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("validates report reason length before submitting", async () => {
    await expect(reportSocialTarget({
      reportedProfileId: targetProfileId,
      targetType: "profile",
      category: "spam",
      reason: "short",
    })).rejects.toThrow("at least 10");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("submits a validated report with safe context", async () => {
    rpc.mockResolvedValueOnce({ data: { id: "33333333-3333-4333-8333-333333333333" }, error: null });

    await reportSocialTarget({
      reportedProfileId: targetProfileId,
      targetType: "profile",
      category: "harassment",
      reason: "Repeated unwanted messages after I asked them to stop.",
      context: { surface: "test" },
    });

    expect(rpc).toHaveBeenCalledWith("report_social_target", {
      reported_profile_id: targetProfileId,
      target_type: "profile",
      target_id: null,
      category: "harassment",
      reason: "Repeated unwanted messages after I asked them to stop.",
      context: { surface: "test" },
    });
  });
});
