import { supabase } from "@/integrations/supabase/client";
import type { DirectMessageRow } from "@/hooks/useDirectMessages";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_DM_LENGTH = 2000;

export function validateDirectMessageInput(recipientProfileId: string | null | undefined, body: string) {
  if (!recipientProfileId || !UUID_RE.test(recipientProfileId)) {
    throw new Error("Choose a valid player to message.");
  }

  const trimmed = body.trim();
  if (!trimmed) throw new Error("Write a message before sending.");
  if (trimmed.length > MAX_DM_LENGTH) {
    throw new Error(`Direct messages must be ${MAX_DM_LENGTH.toLocaleString()} characters or fewer.`);
  }

  return { recipientProfileId, body: trimmed };
}

function friendlyDirectMessageError(message?: string) {
  if (!message) return "We couldn't send that message. Please try again.";
  if (/available for direct messages|permission denied|row-level security|42501/i.test(message)) {
    return "This player is not available for direct messages.";
  }
  if (/active player profile|not authenticated|jwt|auth/i.test(message)) {
    return "Sign in with an active player profile before sending direct messages.";
  }
  if (/not found/i.test(message)) return "That player could not be found.";
  return message;
}

export async function sendDirectMessage(recipientProfileId: string, body: string): Promise<DirectMessageRow> {
  const input = validateDirectMessageInput(recipientProfileId, body);
  const { data, error } = await (supabase as any).rpc("send_direct_message", {
    recipient_profile_id: input.recipientProfileId,
    message_body: input.body,
  });

  if (error) throw new Error(friendlyDirectMessageError(error.message));
  return data as DirectMessageRow;
}
