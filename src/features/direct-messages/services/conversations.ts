import { supabase } from "@/integrations/supabase/client";
import type { DirectMessageRow } from "@/hooks/useDirectMessages";
import { validateMessageBody } from "./directMessages";

export type ConversationContextType = "band" | "company" | "tour" | "festival" | string;

export interface ConversationSummary {
  conversation_id: string;
  type: "direct" | "group" | string;
  title: string | null;
  context_type: ConversationContextType | null;
  context_id: string | null;
  other_profile_id: string | null;
  other_display_name: string | null;
  other_username: string | null;
  other_avatar_url: string | null;
  participant_count: number;
  my_role: "owner" | "admin" | "member" | "guest" | string;
  last_message_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  archived_at: string | null;
  muted_until: string | null;
  is_closed: boolean;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  sender_profile_id: string;
  sender_display_name: string;
  sender_avatar_url: string | null;
  body: string;
  reply_to_message_id: string | null;
  created_at: string;
  read_at: string | null;
}

export interface ConversationContextAttachment {
  id: string;
  conversation_id: string;
  object_type: string;
  object_id: string;
  label: string;
  action_path: string | null;
  deadline_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

function normalizeSummary(row: any): ConversationSummary {
  return {
    conversation_id: row.conversationId ?? row.conversation_id,
    type: row.type,
    title: row.title ?? row.other_display_name ?? null,
    context_type: row.contextType ?? row.context_type ?? null,
    context_id: row.contextId ?? row.context_id ?? null,
    other_profile_id: row.otherProfileId ?? row.other_profile_id ?? null,
    other_display_name: row.otherDisplayName ?? row.other_display_name ?? null,
    other_username: row.otherUsername ?? row.other_username ?? null,
    other_avatar_url: row.otherAvatarUrl ?? row.other_avatar_url ?? null,
    participant_count: Number(row.participantCount ?? row.participant_count ?? (row.type === "direct" ? 2 : 0)),
    my_role: row.myRole ?? row.my_role ?? "member",
    last_message_id: row.lastMessageId ?? row.last_message_id ?? null,
    last_message_at: row.lastMessageAt ?? row.last_message_at ?? null,
    last_message_preview: row.lastMessagePreview ?? row.last_message_preview ?? null,
    unread_count: Number(row.unreadCount ?? row.unread_count ?? 0),
    archived_at: row.archivedAt ?? row.archived_at ?? null,
    muted_until: row.mutedUntil ?? row.muted_until ?? null,
    is_closed: Boolean(row.isClosed ?? row.is_closed ?? false),
  };
}

export async function startDirectConversation(recipientProfileId: string) {
  const { data, error } = await (supabase as any).rpc("start_direct_conversation", {
    recipient_profile_id: recipientProfileId,
  });
  if (error) throw new Error(error.message || "Unable to open conversation.");
  return normalizeSummary(Array.isArray(data) ? data[0] : data);
}

export async function ensureContextConversation(contextType: ConversationContextType, contextId: string) {
  const { data, error } = await (supabase as any).rpc("ensure_context_conversation", {
    p_context_type: contextType,
    p_context_id: contextId,
  });
  if (error) throw new Error(error.message || "Unable to open the group conversation.");
  return data as { conversationId: string; type: "group"; title: string; contextType: string; contextId: string; memberCount: number };
}

export async function listConversations(options: { archived?: boolean; search?: string; limit?: number; cursor?: string | null } = {}) {
  // This is idempotent and only materialises/synchronises groups backed by the
  // active character's authoritative band/company/tour/festival relationships.
  const ensured = await (supabase as any).rpc("ensure_my_context_conversations");
  if (ensured.error) throw new Error(ensured.error.message || "Unable to synchronise group conversations.");

  const { data, error } = await (supabase as any).rpc("list_social_conversations_v2", {
    p_include_archived: Boolean(options.archived),
    p_search_query: options.search?.trim() || null,
    p_page_limit: options.limit ?? 30,
    p_before_activity_at: options.cursor ?? null,
  });
  if (error) throw new Error(error.message || "Unable to load conversations.");
  return ((data ?? []) as any[]).map(normalizeSummary);
}

export async function getConversationMessages(conversationId: string, options: { limit?: number; cursor?: string | null } = {}) {
  const { data, error } = await (supabase as any).rpc("get_conversation_messages_v2", {
    p_conversation_id: conversationId,
    p_page_limit: options.limit ?? 100,
    p_before_created_at: options.cursor ?? null,
  });
  if (error) throw new Error(error.message || "Unable to load conversation messages.");
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    conversation_id: row.conversationId,
    sender_profile_id: row.senderProfileId,
    sender_display_name: row.senderDisplayName,
    sender_avatar_url: row.senderAvatarUrl ?? null,
    body: row.body,
    reply_to_message_id: row.replyToMessageId ?? null,
    created_at: row.createdAt,
    read_at: row.readAt ?? null,
  })) as ConversationMessage[];
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

export async function markConversationRead(conversationId: string, messageId?: string | null) {
  const { data, error } = await (supabase as any).rpc("mark_conversation_read", {
    conversation_id: conversationId,
    read_message_id: messageId ?? null,
  });
  if (error) throw new Error(error.message || "Unable to mark the conversation as read.");
  return Boolean(data);
}

export async function listConversationAttachments(conversationId: string) {
  const { data, error } = await (supabase as any)
    .from("conversation_context_attachments")
    .select("id,conversation_id,object_type,object_id,label,action_path,deadline_at,metadata,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message || "Unable to load conversation context.");
  return (data ?? []) as ConversationContextAttachment[];
}

export async function attachConversationContext(input: {
  conversationId: string;
  objectType: string;
  objectId: string;
  label: string;
  actionPath?: string | null;
  deadlineAt?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await (supabase as any).rpc("attach_conversation_context", {
    p_conversation_id: input.conversationId,
    p_object_type: input.objectType,
    p_object_id: input.objectId,
    p_label: input.label,
    p_action_path: input.actionPath ?? null,
    p_deadline_at: input.deadlineAt ?? null,
    p_metadata: input.metadata ?? {},
  });
  if (error) throw new Error(error.message || "Unable to attach that game item.");
  return data as ConversationContextAttachment;
}

export async function leaveGroupConversation(conversationId: string) {
  const { data, error } = await (supabase as any).rpc("leave_group_conversation", {
    p_conversation_id: conversationId,
  });
  if (error) throw new Error(error.message || "Unable to leave the conversation.");
  return Boolean(data);
}
