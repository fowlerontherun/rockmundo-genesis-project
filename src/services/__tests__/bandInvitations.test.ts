import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeBandInvitationInput, sendBandInvitation } from "../bandInvitations";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import { supabase } from "@/integrations/supabase/client";

const validBandId = "11111111-1111-4111-8111-111111111111";
const validProfileId = "22222222-2222-4222-8222-222222222222";

describe("band invitation service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes valid input", () => {
    expect(normalizeBandInvitationInput({
      bandId: ` ${validBandId} `,
      targetProfileId: validProfileId,
      instrumentRole: " Guitar ",
      vocalRole: " None ",
      message: " Join us ",
    })).toEqual({
      bandId: validBandId,
      targetProfileId: validProfileId,
      instrumentRole: "Guitar",
      vocalRole: "None",
      message: "Join us",
    });
  });

  it("rejects invalid target IDs before calling the backend", async () => {
    await expect(sendBandInvitation({
      bandId: validBandId,
      targetProfileId: "bad-id",
      instrumentRole: "Guitar",
    })).rejects.toThrow("valid player");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("rejects invalid role input before calling the backend", async () => {
    await expect(sendBandInvitation({
      bandId: validBandId,
      targetProfileId: validProfileId,
      instrumentRole: "",
    })).rejects.toThrow("instrument role");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("calls the guarded RPC and returns the invitation", async () => {
    const row = { id: "33333333-3333-4333-8333-333333333333", band_id: validBandId, status: "pending" };
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: row, error: null } as never);

    await expect(sendBandInvitation({
      bandId: validBandId,
      targetProfileId: validProfileId,
      instrumentRole: "Guitar",
      vocalRole: null,
      message: null,
    })).resolves.toBe(row);

    expect(supabase.rpc).toHaveBeenCalledWith("send_band_invitation", {
      target_band_id: validBandId,
      target_profile_id: validProfileId,
      invited_instrument_role: "Guitar",
      invited_vocal_role: null,
      invite_message: null,
    });
  });

  it("surfaces backend permission and duplicate/idempotency errors", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: { message: "This player is not available for band invitations." } } as never);

    await expect(sendBandInvitation({
      bandId: validBandId,
      targetProfileId: validProfileId,
      instrumentRole: "Guitar",
    })).rejects.toThrow("not available");
  });

  it("rejects empty backend responses", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: null } as never);

    await expect(sendBandInvitation({
      bandId: validBandId,
      targetProfileId: validProfileId,
      instrumentRole: "Guitar",
    })).rejects.toThrow("could not be created");
  });
});
