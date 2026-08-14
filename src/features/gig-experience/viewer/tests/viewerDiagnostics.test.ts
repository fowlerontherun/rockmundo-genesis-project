import { describe, expect, it } from "vitest";
import { PERFORMANCE_BUDGETS, buildViewerDiagnostics, resolvePerformanceTier } from "../engine/ViewerDiagnostics";
import { normalizeGigExperienceFailure } from "../../diagnostics";
import { GigReplayBuildError } from "../../events/generator";

const replay = (id: string) => ({ id: `replay-${id}`, gigId: id, simulationSeed: `seed-${id}`, events: [] }) as any;
const experience = (id: string) => ({
  gig: { id, scheduledDate: "2026-08-14T20:00:00Z", venue: { id: "venue", name: "Park stage", type: "festival", location: "Rural", environment: "countryside", capacity: 5_000 } },
  headline: { attendance: { status: "available", value: 4_000 }, capacity: { status: "available", value: 5_000 } },
}) as any;

describe("viewer baseline diagnostics", () => {
  it("keeps a fixture fingerprint stable and exposes non-sensitive contracts", () => {
    const input = { replay: replay("gig-a"), experience: experience("gig-a"), cameraMode: "venue_wide" as const, reducedMotion: false };
    expect(buildViewerDiagnostics(input)).toEqual(buildViewerDiagnostics(input));
    expect(buildViewerDiagnostics(input)).toMatchObject({ cameraMode: "venue_wide", venueArchetype: "festival", environmentKind: "countryside", activityEvidenceMode: "ambient" });
    expect(buildViewerDiagnostics(input).seedFingerprint).toMatch(/^scene-v1-[0-9a-f]{8}$/);
  });

  it("produces controlled seed differences without viewport inputs", () => {
    const first = buildViewerDiagnostics({ replay: replay("gig-a"), experience: experience("gig-a"), cameraMode: "auto", reducedMotion: false });
    const second = buildViewerDiagnostics({ replay: replay("gig-b"), experience: experience("gig-b"), cameraMode: "auto", reducedMotion: false });
    expect(first.seedFingerprint).not.toBe(second.seedFingerprint);
  });

  it("resolves typed tiers from preference and capability, not viewport width", () => {
    expect(Object.keys(PERFORMANCE_BUDGETS)).toEqual(["low", "standard", "high"]);
    expect(resolvePerformanceTier({ preference: "standard", hardwareConcurrency: 2 })).toBe("standard");
    expect(resolvePerformanceTier({ hardwareConcurrency: 2, deviceMemoryGb: 2 })).toBe("low");
    expect(resolvePerformanceTier({ hardwareConcurrency: 16, deviceMemoryGb: 16 })).toBe("high");
  });

  it("keeps explicitly available zero attendance at zero", () => {
    const empty = experience("gig-empty");
    empty.headline.attendance.value = 0;
    expect(buildViewerDiagnostics({ replay: replay("gig-empty"), experience: empty, cameraMode: "venue_wide", reducedMotion: false }).representativeCrowdCount).toBe(0);
  });

  it("preserves typed replay build diagnostics with bounded issue details", () => {
    const failure = normalizeGigExperienceFailure("gig-sensitive", "presentation", "buildGigViewerReplay", new GigReplayBuildError("INVALID_REPLAY", ["event 2 invalid payload", "x".repeat(500)]));
    expect(failure.reference).toBe("GIGVIEW-PRESENTATION-INVALID_REPLAY-ENSITIVE");
    expect(failure.code).toBe("INVALID_REPLAY");
    expect(failure.details).toContain("event 2 invalid payload");
    expect(failure.details!.length).toBeLessThanOrEqual(322);
    expect(failure.reference).not.toContain("UNKNOWN");
  });
});
