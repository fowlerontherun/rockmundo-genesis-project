import { describe, expect, it, vi } from "vitest";
import { buildFeedbackPayload, buildSafeMobileDiagnostics, detectDesktopFallback, getBrowserFamily, getViewportCategory, makeMobileErrorReference, trackMobileEvent } from "./mobileDiagnostics";

describe("mobile diagnostics", () => {
  it("uses coarse viewport and browser categories", () => {
    expect(getViewportCategory(320)).toBe("narrow-320");
    expect(getViewportCategory(375)).toBe("common-360-390");
    expect(getViewportCategory(430)).toBe("large-412-430");
    expect(getBrowserFamily("Mozilla SamsungBrowser/24 Chrome/120")).toBe("samsung");
  });

  it("builds safe feedback payloads without private message fields", () => {
    const payload = buildFeedbackPayload("failed_action", "player-reviewed free text", "RM-MUT-1234");
    expect(payload.detail).toContain("player-reviewed");
    expect(JSON.stringify(payload)).not.toMatch(/token|password|message body/i);
  });

  it("standardises traceable mobile error references", () => {
    expect(makeMobileErrorReference("mutation", 12345)).toMatch(/^RM-MUT-/);
  });

  it("emits safe route analytics metadata", () => {
    const spy = vi.fn();
    window.addEventListener("rm-mobile-analytics", spy);
    trackMobileEvent("mobile_route_viewed", { route: "/mobile/me", message: "secret" });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0].detail.message).toBeUndefined();
  });

  it("detects desktop fallback markers on mobile routes", () => {
    expect(detectDesktopFallback("/mobile/career", '<div data-desktop-shell="true"></div>')).toBe(true);
    expect(detectDesktopFallback("/desktop", '<div data-desktop-shell="true"></div>')).toBe(false);
  });
});
