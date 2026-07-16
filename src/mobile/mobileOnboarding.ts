import type { PersistedNotification } from "@/hooks/useNotificationsFeed";

export type MobileOnboardingState = {
  welcome: "new" | "continued" | "skipped";
  quickStartDismissedAt?: string;
  completedStepIds: string[];
  dismissedGuidanceIds: string[];
  lastBriefingDismissedAt?: string;
  installDismissedAt?: string;
  mobileSessionCount: number;
};

export type PlayerSegment = "brand-new" | "new-returning" | "established-first-mobile" | "returning-mobile" | "regular-mobile";
export type QuickStartStep = { id: string; title: string; explanation: string; benefit: string; to: string; completed: boolean; blocker?: string };
export type Recommendation = { title: string; reason: string; to: string; priority: number };

export const MOBILE_ONBOARDING_VERSION = 1;
export const RETURNING_BRIEFING_THRESHOLD_HOURS = 18;
export const INSTALL_DISMISSAL_COOLDOWN_DAYS = 21;

const key = (userId?: string | null) => `rm-mobile-onboarding:v${MOBILE_ONBOARDING_VERSION}:${userId || "guest"}`;

export const defaultMobileOnboardingState = (): MobileOnboardingState => ({
  welcome: "new",
  completedStepIds: [],
  dismissedGuidanceIds: [],
  mobileSessionCount: 0,
});

export function loadMobileOnboardingState(userId?: string | null): MobileOnboardingState {
  if (typeof window === "undefined") return defaultMobileOnboardingState();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key(userId)) || "null");
    return { ...defaultMobileOnboardingState(), ...(parsed && typeof parsed === "object" ? parsed : {}) };
  } catch {
    return defaultMobileOnboardingState();
  }
}

export function saveMobileOnboardingState(userId: string | null | undefined, patch: Partial<MobileOnboardingState>) {
  if (typeof window === "undefined") return defaultMobileOnboardingState();
  const next = { ...loadMobileOnboardingState(userId), ...patch };
  window.localStorage.setItem(key(userId), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("rm-mobile-onboarding-state", { detail: next }));
  return next;
}

const hoursSince = (iso?: string | null) => {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? (Date.now() - t) / 36e5 : Infinity;
};

export function hasMeaningfulProgress(model: any): boolean {
  const p = model?.profile ?? model ?? {};
  return Boolean(p.band_id || p.band_name || p.level > 2 || p.fame > 0 || p.followers > 25 || p.total_gigs > 0 || p.song_count > 0 || model?.activityStatus || (model?.activities?.length ?? 0) > 2);
}

export function getPlayerSegment(model: any, state: MobileOnboardingState): PlayerSegment {
  const established = hasMeaningfulProgress(model);
  const away = hoursSince(model?.profile?.last_login_at || model?.profile?.updated_at) >= RETURNING_BRIEFING_THRESHOLD_HOURS;
  if (state.welcome === "new" && established) return "established-first-mobile";
  if (state.welcome === "new") return "brand-new";
  if (!established && away) return "new-returning";
  if (away) return "returning-mobile";
  return "regular-mobile";
}

export function deriveQuickStartSteps(model: any, state: MobileOnboardingState): QuickStartStep[] {
  const p = model?.profile ?? {};
  const established = hasMeaningfulProgress(model);
  const complete = (id: string, real = false) => real || state.completedStepIds.includes(id);
  const steps: QuickStartStep[] = established ? [
    { id: "activity", title: "Check current activity", explanation: "See what is happening now and when it finishes.", benefit: "Avoid wasting active timers.", to: "/mobile", completed: complete("activity", !!model?.activityStatus) },
    { id: "messages", title: "Review updates", explanation: "Open social and notification items that need a response.", benefit: "Keep bands and friends moving.", to: "/mobile/social", completed: complete("messages") },
    { id: "career", title: "Review career priorities", explanation: "Check songs, gigs and progression from the mobile career hub.", benefit: "Pick the highest impact action.", to: "/mobile/career", completed: complete("career") },
  ] : [
    { id: "character", title: "Review your character", explanation: "Confirm your city, vitals and starter profile.", benefit: "Know what you can do right now.", to: "/mobile/me", completed: complete("character", !!p.display_name || !!p.username) },
    { id: "practice", title: "Start practice", explanation: "Use skills or activities to make early progress.", benefit: "Build XP for your first career steps.", to: "/mobile/me/skills", completed: complete("practice", !!model?.activityStatus), blocker: model?.activityStatus ? "Already busy with another activity." : undefined },
    { id: "city", title: "Explore your city", explanation: "Find venues, travel and local opportunities.", benefit: "Learn where mobile actions live.", to: "/mobile/world", completed: complete("city") },
    { id: "band", title: "Find players or a band", explanation: "Open social tools when you are ready to collaborate.", benefit: "Bands unlock coordination and gigs.", to: "/mobile/social", completed: complete("band", !!p.band_id || !!p.band_name) },
  ];
  return steps;
}

