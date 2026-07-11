import { supabase } from "@/integrations/supabase/client";

export interface SendBandInvitationInput {
  bandId: string;
  targetProfileId: string;
  instrumentRole: string;
  vocalRole?: string | null;
  message?: string | null;
}

export interface BandInvitationResult {
  id: string;
  band_id: string;
  inviter_user_id: string;
  invited_user_id: string;
  instrument_role: string;
  vocal_role: string | null;
  message: string | null;
  status: string;
  created_at: string;
  responded_at: string | null;
}

export type BandInvitationResponseStatus = "accepted" | "declined";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(value: string | undefined | null, message: string): string {
  const normalized = value?.trim();
  if (!normalized || !UUID_PATTERN.test(normalized)) {
    throw new Error(message);
  }
  return normalized;
}

export function normalizeBandInvitationInput(input: SendBandInvitationInput): SendBandInvitationInput {
  const bandId = assertUuid(input.bandId, "Choose a valid band before sending an invitation.");
  const targetProfileId = assertUuid(input.targetProfileId, "Choose a valid player to invite.");
  const instrumentRole = input.instrumentRole?.trim();
  const vocalRole = input.vocalRole?.trim() || null;
  const message = input.message?.trim() || null;

  if (!instrumentRole || instrumentRole.length > 50) {
    throw new Error("Choose an instrument role that is 50 characters or fewer.");
  }

  if (vocalRole && vocalRole.length > 50) {
    throw new Error("Choose a vocal role that is 50 characters or fewer.");
  }

  if (message && message.length > 280) {
    throw new Error("Band invitation messages must be 280 characters or fewer.");
  }

  return { bandId, targetProfileId, instrumentRole, vocalRole, message };
}

export function normalizeBandInvitationResponseInput(invitationId: string, status: BandInvitationResponseStatus) {
  const normalizedInvitationId = assertUuid(invitationId, "Choose a valid band invitation.");
  if (status !== "accepted" && status !== "declined") {
    throw new Error("Choose accept or decline for this band invitation.");
  }
  return { invitationId: normalizedInvitationId, status };
}

export async function sendBandInvitation(input: SendBandInvitationInput): Promise<BandInvitationResult> {
  const normalized = normalizeBandInvitationInput(input);

  const { data, error } = await (supabase.rpc as any)("send_band_invitation", {
    target_band_id: normalized.bandId,
    target_profile_id: normalized.targetProfileId,
    invited_instrument_role: normalized.instrumentRole,
    invited_vocal_role: normalized.vocalRole,
    invite_message: normalized.message,
  });

  if (error) {
    throw new Error(error.message || "Failed to send band invitation.");
  }

  if (!data) {
    throw new Error("Band invitation could not be created.");
  }

  return data as BandInvitationResult;
}

export async function respondBandInvitation(invitationId: string, status: BandInvitationResponseStatus): Promise<BandInvitationResult> {
  const normalized = normalizeBandInvitationResponseInput(invitationId, status);
  const { data, error } = await (supabase.rpc as any)("respond_band_invitation", {
    invitation_id: normalized.invitationId,
    response_status: normalized.status,
  });

  if (error) {
    throw new Error(error.message || "Failed to respond to band invitation.");
  }
  if (!data) {
    throw new Error("Band invitation response could not be saved.");
  }
  return data as BandInvitationResult;
}

export async function cancelBandInvitation(invitationId: string): Promise<BandInvitationResult> {
  const normalizedInvitationId = assertUuid(invitationId, "Choose a valid band invitation.");
  const { data, error } = await (supabase.rpc as any)("cancel_band_invitation", {
    invitation_id: normalizedInvitationId,
  });

  if (error) {
    throw new Error(error.message || "Failed to cancel band invitation.");
  }
  if (!data) {
    throw new Error("Band invitation cancellation could not be saved.");
  }
  return data as BandInvitationResult;
}

export function friendlyBandInvitationError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (!message) return "Something went wrong sending that band invitation.";
  if (/duplicate|already/i.test(message)) return "That musician already has a pending invitation.";
  if (/not.*friend/i.test(message)) return "You can only invite friends to your band.";
  if (/uuid|invalid/i.test(message)) return "That invitation target isn't valid.";
  return message;
}
