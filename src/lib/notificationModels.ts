import type { PersistedNotification } from "@/hooks/useNotificationsFeed";
import { getRecruitmentStatusMeta } from "@/lib/recruitmentStatus";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type DisplayNotification = PersistedNotification & {
  body: string;
  categoryLabel: string;
  priority: NotificationPriority;
  isRead: boolean;
  actionLabel: string | null;
  statusLabel: string | null;
  isRecruitment: boolean;
  routePath: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  achievement: "Achievement",
  band: "Band",
  booking: "Booking",
  business: "Business",
  chart: "Charts",
  education: "Education",
  finance: "Finance",
  gig: "Gigs",
  label: "Label",
  recording: "Recording",
  relationship: "Social",
  social: "Social",
  sponsorship: "Sponsors",
  store: "Store",
  system: "System",
  travel: "Travel",
};

const TYPE_ACTION_LABELS: Record<string, string> = {
  achievement: "View achievement",
  audio_generation: "Open audio",
  band_invite: "Review invite",
  band_request: "Open recruitment",
  blind_box_live: "Open store",
  chart_entry: "View charts",
  contract_offer: "Review offer",
  festival_offer: "View festival",
  gig_offer: "Review gig",
  gig_outcome: "View gig results",
  label_deal: "Review deal",
  release: "View release",
  sponsor_offer: "Review sponsor",
  travel: "View travel",
};

const PRIORITY_BY_TYPE: Record<string, NotificationPriority> = {
  warning: "high",
  error: "urgent",
  gig_offer: "high",
  contract_offer: "high",
  sponsor_offer: "high",
  festival_offer: "high",
  band_invite: "high",
  band_request: "high",
  achievement: "normal",
  success: "normal",
  info: "normal",
};

const toTitleCase = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const isPriority = (value: unknown): value is NotificationPriority =>
  value === "low" || value === "normal" || value === "high" || value === "urgent";

const getString = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

export function getNotificationRoute(notification: PersistedNotification): string | null {
  const metadata = notification.metadata ?? {};
  const bandId = getString(metadata.band_id);
  const hasApplication = Boolean(getString(metadata.band_application_id));
  const hasInvitation = Boolean(getString(metadata.band_invitation_id));

  if (notification.type === "band_request" && bandId) {
    return hasApplication ? `/bands/${bandId}` : hasInvitation ? "/band-manager" : `/bands/${bandId}`;
  }

  if (notification.action_path?.includes("?tab=applications") && bandId) {
    return `/bands/${bandId}`;
  }

  return notification.action_path;
}

export function normalizeNotification(notification: PersistedNotification): DisplayNotification {
  const metadata = notification.metadata ?? {};
  const metadataPriority = metadata.priority;
  const priority = isPriority(metadataPriority)
    ? metadataPriority
    : PRIORITY_BY_TYPE[notification.type] ?? PRIORITY_BY_TYPE[notification.category] ?? "normal";
  const recruitmentStatus = getString(metadata.band_application_status) ?? getString(metadata.band_invitation_status);
  const recruitmentMeta = recruitmentStatus ? getRecruitmentStatusMeta(recruitmentStatus) : null;
  const isRecruitment = notification.type === "band_request" || Boolean(recruitmentStatus);
  const routePath = getNotificationRoute(notification);

  return {
    ...notification,
    body: notification.message?.trim() || "Open this update for more details.",
    categoryLabel: CATEGORY_LABELS[notification.category] ?? toTitleCase(notification.category || "notification"),
    priority,
    isRead: !!notification.read_at,
    actionLabel: routePath ? TYPE_ACTION_LABELS[notification.type] ?? "Open" : null,
    statusLabel: recruitmentMeta?.label ?? (isRecruitment ? "Pending" : null),
    isRecruitment,
    routePath,
  };
}

export function getNotificationPreview(notifications: PersistedNotification[], limit = 3) {
  return notifications
    .map(normalizeNotification)
    .sort((a, b) => {
      const priorityOrder: Record<NotificationPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
      const priorityDelta = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDelta !== 0) return priorityDelta;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, limit);
}
