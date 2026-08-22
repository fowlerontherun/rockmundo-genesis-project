import { useMemo } from "react";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import {
  useInbox,
  useUnreadInboxCount,
  type InboxCategory,
  type InboxMessage,
} from "@/hooks/useInbox";
import {
  useNotificationsFeed,
  type PersistedNotification,
} from "@/hooks/useNotificationsFeed";
import { normalizeNotification } from "@/lib/notificationModels";

const NOTIFICATION_ID_PREFIX = "notification:";

function notificationCategory(notification: PersistedNotification): InboxCategory {
  const category = notification.category?.toLowerCase() ?? "";
  const type = notification.type?.toLowerCase() ?? "";
  const combined = `${category} ${type}`;

  if (combined.includes("achievement")) return "achievement";
  if (category === "random_event" || type.includes("random_event")) return "random_event";
  if (category === "gig" || category === "gig_result" || type.includes("gig_")) return "gig_result";
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

  const messages = useMemo(
    () => [...inbox.messages, ...notificationMessages].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ),
    [inbox.messages, notificationMessages],
  );

  const markAsRead = (id: string) => {
    const notificationId = notificationIdFromUnifiedId(id);
    if (notificationId) notifications.markRead(notificationId);
    else inbox.markAsRead(id);
  };

  const archiveMessage = (id: string) => {
    const notificationId = notificationIdFromUnifiedId(id);
    if (notificationId) notifications.dismiss(notificationId);
    else inbox.archiveMessage(id);
  };

  const deleteMessage = (id: string) => {
    const notificationId = notificationIdFromUnifiedId(id);
    if (notificationId) notifications.dismiss(notificationId);
    else inbox.deleteMessage(id);
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
  const { profileId } = useActiveProfile();
  const { data: inboxUnreadCount = 0 } = useUnreadInboxCount();
  const { notifications } = useNotificationsFeed();

  const notificationUnreadCount = useMemo(
    () => notifications.filter(
      (notification) => !notification.read_at && (!notification.profile_id || !profileId || notification.profile_id === profileId),
    ).length,
    [notifications, profileId],
  );

  return (inboxUnreadCount ?? 0) + notificationUnreadCount;
}
