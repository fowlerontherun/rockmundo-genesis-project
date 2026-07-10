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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeBandInvitationInput(input: SendBandInvitationInput): SendBandInvitationInput {
  const bandId = input.bandId?.trim();
  const targetProfileId = input.targetProfileId?.trim();
  const instrumentRole = input.instrumentRole?.trim();
  const vocalRole = input.vocalRole?.trim() || null;
  const message = input.message?.trim() || null;

  if (!UUID_PATTERN.test(bandId)) {
    throw new Error("Choose a valid band before sending an invitation.");
  }

  if (!UUID_PATTERN.test(targetProfileId)) {
    throw new Error("Choose a valid player to invite.");
  }

  if (!instrumentRole || instrumentRole.length > 50) {
    throw new Error("Choose an instrument role that is 50 characters or fewer.");
  }

  if (vocalRole && vocalRole.length > 50) {
    throw new Error("Choose a vocal role that is 50 characters or fewer.");
  }

  if (message && message.length > 500) {
    throw new Error("Band invitation messages must be 500 characters or fewer.");
  }

  return { bandId, targetProfileId, instrumentRole, vocalRole, message };
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
