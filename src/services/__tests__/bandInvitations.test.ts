import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelBandInvitation,
  normalizeBandInvitationInput,
  normalizeBandInvitationResponseInput,
  respondBandInvitation,
  sendBandInvitation,
} from "../bandInvitations";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import { supabase } from "@/integrations/supabase/client";

const validBandId = "11111111-1111-4111-8111-111111111111";
const validProfileId = "22222222-2222-4222-8222-222222222222";
const validInvitationId = "33333333-3333-4333-8333-333333333333";

describe("band invitation service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes valid send input", () => {
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

  it("rejects overlong invite messages before calling the backend", async () => {
    await expect(sendBandInvitation({
      bandId: validBandId,
      targetProfileId: validProfileId,
      instrumentRole: "Guitar",
      message: "x".repeat(281),
    })).rejects.toThrow("280 characters");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("calls the guarded send RPC and returns the invitation", async () => {
    const row = { id: validInvitationId, band_id: validBandId, status: "pending" };
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

  it("normalizes valid response input and rejects invalid response status", () => {
    expect(normalizeBandInvitationResponseInput(` ${validInvitationId} `, "accepted")).toEqual({
      invitationId: validInvitationId,
      status: "accepted",
    });
    expect(() => normalizeBandInvitationResponseInput(validInvitationId, "cancelled" as never)).toThrow("accept or decline");
  });

  it("rejects invalid invitation IDs before response RPC calls", async () => {
    await expect(respondBandInvitation("bad-id", "accepted")).rejects.toThrow("valid band invitation");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("calls guarded response RPC for accepts and returns idempotent data", async () => {
    const row = { id: validInvitationId, band_id: validBandId, status: "accepted" };
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: row, error: null } as never);

    await expect(respondBandInvitation(validInvitationId, "accepted")).resolves.toBe(row);
    expect(supabase.rpc).toHaveBeenCalledWith("respond_band_invitation", {
      invitation_id: validInvitationId,
      response_status: "accepted",
    });
  });

  it("surfaces backend response permission and duplicate-action errors", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: { message: "This band invitation is no longer pending." } } as never);

    await expect(respondBandInvitation(validInvitationId, "declined")).rejects.toThrow("no longer pending");
  });

  it("rejects empty response RPC results", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: null } as never);

    await expect(respondBandInvitation(validInvitationId, "accepted")).rejects.toThrow("could not be saved");
  });

  it("calls guarded cancel RPC and returns cancellation state", async () => {
    const row = { id: validInvitationId, band_id: validBandId, status: "cancelled" };
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: row, error: null } as never);

    await expect(cancelBandInvitation(validInvitationId)).resolves.toBe(row);
    expect(supabase.rpc).toHaveBeenCalledWith("cancel_band_invitation", {
      invitation_id: validInvitationId,
    });
  });
});
