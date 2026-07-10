import { describe, expect, it, vi, beforeEach } from "vitest";
import { sendBandInvitation, __bandInvitationTestUtils } from "../bandInvitations";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

const bandId = "11111111-1111-4111-8111-111111111111";
const profileId = "22222222-2222-4222-8222-222222222222";
const inviteId = "33333333-3333-4333-8333-333333333333";

describe("band invitation safety service", () => {
  beforeEach(() => rpc.mockReset());

  it("validates and trims invite input before backend writes", () => {
    expect(__bandInvitationTestUtils.normalizeBandInvitationInput({ bandId, targetProfileId: profileId, instrumentRole: "Guitar", vocalRole: "None", message: " hi " })).toMatchObject({ invite_message: "hi", requested_vocal_role: null });
  });

  it("rejects invalid players before backend writes", async () => {
    await expect(sendBandInvitation({ bandId, targetProfileId: "bad", instrumentRole: "Guitar" })).rejects.toThrow("valid player");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects overlong messages before backend writes", async () => {
    await expect(sendBandInvitation({ bandId, targetProfileId: profileId, instrumentRole: "Guitar", message: "x".repeat(281) })).rejects.toThrow("280");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends valid invitations through the guarded RPC", async () => {
    rpc.mockResolvedValueOnce({ data: { id: inviteId, status: "pending" }, error: null });
    await expect(sendBandInvitation({ bandId, targetProfileId: profileId, instrumentRole: "Bass", vocalRole: "Backing Vocals" })).resolves.toMatchObject({ id: inviteId });
    expect(rpc).toHaveBeenCalledWith("send_band_invitation", expect.objectContaining({ target_band_id: bandId, target_profile_id: profileId }));
  });

  it("treats duplicate pending invitations as idempotent backend success", async () => {
    rpc.mockResolvedValueOnce({ data: { id: inviteId, status: "pending" }, error: null });
    await expect(sendBandInvitation({ bandId, targetProfileId: profileId, instrumentRole: "Keyboard" })).resolves.toMatchObject({ status: "pending" });
  });

  it("maps unauthorised and privacy backend failures to user-facing errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "This player is not available for band invitations." } });
    await expect(sendBandInvitation({ bandId, targetProfileId: profileId, instrumentRole: "Guitar" })).rejects.toThrow("not available");
  });
});
