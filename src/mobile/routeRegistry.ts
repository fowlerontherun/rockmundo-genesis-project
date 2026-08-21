import { matchPath } from "react-router-dom";

export type MobileDestination = "home" | "career" | "social" | "world" | "me";
export type MobileFallbackStatus = "dedicated" | "wrapped-desktop" | "redirect" | "public";

export interface MobileRouteMeta {
  pattern: string;
  section: MobileDestination;
  bottomNav: MobileDestination;
  auth: "public" | "player";
  shell: "mobile" | "none";
  component: string;
  showActivityBar: boolean;
  showFab: boolean;
  fullscreenAllowed: boolean;
  fallbackStatus: MobileFallbackStatus;
  notes?: string;
}

const career = [
  "/career/*", "/band/*", "/bands/*", "/gigs/*", "/jams", "/jam-sessions", "/rehearsals", "/setlists", "/tour-manager", "/song-manager", "/songwriting", "/stage-practice", "/recording-studio", "/release-manager", "/streaming-platforms", "/streaming/*", "/music/*", "/music", "/music/charts", "/competitive-charts", "/country-charts", "/awards", "/booking/*", "/teaching", "/stage-setup", "/stage-equipment", "/band-crew", "/performance/*", "/open-mic/*", "/busking", "/pr", "/public-relations", "/hub/media", "/media/*", "/media", "/radio", "/radio/*", "/offers-dashboard", "/statistics", "/progression", "/song-market", "/song-rankings", "/release/*"
];
const social = [
  "/social/*", "/social", "/twaater/*", "/twaater", "/inbox", "/relationships", "/community/*", "/player/*", "/players/*", "/bands/finder", "/bands/browse", "/bands/search", "/band-rankings", "/band-fame-map", "/band/:bandId", "/gettit", "/dikcok"
];
const world = [
  "/world/*", "/world", "/travel", "/cities/*", "/cities", "/venues", "/world-companies", "/companies/*", "/company/*", "/landmarks", "/world-map", "/world-pulse", "/major-events/*", "/major-events", "/festivals/*", "/festivals", "/jobs", "/employment", "/nightclubs", "/nightclub/*", "/marketplace", "/gear-shop", "/gear", "/clothing-shop", "/tattoo-parlour", "/housing", "/personal-vehicles", "/casino/*", "/casino", "/lottery", "/political-party/*", "/political-party", "/world-parliament", "/politics-career", "/business/*", "/business", "/my-companies", "/labels/*", "/labels", "/record-label", "/security-firm/*", "/merch-factory/*", "/logistics-company/*", "/venue-business/*", "/rehearsal-studio-business/*", "/recording-studio-business/*"
];
const me = [
  "/me/*", "/me", "/character/*", "/character", "/wellness", "/inventory", "/skills", "/education", "/avatar-designer", "/skin-store", "/clothing-designer", "/achievements", "/my-character/*", "/my-character", "/characters/*", "/characters", "/buy-character-slot", "/slot-purchase-success", "/underworld", "/legacy", "/family/*", "/journal", "/version-history", "/vip-*", "/premium-store", "/blind-boxes/*", "/blind-boxes", "/hall-of-immortals"
];

function meta(pattern: string, section: MobileDestination, fallbackStatus: MobileFallbackStatus = "wrapped-desktop"): MobileRouteMeta {
  const dedicated = pattern.startsWith("/mobile") || fallbackStatus === "dedicated";
  return { pattern, section, bottomNav: section, auth: "player", shell: "mobile", component: dedicated ? `Mobile${section}` : "Desktop route redirected to companion surface", showActivityBar: true, showFab: true, fullscreenAllowed: pattern.includes("perform") || pattern.includes("compose"), fallbackStatus, notes: dedicated ? "Dedicated mobile implementation." : "Desktop gameplay route; mobile navigation redirects to the supported companion destination rather than mounting desktop gameplay." };
}

