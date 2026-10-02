import { matchPath } from "react-router-dom";

export type MobileDestination = "schedule" | "inbox" | "chat" | "progression";
export type MobileFallbackStatus = "dedicated" | "redirect" | "public";
export interface MobileRouteMeta {
  pattern: string; section: MobileDestination; bottomNav: MobileDestination; auth: "public" | "player"; shell: "mobile" | "none"; component: string; showActivityBar: boolean; showFab: boolean; fullscreenAllowed: boolean; fallbackStatus: MobileFallbackStatus; notes?: string;
}
const dedicated = (pattern: string, section: MobileDestination): MobileRouteMeta => ({ pattern, section, bottomNav: section, auth: "player", shell: "mobile", component: `Mobile${section}`, showActivityBar: true, showFab: true, fullscreenAllowed: false, fallbackStatus: "dedicated", notes: "Supported mobile companion feature." });
export const mobileRouteRegistry: MobileRouteMeta[] = [
  dedicated("/mobile", "schedule"), dedicated("/mobile/inbox", "inbox"), dedicated("/mobile/chat", "chat"), dedicated("/mobile/progression", "progression"),
  { pattern: "/", section: "schedule", bottomNav: "schedule", auth: "public", shell: "none", component: "Landing", showActivityBar: false, showFab: false, fullscreenAllowed: true, fallbackStatus: "public" },
  { pattern: "/auth", section: "schedule", bottomNav: "schedule", auth: "public", shell: "none", component: "Auth", showActivityBar: false, showFab: false, fullscreenAllowed: true, fallbackStatus: "public" },
  { pattern: "/about", section: "schedule", bottomNav: "schedule", auth: "public", shell: "none", component: "About", showActivityBar: false, showFab: false, fullscreenAllowed: true, fallbackStatus: "public" },
];
export function getMobileRouteMeta(pathname: string): MobileRouteMeta | undefined { return mobileRouteRegistry.find((route) => matchPath({ path: route.pattern, end: true }, pathname)); }
export function getMobileDestination(pathname: string): MobileDestination { return getMobileRouteMeta(pathname)?.bottomNav ?? "schedule"; }
export function resolveCompanionPath(path?: string | null): string {
  if (!path) return "/mobile";
  const clean = path.split("?")[0].split("#")[0];
  if (clean === "/inbox" || clean === "/mobile/inbox") return "/mobile/inbox";
  if (clean === "/social/chat" || clean === "/chat" || clean === "/mobile/chat") return "/mobile/chat";
  if (clean === "/skills" || clean === "/character/skills" || clean === "/progression" || clean === "/mobile/progression") return "/mobile/progression";
  if (clean === "/schedule" || clean.startsWith("/schedule/") || clean.startsWith("/booking/") || clean === "/mobile") return "/mobile";
  return "/mobile";
}
export const mobileRouteAuditSummary = { authenticatedRoutesAudited: 4, unauthenticatedRoutesAudited: 3, dedicatedMobilePatterns: 4, containedFallbackPatterns: 0 };
