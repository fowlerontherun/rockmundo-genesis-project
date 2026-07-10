import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

const { sendSocialInvite, respondSocialInvite, __socialInviteTestUtils } = await import("../services/socialInvites");

const profileId = "22222222-2222-4222-8222-222222222222";
const inviteId = "33333333-3333-4333-8333-333333333333";

beforeEach(() => vi.clearAllMocks());

describe("social invite safety service", () => {
  it("validates and trims invite input before backend writes", () => {
    expect(__socialInviteTestUtils.validateSocialInviteInput({ toProfileId: profileId, kind: "jam", message: " hi " })).toMatchObject({
      target_profile_id: profileId,
      invite_kind: "jam",
      invite_message: "hi",
    });
  });

  it("rejects invalid target profiles before backend writes", async () => {
    await expect(sendSocialInvite({ toProfileId: "bad", kind: "jam" })).rejects.toThrow("valid player");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects overlong invite messages before backend writes", async () => {
    await expect(sendSocialInvite({ toProfileId: profileId, kind: "jam", message: "x".repeat(281) })).rejects.toThrow("280");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends valid invites through the guarded RPC", async () => {
    rpc.mockResolvedValueOnce({ data: { id: inviteId, status: "pending", kind: "jam" }, error: null });
    await expect(sendSocialInvite({ toProfileId: profileId, kind: "jam", message: " hi " })).resolves.toMatchObject({ status: "pending" });
    expect(rpc).toHaveBeenCalledWith("send_social_invite", expect.objectContaining({ target_profile_id: profileId, invite_kind: "jam", invite_message: "hi" }));
  });

  it("treats duplicate pending invites as idempotent backend success", async () => {
    rpc.mockResolvedValueOnce({ data: { id: inviteId, status: "pending" }, error: null });
    await expect(sendSocialInvite({ toProfileId: profileId, kind: "meetup" })).resolves.toMatchObject({ id: inviteId });
  });

  it("responds to pending invites through the guarded RPC", async () => {
    rpc.mockResolvedValueOnce({ data: { id: inviteId, status: "accepted" }, error: null });
    await expect(respondSocialInvite(inviteId, "accepted")).resolves.toMatchObject({ status: "accepted" });
    expect(rpc).toHaveBeenCalledWith("respond_social_invite", { invite_id: inviteId, next_status: "accepted" });
  });

  it("rejects invalid response statuses before backend writes", async () => {
    await expect(respondSocialInvite(inviteId, "expired")).rejects.toThrow("accept, decline, or cancel");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps blocked backend failures to friendly errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "This player is not available for invites." } });
    await expect(sendSocialInvite({ toProfileId: profileId, kind: "jam" })).rejects.toThrow("not available");
  });

  it("maps unauthenticated backend failures to friendly errors", () => {
    expect(__socialInviteTestUtils.friendlySocialInviteError("Sign in with an active player profile before sending invites.")).toContain("Sign in");
  });
});