export const mobileRouteRegistry: MobileRouteMeta[] = [
  meta("/mobile", "home", "dedicated"), meta("/mobile/career/*", "career", "dedicated"), meta("/mobile/social/*", "social", "dedicated"), meta("/mobile/world/*", "world", "dedicated"), meta("/mobile/me/*", "me", "dedicated"),
  meta("/", "home", "public"), meta("/home", "home", "redirect"), meta("/dashboard", "home", "redirect"), meta("/schedule", "home", "redirect"), meta("/schedule/*", "home", "redirect"),
  ...career.map((p) => meta(p, "career")), ...social.map((p) => meta(p, "social")), ...world.map((p) => meta(p, "world")), ...me.map((p) => meta(p, "me")),
  { pattern: "/auth", section: "home", bottomNav: "home", auth: "public", shell: "none", component: "Auth", showActivityBar: false, showFab: false, fullscreenAllowed: true, fallbackStatus: "public" },
  { pattern: "/about", section: "home", bottomNav: "home", auth: "public", shell: "none", component: "About", showActivityBar: false, showFab: false, fullscreenAllowed: true, fallbackStatus: "public" },
  { pattern: "/song/:songId", section: "career", bottomNav: "career", auth: "public", shell: "none", component: "PublicSong", showActivityBar: false, showFab: false, fullscreenAllowed: true, fallbackStatus: "public" },
];

export function getMobileRouteMeta(pathname: string): MobileRouteMeta | undefined {
  return mobileRouteRegistry.find((route) => matchPath({ path: route.pattern, end: route.pattern === "/" || !route.pattern.endsWith("/*") }, pathname));
}

export function getMobileDestination(pathname: string): MobileDestination {
  return getMobileRouteMeta(pathname)?.bottomNav ?? "home";
}

const playerProfilePath = (clean: string): string | null => {
  for (const pattern of ["/player/:playerId", "/players/:playerId"]) {
    const match = matchPath({ path: pattern, end: true }, clean);
    const playerId = match?.params?.playerId;
    if (playerId) return `/mobile/social/profile/${encodeURIComponent(playerId)}`;
  }
  return null;
};

/**
 * Convert action/notification paths into the supported companion surface.
 * Mobile never falls through into deep desktop gameplay by accident.
 */
export function resolveCompanionPath(path?: string | null): string {
  if (!path) return "/mobile";
  if (path.startsWith("/mobile")) return path;

  const clean = path.split("?")[0].split("#")[0];

  if (["/home", "/dashboard"].includes(clean)) return "/mobile";
  if (clean === "/schedule" || clean.startsWith("/schedule/")) return "/mobile?view=day";
  if (clean === "/stage-practice") return "/mobile?view=day#practice";
  if (clean === "/travel" || clean.startsWith("/world/travel")) return "/mobile/world/travel";
  if (clean === "/wellness" || clean === "/character/wellness") return "/mobile/me/wellness";
  if (clean === "/skills" || clean === "/character/skills") return "/mobile/me/skills";
  if (clean === "/education") return "/mobile/me/education";
  if (clean === "/jobs" || clean === "/employment") return "/mobile/world/jobs";
  if (clean === "/festivals" || clean.startsWith("/festivals/")) return "/mobile/world/festivals";
  if (clean === "/inbox") return "/mobile/social/mail";
  if (clean === "/relationships") return "/mobile/social/friends";
  if (["/bands/finder", "/bands/browse", "/bands/search"].includes(clean)) return "/mobile/social/friends";
  if (clean === "/twaater" || clean.startsWith("/twaater/")) return "/mobile/social/twaater";
  if (clean === "/social/messages") return "/mobile/social/messages";
  if (clean === "/social/invitations" || clean === "/community/invitations") return "/mobile/social/requests";
  if (clean === "/social" || clean.startsWith("/social/") || clean.startsWith("/community/")) return "/mobile/social";

  const profileTarget = playerProfilePath(clean);
  if (profileTarget) return profileTarget;

  const meta = getMobileRouteMeta(clean);
  if (!meta) return "/mobile";
  if (meta.section === "career") return "/mobile/career";
  if (meta.section === "social") return "/mobile/social";
  if (meta.section === "world") return "/mobile/world";
  if (meta.section === "me") return "/mobile/me";
  return "/mobile";
}

export const mobileRouteAuditSummary = {
  authenticatedRoutesAudited: mobileRouteRegistry.filter((r) => r.auth === "player").length,
  unauthenticatedRoutesAudited: mobileRouteRegistry.filter((r) => r.auth === "public").length,
  dedicatedMobilePatterns: mobileRouteRegistry.filter((r) => r.fallbackStatus === "dedicated").length,
  containedFallbackPatterns: mobileRouteRegistry.filter((r) => r.fallbackStatus === "wrapped-desktop").length,
};