export function deriveRecommendedAction(model: any, notifications: PersistedNotification[] = []): Recommendation | null {
  const p = model?.profile ?? {};
  const urgent = notifications.find((n) => !n.read_at && /invite|offer|travel|gig|message|action|required/i.test(`${n.category} ${n.type} ${n.title}`));
  if (urgent) return { title: urgent.title, reason: urgent.message || "This unread update needs attention.", to: mobilePath(urgent.action_path) || "/mobile/social/notifications", priority: 1 };
  if ((p.energy ?? 100) < 35) return { title: "Restore energy", reason: "Your energy is low and may block activities.", to: "/mobile/me/wellness", priority: 2 };
  if (model?.activityStatus) return { title: "Check current activity", reason: `${model.activityStatus.activity_type || "Activity"} is in progress.`, to: "/mobile", priority: 3 };
  if ((model?.xpWallet?.skill_xp ?? model?.xpWallet?.balance ?? 0) > 0) return { title: "Spend available skill XP", reason: "You have unspent XP that can improve future actions.", to: "/mobile/me/skills", priority: 4 };
  return { title: "Start a practice session", reason: "No urgent blockers were found, so practice is a safe next step.", to: "/mobile/me/skills", priority: 9 };
}

export function groupMobileNotifications(notifications: PersistedNotification[]) {
  const seen = new Set<string>();
  const groups: Record<string, PersistedNotification[]> = { "Needs Action": [], Social: [], Career: [], World: [], Progress: [], System: [] };
  for (const n of notifications) {
    const dedupe = `${n.category}:${n.type}:${n.action_path}:${n.title}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const text = `${n.category} ${n.type} ${n.title}`.toLowerCase();
    const group = /invite|offer|requires|action|reply|accept|decline/.test(text) ? "Needs Action" : /friend|message|mail|social|twaater|band/.test(text) ? "Social" : /gig|song|career|skill|release|xp/.test(text) ? "Career" : /city|travel|world|chart/.test(text) ? "World" : /system|update|maintenance/.test(text) ? "System" : "Progress";
    groups[group].push(n);
  }
  return Object.entries(groups).filter(([, items]) => items.length > 0);
}

export function mobilePath(path?: string | null) {
  if (!path) return null;
  if (path.startsWith("/mobile")) return path;
  if (/^\/(social|twaater|inbox|player)/.test(path)) return path.replace(/^\/(social|twaater|inbox|player)/, "/mobile/social");
  if (/^\/(skills|wellness|inventory|character)/.test(path)) return path.replace(/^\/(skills|wellness|inventory|character)/, "/mobile/me");
  if (/^\/(travel|cities|world)/.test(path)) return path.replace(/^\/(travel|cities|world)/, "/mobile/world");
  if (/^\/(gigs|song|release|band|career)/.test(path)) return path.replace(/^\/(gigs|songwriting|release|band|career)/, "/mobile/career");
  return path;
}

export function getBlockedActionCopy(kind: string) {
  const map: Record<string, { title: string; explanation: string; requirements: string[]; action: string; to: string }> = {
    energy: { title: "Energy is too low", explanation: "Activities need enough energy so your character can finish them safely.", requirements: ["Restore energy above the action requirement", "Finish or cancel conflicting activities first"], action: "Open wellness", to: "/mobile/me/wellness" },
    activity: { title: "Another activity is running", explanation: "RockMundo runs one major timed activity at a time to keep outcomes consistent.", requirements: ["Wait for the current activity to finish"], action: "Check activity", to: "/mobile" },
    city: { title: "Wrong city", explanation: "This action depends on your current location.", requirements: ["Travel to the required city", "Check departure and arrival time"], action: "Open travel", to: "/mobile/world/travel" },
    funds: { title: "Not enough money", explanation: "Purchases and bookings reserve funds before they are confirmed.", requirements: ["Earn or transfer enough money", "Review the total cost"], action: "Review work", to: "/mobile/me" },
  };
  return map[kind] || { title: "Action unavailable", explanation: "The server will re-check requirements before this action can continue.", requirements: ["Review the unmet requirement", "Try again after resolving it"], action: "Close", to: "/mobile" };
}
