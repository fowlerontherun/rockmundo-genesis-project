import { supabase } from "@/integrations/supabase/client";
import type { SocialInviteKind, SocialInviteRow, SocialInviteStatus } from "@/hooks/useSocialInvites";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const MAX_INVITE_MESSAGE_LENGTH = 280;

export interface SendSocialInviteInput {
  toProfileId: string | null | undefined;
  kind: SocialInviteKind;
  scheduledAt?: string | null;
  locationCityId?: string | null;
  refId?: string | null;
  message?: string | null;
}

export function validateSocialInviteInput(input: SendSocialInviteInput) {
  if (!input.toProfileId || !UUID_RE.test(input.toProfileId)) {
    throw new Error("Choose a valid player to invite.");
  }
  if (!input.kind) {
    throw new Error("Choose an invite type.");
  }

  const trimmedMessage = input.message?.trim() || null;
  if (trimmedMessage && trimmedMessage.length > MAX_INVITE_MESSAGE_LENGTH) {
    throw new Error("Invite messages must be 280 characters or fewer.");
  }

  let scheduledFor: string | null = null;
  if (input.scheduledAt) {
    const scheduledDate = new Date(input.scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      throw new Error("Choose a valid invite time.");
    }
    if (scheduledDate.getTime() < Date.now() - 5 * 60 * 1000) {
      throw new Error("Choose a future time for this invite.");
    }
    scheduledFor = scheduledDate.toISOString();
  }

  return {
    target_profile_id: input.toProfileId,
    invite_kind: input.kind,
    scheduled_for: scheduledFor,
    invite_message: trimmedMessage,
    invite_ref_id: input.refId || null,
    invite_location_city_id: input.locationCityId || null,
  };
}

export function friendlySocialInviteError(message?: string) {
  if (!message) return "We couldn't update that invite. Please try again.";
  if (/not available for invites|can no longer be updated|permission denied|row-level security|42501/i.test(message)) {
    return "This player is not available for invites.";
  }
  if (/active player profile|not authenticated|jwt|auth|sign in/i.test(message)) {
    return "Sign in with an active player profile before using invites.";
  }
  if (/future time/i.test(message)) return "Choose a future time for this invite.";
  if (/not found/i.test(message)) return "That invite or player could not be found.";
  return message;
}

export async function sendSocialInvite(input: SendSocialInviteInput): Promise<SocialInviteRow> {
  const params = validateSocialInviteInput(input);
  const { data, error } = await (supabase as any).rpc("send_social_invite", params);
  if (error) throw new Error(friendlySocialInviteError(error.message));
  return data as SocialInviteRow;
}

export async function respondSocialInvite(id: string, status: SocialInviteStatus): Promise<SocialInviteRow> {
  if (!id || !UUID_RE.test(id)) {
    throw new Error("Choose a valid invite to update.");
  }
  if (!["accepted", "declined", "cancelled"].includes(status)) {
    throw new Error("Choose accept, decline, or cancel for this invite.");
  }
  const { data, error } = await (supabase as any).rpc("respond_social_invite", {
    invite_id: id,
    next_status: status,
  });
  if (error) throw new Error(friendlySocialInviteError(error.message));
  return data as SocialInviteRow;
}

export const __socialInviteTestUtils = {
  friendlySocialInviteError,
  validateSocialInviteInput,
};
