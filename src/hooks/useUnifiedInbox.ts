import { useMemo } from "react";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import {
  useInbox,
  type InboxCategory,
  type InboxMessage,
} from "@/hooks/useInbox";
import {
  useNotificationsFeed,
  type PersistedNotification,
} from "@/hooks/useNotificationsFeed";
import { normalizeNotification } from "@/lib/notificationModels";

const NOTIFICATION_ID_PREFIX = "notification:";
const DEDUPE_METADATA_KEYS = [
  "outcome_id",
  "gig_id",
  "activity_id",
  "source_activity_id",
  "rehearsal_id",
  "recording_session_id",
  "session_id",
  "player_event_id",
  "random_event_id",
  "event_id",
  "application_id",
  "band_application_id",
  "band_invitation_id",
  "collaboration_id",
  "offer_id",
  "release_id",
  "sponsorship_id",
] as const;

function notificationCategory(notification: PersistedNotification): InboxCategory {
  const category = notification.category?.toLowerCase() ?? "";
  const type = notification.type?.toLowerCase() ?? "";
  const combined = `${category} ${type}`;

  if (combined.includes("achievement")) return "achievement";
  if (category === "random_event" || type.includes("random_event")) return "random_event";
  if (category === "gig_result" || type === "gig_outcome") return "gig_result";
  if (category === "pr" || combined.includes("media")) return "pr_media";
  if (category === "label" || combined.includes("record_label")) return "record_label";
  if (category === "sponsorship" || combined.includes("sponsor")) return "sponsorship";
  if (["finance", "financial", "business", "store"].includes(category)) return "financial";
  if (["social", "relationship", "band", "friend", "chat", "message", "mail"].some((key) => combined.includes(key))) return "social";
  return "system";
}

function notificationToInboxMessage(notification: PersistedNotification): InboxMessage {
  const display = normalizeNotification(notification);
  return {
    id: `${NOTIFICATION_ID_PREFIX}${notification.id}`,
    user_id: notification.user_id,
    category: notificationCategory(notification),
    priority: display.priority,
    title: notification.title,
    message: display.body,
    metadata: notification.metadata ?? {},
    action_type: display.routePath ? "navigate" : null,
    action_data: display.routePath ? { route: display.routePath } : null,
    related_entity_type: null,
    related_entity_id: null,
    is_read: display.isRead,
    is_archived: false,
    expires_at: null,
    created_at: notification.created_at,
  };
}

function notificationIdFromUnifiedId(id: string) {
  return id.startsWith(NOTIFICATION_ID_PREFIX)
    ? id.slice(NOTIFICATION_ID_PREFIX.length)
    : null;
}

function dedupeKeys(message: InboxMessage) {
  const title = message.title.trim().toLowerCase();
  const base = `${message.category}|${title}`;
  const keys = new Set<string>();

  if (message.related_entity_id) {
    keys.add(`${base}|entity:${message.related_entity_id}`);
  }

  for (const key of DEDUPE_METADATA_KEYS) {
    const value = message.metadata?.[key];
    if (typeof value === "string" && value.trim()) keys.add(`${base}|entity:${value.trim()}`);
    if (typeof value === "number" && Number.isFinite(value)) keys.add(`${base}|entity:${value}`);
  }

  return keys;
}

function messagesRepresentSameEvent(left: InboxMessage, right: InboxMessage) {
  const leftKeys = dedupeKeys(left);
  if (leftKeys.size === 0) return false;
  const rightKeys = dedupeKeys(right);
  for (const key of leftKeys) {
    if (rightKeys.has(key)) return true;
  }
  return false;
}

export function useUnifiedInbox() {
  const { profileId } = useActiveProfile();
  const inbox = useInbox();
  const notifications = useNotificationsFeed();

  const scopedNotifications = useMemo(
    () => notifications.notifications.filter((notification) => !notification.profile_id || !profileId || notification.profile_id === profileId),
    [notifications.notifications, profileId],
  );

  const notificationMessages = useMemo(
    () => scopedNotifications.map(notificationToInboxMessage),
    [scopedNotifications],
  );

  const messages = useMemo(() => {
    // Some legacy database triggers intentionally write the same event to both
    // player_inbox and notifications. Prefer the richer player_inbox record so
    // users see one item rather than a duplicated event.
    const uniqueNotifications = notificationMessages.filter(
      (notification) => !inbox.messages.some((message) => messagesRepresentSameEvent(message, notification)),
    );

    return [...inbox.messages, ...uniqueNotifications].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [inbox.messages, notificationMessages]);

  const duplicateNotificationIds = (inboxId: string) => {
    const message = inbox.messages.find((candidate) => candidate.id === inboxId);
    if (!message) return [];
    return notificationMessages
      .filter((notification) => messagesRepresentSameEvent(message, notification))
      .map((notification) => notificationIdFromUnifiedId(notification.id))
      .filter((id): id is string => Boolean(id));
  };

  const markAsRead = (id: string) => {
    const notificationId = notificationIdFromUnifiedId(id);
    if (notificationId) {
      notifications.markRead(notificationId);
      return;
    }

    inbox.markAsRead(id);
    duplicateNotificationIds(id).forEach((duplicateId) => notifications.markRead(duplicateId));
  };

  const archiveMessage = (id: string) => {
    const notificationId = notificationIdFromUnifiedId(id);
    if (notificationId) {
      notifications.dismiss(notificationId);
      return;
    }

    inbox.archiveMessage(id);
    duplicateNotificationIds(id).forEach((duplicateId) => notifications.dismiss(duplicateId));
  };

  const deleteMessage = (id: string) => {
    const notificationId = notificationIdFromUnifiedId(id);
    if (notificationId) {
      notifications.dismiss(notificationId);
      return;
    }

    inbox.deleteMessage(id);
    duplicateNotificationIds(id).forEach((duplicateId) => notifications.dismiss(duplicateId));
  };

  const markAllAsRead = () => {
    inbox.markAllAsRead();
    notifications.markAllRead();
  };

  const refetch = async () => {
    await Promise.all([inbox.refetch(), notifications.refetch()]);
  };

  return {
    messages,
    unreadCount: messages.filter((message) => !message.is_read).length,
    isLoading: inbox.isLoading || notifications.isLoading,
    error: inbox.error || notifications.error,
    markAsRead,
    markAllAsRead,
    archiveMessage,
    deleteMessage,
    refetch,
  };
}

export function useUnifiedInboxUnreadCount() {
  return useUnifiedInbox().unreadCount;
}
