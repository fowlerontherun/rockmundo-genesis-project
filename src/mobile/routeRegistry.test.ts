import { describe, expect, it } from "vitest";
import { getMobileDestination, getMobileRouteMeta, mobileRouteAuditSummary, resolveCompanionPath } from "./routeRegistry";
describe("mobile route registry", () => {
  it("only exposes the four supported companion destinations", () => {
    expect(getMobileRouteMeta("/mobile")?.bottomNav).toBe("schedule");
    expect(getMobileRouteMeta("/mobile/inbox")?.bottomNav).toBe("inbox");
    expect(getMobileRouteMeta("/mobile/chat")?.bottomNav).toBe("chat");
    expect(getMobileRouteMeta("/mobile/progression")?.bottomNav).toBe("progression");
    expect(getMobileRouteMeta("/mobile/world")).toBeUndefined();
  });
  it("contains unsupported actions back to schedule", () => {
    expect(resolveCompanionPath("/travel")).toBe("/mobile");
    expect(resolveCompanionPath("/twaater")).toBe("/mobile");
    expect(resolveCompanionPath("/inbox")).toBe("/mobile/inbox");
    expect(resolveCompanionPath("/skills")).toBe("/mobile/progression");
  });
  it("reports the reduced scope", () => {
    expect(mobileRouteAuditSummary.authenticatedRoutesAudited).toBe(4);
    expect(mobileRouteAuditSummary.dedicatedMobilePatterns).toBe(4);
    expect(mobileRouteAuditSummary.containedFallbackPatterns).toBe(0);
    expect(getMobileDestination("/unknown")).toBe("schedule");
  });
});