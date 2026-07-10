import { supabase } from "@/integrations/supabase/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_INSTRUMENTS = new Set(["Guitar", "Bass", "Drums", "Keyboard", "Other"]);
const VALID_VOCALS = new Set(["Lead Vocals", "Backing Vocals", "None"]);

export interface SendBandInvitationInput {
  bandId: string;
  targetProfileId: string;
  instrumentRole: string;
  vocalRole?: string | null;
  message?: string | null;
}

export function normalizeBandInvitationInput(input: SendBandInvitationInput) {
  if (!UUID_RE.test(input.bandId || "")) throw new Error("Choose a valid band.");
  if (!UUID_RE.test(input.targetProfileId || "")) throw new Error("Choose a valid player to invite.");
  if (!VALID_INSTRUMENTS.has(input.instrumentRole)) throw new Error("Choose a valid instrument role.");
  const vocalRole = input.vocalRole && input.vocalRole !== "None" ? input.vocalRole : null;
  if (vocalRole && !VALID_VOCALS.has(vocalRole)) throw new Error("Choose a valid vocal role.");
  const message = (input.message || "").trim();
  if (message.length > 280) throw new Error("Band invitation messages must be 280 characters or fewer.");

  return {
    target_profile_id: input.targetProfileId,
    target_band_id: input.bandId,
    requested_instrument_role: input.instrumentRole,
    requested_vocal_role: vocalRole,
    invite_message: message || null,
  };
}

export function friendlyBandInvitationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (!message) return "We couldn't send that band invitation. Please try again.";
  if (/active player profile|not authenticated|JWT|28000/i.test(message)) return "Sign in with an active player profile before sending band invitations.";
  if (/not allowed|permission denied|leader|Founder|42501|row-level security/i.test(message)) return "Only authorised band leaders can invite players to that band.";
  if (/not available|blocked|privacy|band invitations/i.test(message)) return "That player is not available for band invitations.";
  if (/already belongs|already a member/i.test(message)) return "That player is already in this band.";
  if (/valid|choose|280/i.test(message)) return message;
  return message;
}

export async function sendBandInvitation(input: SendBandInvitationInput) {
  const params = normalizeBandInvitationInput(input);
  const { data, error } = await (supabase as any).rpc("send_band_invitation", params);
  if (error) throw new Error(friendlyBandInvitationError(error));
  return data;
}

export const __bandInvitationTestUtils = { normalizeBandInvitationInput, friendlyBandInvitationError };
