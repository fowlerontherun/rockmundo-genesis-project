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
  event: "Events",
  finance: "Finance",
  gig: "Gigs",
  gig_result: "Gig outcome",
  label: "Label",
  practice: "Practice",
  pr: "PR & media",
  random_event: "Life event",
  recording: "Recording",
  rehearsal: "Rehearsal",
  relationship: "Social",
  social: "Social",
  sponsorship: "Sponsors",
  store: "Store",
  system: "System",
  travel: "Travel",
  world: "World",
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
  practice_outcome: "View practice",
  pr_outcome: "View PR activity",
  random_event_outcome: "View event outcome",
  rehearsal_outcome: "View rehearsal",
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
  random_event_outcome: "normal",
  gig_outcome: "normal",
  rehearsal_outcome: "normal",
  practice_outcome: "normal",
  pr_outcome: "normal",
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
const getNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toLocaleString()}`;

function buildPrOutcomeBody(notification: PersistedNotification): string | null {
  if (notification.type !== "pr_outcome" && notification.category !== "pr") return null;

  const metadata = notification.metadata ?? {};
  const mediaType = getString(metadata.media_type) ?? getString(metadata.mediaType);
  const outlet = getString(metadata.outlet_name) ?? getString(metadata.outlet) ?? getString(metadata.program_name);
  const fame = getNumber(metadata.fame_boost ?? metadata.fame_gained);
  const fans = getNumber(metadata.fan_boost ?? metadata.fans_gained);
  const compensation = getNumber(metadata.compensation ?? metadata.cash_gained);
  const reputation = getNumber(metadata.reputation_gain ?? metadata.reputation_delta);
  const morale = getNumber(metadata.morale_gain ?? metadata.morale_delta);
  const sentiment = getNumber(metadata.sentiment_gain ?? metadata.sentiment_delta);
  const reach = getNumber(metadata.audience_reach ?? metadata.reach);

  const gains: string[] = [];
  if (fans !== null && fans !== 0) gains.push(`${signed(fans)} fans`);
  if (fame !== null && fame !== 0) gains.push(`${signed(fame)} fame`);
  if (compensation !== null && compensation !== 0) gains.push(`${signed(compensation)} cash`);
  if (reputation !== null && reputation !== 0) gains.push(`${signed(reputation)} reputation`);
  if (morale !== null && morale !== 0) gains.push(`${signed(morale)} morale`);
  if (sentiment !== null && sentiment !== 0) gains.push(`${signed(sentiment)} fan sentiment`);

  const appearance = [mediaType ? toTitleCase(mediaType) : null, outlet].filter(Boolean).join(" appearance on ");
  const intro = appearance
    ? `Your ${appearance} has finished.`
    : "Your PR appearance has finished.";
  const reachText = reach !== null && reach > 0 ? ` Estimated reach: ${reach.toLocaleString()}.` : "";
  const gainsText = gains.length > 0 ? ` Outcome: ${gains.join(", ")}.` : "";

  return `${intro}${reachText}${gainsText}`;
}

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

  if ((notification.type === "pr_outcome" || notification.category === "pr") && !notification.action_path) {
    return "/pr";
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
  const prOutcomeBody = buildPrOutcomeBody(notification);

  return {
    ...notification,
    body: prOutcomeBody ?? notification.message?.trim() || "Open this update for more details.",
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
