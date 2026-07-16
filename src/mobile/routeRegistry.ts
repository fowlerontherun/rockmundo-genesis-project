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
  "/career/*", "/band/*", "/bands/*", "/gigs/*", "/jams", "/jam-sessions", "/rehearsals", "/setlists", "/tour-manager", "/travel", "/song-manager", "/songwriting", "/stage-practice", "/recording-studio", "/release-manager", "/streaming-platforms", "/streaming/*", "/music/*", "/music", "/music/charts", "/competitive-charts", "/country-charts", "/festivals/*", "/festivals", "/awards", "/jobs", "/employment", "/education", "/booking/*", "/skills", "/teaching", "/stage-setup", "/stage-equipment", "/band-crew", "/performance/*", "/open-mic/*", "/major-events/*", "/busking", "/pr", "/public-relations", "/offers-dashboard", "/statistics", "/progression", "/song-market", "/song-rankings", "/release/*"
];
const social = [
  "/social/*", "/social", "/twaater/*", "/twaater", "/inbox", "/relationships", "/community/*", "/player/*", "/players/*", "/bands/finder", "/bands/browse", "/bands/search", "/band-rankings", "/band-fame-map", "/band/:bandId", "/gettit", "/dikcok"
];
const world = [
  "/world/*", "/world", "/cities/*", "/cities", "/venues", "/world-companies", "/companies/*", "/company/*", "/landmarks", "/world-map", "/world-pulse", "/nightclubs", "/nightclub/*", "/marketplace", "/gear-shop", "/gear", "/clothing-shop", "/tattoo-parlour", "/housing", "/personal-vehicles", "/casino/*", "/casino", "/lottery", "/political-party/*", "/political-party", "/world-parliament", "/politics-career", "/business/*", "/business", "/my-companies", "/labels/*", "/labels", "/record-label", "/security-firm/*", "/merch-factory/*", "/logistics-company/*", "/venue-business/*", "/rehearsal-studio-business/*", "/recording-studio-business/*"
];
const me = [
  "/me/*", "/me", "/character/*", "/character", "/wellness", "/inventory", "/avatar-designer", "/skin-store", "/clothing-designer", "/achievements", "/my-character/*", "/my-character", "/characters/*", "/characters", "/buy-character-slot", "/slot-purchase-success", "/underworld", "/legacy", "/family/*", "/journal", "/version-history", "/vip-*", "/premium-store", "/blind-boxes/*", "/blind-boxes", "/hall-of-immortals"
];

function meta(pattern: string, section: MobileDestination, fallbackStatus: MobileFallbackStatus = "wrapped-desktop"): MobileRouteMeta {
  const dedicated = pattern.startsWith("/mobile") || fallbackStatus === "dedicated";
  return { pattern, section, bottomNav: section, auth: "player", shell: "mobile", component: dedicated ? `Mobile${section}` : "Desktop route wrapped by MobileShell", showActivityBar: true, showFab: true, fullscreenAllowed: pattern.includes("perform") || pattern.includes("compose"), fallbackStatus, notes: dedicated ? "Dedicated mobile implementation." : "Contained fallback: desktop navigation, breadcrumbs and DesktopOnlyGate are not mounted on mobile." };
}

export const mobileRouteRegistry: MobileRouteMeta[] = [
  meta("/mobile", "home", "dedicated"), meta("/mobile/career/*", "career", "dedicated"), meta("/mobile/social/*", "social", "dedicated"), meta("/mobile/world/*", "world", "dedicated"), meta("/mobile/me/*", "me", "dedicated"),
  meta("/", "home", "public"), meta("/home", "home", "dedicated"), meta("/dashboard", "home", "redirect"),
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

export const mobileRouteAuditSummary = {
  authenticatedRoutesAudited: mobileRouteRegistry.filter((r) => r.auth === "player").length,
  unauthenticatedRoutesAudited: mobileRouteRegistry.filter((r) => r.auth === "public").length,
  dedicatedMobilePatterns: mobileRouteRegistry.filter((r) => r.fallbackStatus === "dedicated").length,
  containedFallbackPatterns: mobileRouteRegistry.filter((r) => r.fallbackStatus === "wrapped-desktop").length,
};
