import { supabase } from "@/integrations/supabase/client";
import type { DirectMessageRow } from "@/hooks/useDirectMessages";
import { validateMessageBody } from "./directMessages";

export interface ConversationSummary {
  conversation_id: string;
  type: "direct" | string;
  other_profile_id: string;
  other_display_name: string | null;
  other_username: string | null;
  other_avatar_url: string | null;
  last_message_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  archived_at: string | null;
  muted_until: string | null;
}

export async function startDirectConversation(recipientProfileId: string) {
  const { data, error } = await (supabase as any).rpc("start_direct_conversation", {
    recipient_profile_id: recipientProfileId,
  });
  if (error) throw new Error(error.message || "Unable to open conversation.");
  return (Array.isArray(data) ? data[0] : data) as ConversationSummary;
}

export async function listConversations(options: { archived?: boolean; search?: string; limit?: number; cursor?: string | null } = {}) {
  const { data, error } = await (supabase as any).rpc("list_conversations", {
    include_archived: Boolean(options.archived),
    search_query: options.search?.trim() || null,
    page_limit: options.limit ?? 30,
    before_activity_at: options.cursor ?? null,
  });
  if (error) throw new Error(error.message || "Unable to load conversations.");
  return (data ?? []) as ConversationSummary[];
}

export async function sendConversationMessage(conversationId: string, body: string, clientMessageId: string, replyToMessageId?: string | null) {
  const trimmedBody = validateMessageBody(body);
  const { data, error } = await (supabase as any).rpc("send_conversation_message", {
    conversation_id: conversationId,
    message_body: trimmedBody,
    client_message_id: clientMessageId,
    reply_to_message_id: replyToMessageId ?? null,
  });
  if (error) throw new Error(error.message || "We couldn't send that message.");
  return data as DirectMessageRow;
}
