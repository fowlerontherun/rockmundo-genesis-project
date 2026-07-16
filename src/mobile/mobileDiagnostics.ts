import { getMobileRouteMeta, type MobileDestination } from "./routeRegistry";

export type MobileErrorCategory = "navigation" | "route_load" | "api_request" | "mutation" | "validation" | "permission" | "connection" | "real_time" | "rendering" | "asset_load" | "pwa" | "desktop_fallback" | "stale_state" | "unknown";
export type ViewportCategory = "narrow-320" | "common-360-390" | "large-412-430" | "wide-or-foldable";

const allowedFeedbackCategories = ["broken_layout", "confusing_screen", "failed_action", "slow_page", "desktop_ui", "missing_data", "navigation_problem", "other"] as const;
export type MobileFeedbackCategory = (typeof allowedFeedbackCategories)[number];

export function getViewportCategory(width = typeof window === "undefined" ? 390 : window.innerWidth): ViewportCategory {
  if (width <= 340) return "narrow-320";
  if (width <= 400) return "common-360-390";
  if (width <= 450) return "large-412-430";
  return "wide-or-foldable";
}

export function getBrowserFamily(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent): "chrome" | "safari" | "samsung" | "firefox" | "edge" | "unknown" {
  const ua = userAgent.toLowerCase();
  if (ua.includes("samsungbrowser")) return "samsung";
  if (ua.includes("edg/")) return "edge";
  if (ua.includes("firefox/")) return "firefox";
  if (ua.includes("chrome/") || ua.includes("crios/")) return "chrome";
  if (ua.includes("safari/")) return "safari";
  return "unknown";
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function buildSafeMobileDiagnostics(pathname = typeof location === "undefined" ? "/" : location.pathname) {
  const route = getMobileRouteMeta(pathname);
  return {
    route: route?.pattern ?? "unmapped",
    section: route?.section ?? "home" as MobileDestination,
    viewport: getViewportCategory(),
    width: typeof window === "undefined" ? undefined : Math.round(window.innerWidth),
    height: typeof window === "undefined" ? undefined : Math.round(window.innerHeight),
    browser: getBrowserFamily(),
    pwa: isStandalonePwa() ? "standalone" : "browser",
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    connection: typeof navigator !== "undefined" ? ((navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType ?? "unknown") : "unknown",
    appVersion: import.meta.env.VITE_APP_VERSION ?? "dev",
  };
}

export function makeMobileErrorReference(category: MobileErrorCategory, seed = Date.now()): string {
  const prefix = category.replace(/[^a-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  return `RM-${prefix}-${Math.abs(seed).toString(36).slice(-4).toUpperCase()}`;
}

export function trackMobileEvent(event: string, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const safePayload = { ...buildSafeMobileDiagnostics(), ...payload };
  delete (safePayload as Record<string, unknown>).body;
  delete (safePayload as Record<string, unknown>).message;
  delete (safePayload as Record<string, unknown>).token;
  window.dispatchEvent(new CustomEvent("rm-mobile-analytics", { detail: { event, ...safePayload } }));
}

export function buildFeedbackPayload(category: MobileFeedbackCategory, detail = "", errorReference?: string) {
  return {
    category: allowedFeedbackCategories.includes(category) ? category : "other",
    detail: detail.slice(0, 1000),
    errorReference,
    diagnostics: buildSafeMobileDiagnostics(),
  };
}

export function detectDesktopFallback(pathname = typeof location === "undefined" ? "/" : location.pathname, html = typeof document === "undefined" ? "" : document.body.innerHTML) {
  const route = getMobileRouteMeta(pathname);
  const mobilePath = pathname.startsWith("/mobile") || route?.shell === "mobile";
  const desktopMarkers = ["DesktopOnlyGate", "desktop-sidebar", "ModuleTabs", "data-desktop-shell"];
  const found = mobilePath && desktopMarkers.some((marker) => html.includes(marker));
  if (found) trackMobileEvent("mobile_desktop_fallback_detected", { category: "desktop_fallback", route: route?.pattern ?? "unmapped" });
  return found;
}
