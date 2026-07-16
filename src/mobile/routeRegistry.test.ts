import { describe, expect, it } from "vitest";
import { getMobileDestination, getMobileRouteMeta, mobileRouteAuditSummary, mobileRouteRegistry } from "./routeRegistry";

describe("mobile route registry", () => {
  it("tracks required dedicated mobile destinations", () => {
    expect(getMobileRouteMeta("/mobile")?.fallbackStatus).toBe("dedicated");
    expect(getMobileRouteMeta("/mobile/career/songs")?.bottomNav).toBe("career");
    expect(getMobileRouteMeta("/mobile/social/messages/123")?.bottomNav).toBe("social");
    expect(getMobileRouteMeta("/mobile/world/cities")?.bottomNav).toBe("world");
    expect(getMobileRouteMeta("/mobile/me/settings")?.bottomNav).toBe("me");
  });

  it("maps nested desktop fallback routes to stable bottom-navigation owners", () => {
    expect(getMobileDestination("/twaater/notifications")).toBe("social");
    expect(getMobileDestination("/cities/berlin")).toBe("world");
    expect(getMobileDestination("/release/abc123")).toBe("career");
    expect(getMobileDestination("/character/profile/edit")).toBe("me");
  });

  it("keeps fallback routes inside the mobile shell metadata", () => {
    const fallbacks = mobileRouteRegistry.filter((route) => route.fallbackStatus === "wrapped-desktop");
    expect(fallbacks.length).toBeGreaterThan(20);
    expect(fallbacks.every((route) => route.shell === "mobile")).toBe(true);
    expect(fallbacks.every((route) => route.bottomNav)).toBe(true);
  });

  it("exposes an audit summary for docs and PR descriptions", () => {
    expect(mobileRouteAuditSummary.authenticatedRoutesAudited).toBeGreaterThan(50);
    expect(mobileRouteAuditSummary.unauthenticatedRoutesAudited).toBe(4);
    expect(mobileRouteAuditSummary.dedicatedMobilePatterns).toBeGreaterThanOrEqual(6);
  });
});
