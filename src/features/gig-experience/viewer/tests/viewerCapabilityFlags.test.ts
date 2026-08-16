import { describe, expect, it } from "vitest";
import { resolveViewerCapabilities, rolloutBucket } from "../config/viewerCapabilityFlags";

describe("viewer capability flags", () => {
  it("keeps buckets stable and in range", () => {
    const first = rolloutBucket("gig-123");
    expect(first).toBe(rolloutBucket("gig-123"));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(100);
    expect(rolloutBucket("")).toBe(-1);
  });

  it("disables the living venue entirely at stage off", () => {
    for (const audience of ["admin_demo", "internal", "player"] as const) {
      const result = resolveViewerCapabilities({ audience, stage: "off", subjectId: "gig-1" });
      expect(result.livingVenueEnabled).toBe(false);
      expect(result.reason).toBe("stage_off");
    }
  });

  it("limits admin_demo stage to the admin demo audience", () => {
    expect(resolveViewerCapabilities({ audience: "admin_demo", stage: "admin_demo" }).livingVenueEnabled).toBe(true);
    expect(resolveViewerCapabilities({ audience: "internal", stage: "admin_demo" }).livingVenueEnabled).toBe(false);
    expect(resolveViewerCapabilities({ audience: "player", stage: "admin_demo" }).livingVenueEnabled).toBe(false);
  });

  it("adds internal audiences at internal_replay", () => {
    expect(resolveViewerCapabilities({ audience: "internal", stage: "internal_replay" }).reason).toBe("internal_audience");
    expect(resolveViewerCapabilities({ audience: "player", stage: "internal_replay" }).livingVenueEnabled).toBe(false);
  });

  it("bucket-gates players deterministically at percentage stage", () => {
    const subject = "gig-percentage-subject";
    const bucket = rolloutBucket(subject);
    const included = resolveViewerCapabilities({ audience: "player", stage: "percentage", percentage: bucket + 1, subjectId: subject });
    const excluded = resolveViewerCapabilities({ audience: "player", stage: "percentage", percentage: bucket, subjectId: subject });
    expect(included.livingVenueEnabled).toBe(true);
    expect(included.reason).toBe("percentage_included");
    expect(excluded.livingVenueEnabled).toBe(false);
    expect(excluded.reason).toBe("percentage_excluded");
    // Repeated resolution never flips a subject.
    expect(resolveViewerCapabilities({ audience: "player", stage: "percentage", percentage: bucket, subjectId: subject }).livingVenueEnabled).toBe(false);
  });

  it("enables everyone at default while keeping the fallback reachable", () => {
    const result = resolveViewerCapabilities({ audience: "player", stage: "default", subjectId: "gig-9" });
    expect(result.livingVenueEnabled).toBe(true);
    expect(result.legacyFallbackAvailable).toBe(true);
    expect(resolveViewerCapabilities({ audience: "player", stage: "default", legacyFallbackAvailable: false }).legacyFallbackAvailable).toBe(false);
  });
});
