import { describe, expect, it } from "vitest";
import { buildReplayEvidenceSummary } from "../engine/ReplayEvidenceSummary";
import type { GigViewerReplay } from "../../events/types";

function replay(overrides: Partial<GigViewerReplay> = {}): GigViewerReplay {
  return {
    id: "replay-1",
    gigId: "gig-1",
    gigOutcomeId: "outcome-1",
    viewerVersion: 1,
    eventSchemaVersion: 1,
    simulationSeed: "gig-1:seed",
    durationMs: 60_000,
    generatedAt: "2026-07-11T00:00:00Z",
    checksum: "abc",
    status: "ready",
    events: [
      { id: "e1", sequence: 0, phase: "doors", eventType: "phase_change", scheduledOffsetMs: 0, durationMs: 1000, importance: "minor", messageKey: "doors", messageParams: {}, visualPayload: { type: "phase" } },
      { id: "e2", sequence: 1, phase: "main_set", eventType: "song_start", scheduledOffsetMs: 1000, durationMs: 20_000, importance: "major", messageKey: "song", messageParams: {}, visualPayload: { type: "song_start", songId: "song-1" } },
    ] as unknown as GigViewerReplay["events"],
    ...overrides,
  };
}

describe("replay evidence summary", () => {
  it("reports ambient evidence for replays without commerce facts", () => {
    const summary = buildReplayEvidenceSummary({ replay: replay(), supportedEventSchemaVersion: 1 });
    expect(summary.evidenceMode).toBe("ambient");
    expect(summary.presentationInference).toBe(false);
    expect(summary.commerce.present).toBe(false);
    expect(summary.eventCount).toBe(2);
    expect(summary.songStartCount).toBe(1);
    expect(summary.eventCountsByPhase).toEqual({ doors: 1, main_set: 1 });
    expect(summary.schemaCompatibility).toBe("current");
  });

  it("surfaces aggregate settlement facts and marks presentation inference", () => {
    const summary = buildReplayEvidenceSummary({
      supportedEventSchemaVersion: 1,
      replay: replay({
        commerce: {
          formulaVersion: "gig-settlement-v3",
          settlementId: "settlement-1",
          merchandise: { itemsSold: 4, grossRevenue: 80, cost: 20, owner: "band", lines: [{ merchandiseId: "m1", variantId: null, itemType: "shirt", name: "Tour shirt", quantity: 4, unitPrice: 20, gross: 80 }] },
          bar: { drinksServed: 30, grossRevenue: 300, venueRevenue: 300, bandEntitlement: 0, owner: "venue", shareSource: "venue_fallback" },
        },
      }),
    });
    expect(summary.evidenceMode).toBe("aggregate");
    expect(summary.presentationInference).toBe(true);
    expect(summary.commerce.merchandiseItemsSold).toBe(4);
    expect(summary.commerce.barDrinksServed).toBe(30);
    expect(summary.commerce.barOwner).toBe("venue");
  });

  it("classifies schema drift and never exposes the raw simulation seed", () => {
    const legacy = buildReplayEvidenceSummary({ replay: replay({ eventSchemaVersion: 1 }), supportedEventSchemaVersion: 2 });
    const future = buildReplayEvidenceSummary({ replay: replay({ eventSchemaVersion: 3 }), supportedEventSchemaVersion: 2 });
    expect(legacy.schemaCompatibility).toBe("legacy");
    expect(future.schemaCompatibility).toBe("unsupported");
    expect(legacy.simulationSeedFingerprint).toMatch(/^seed-v1-[0-9a-f]{8}$/);
    expect(legacy.simulationSeedFingerprint).not.toContain("gig-1");
  });

  it("passes validation failures through unchanged", () => {
    const summary = buildReplayEvidenceSummary({ replay: replay(), supportedEventSchemaVersion: 1, validationFailures: ["checksum mismatch"] });
    expect(summary.validationFailures).toEqual(["checksum mismatch"]);
  });
});
