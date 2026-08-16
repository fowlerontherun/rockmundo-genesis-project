import { describe, expect, it } from "vitest";
import { canonicalReplayPayload, computeReplayChecksum, verifyReplayChecksum } from "../engine/ReplayChecksum";
import { buildVenueActivityPlan } from "../engine/VenueActivity";
import { buildStoryModel } from "../engine/StoryEngine";
import { generateVenueScene } from "../engine/VenueSceneRegistry";
import type { GigReplayCommerceEvent, GigViewerReplay } from "../../events/types";

function commerceEvents(): GigReplayCommerceEvent[] {
  return [
    { id: "c3", atMs: 42_000, service: "merchandise", quantity: 1, itemType: "shirt" },
    { id: "c1", atMs: 12_000, service: "bar", quantity: 2 },
    { id: "c2", atMs: 25_000, service: "bar", quantity: 1 },
    { id: "c4", atMs: 51_000, service: "merchandise", quantity: 2, itemType: "poster" },
  ];
}

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
    status: "ready",
    checksum: null,
    events: [
      { id: "e1", sequence: 0, phase: "doors", eventType: "phase_change", scheduledOffsetMs: 0, durationMs: 1000, importance: "minor", messageKey: "doors", messageParams: {}, visualPayload: { type: "phase" } },
      { id: "e2", sequence: 1, phase: "main_set", eventType: "song_start", scheduledOffsetMs: 1000, durationMs: 20_000, importance: "major", messageKey: "song", messageParams: {}, visualPayload: { type: "song_start", songId: "song-1" } },
    ] as unknown as GigViewerReplay["events"],
    commerce: {
      formulaVersion: "gig-settlement-v3",
      settlementId: "settlement-1",
      merchandise: { itemsSold: 3, grossRevenue: 60, cost: 15, owner: "band", lines: [{ merchandiseId: "m1", variantId: null, itemType: "shirt", name: "Tour shirt", quantity: 3, unitPrice: 20, gross: 60 }] },
      bar: { drinksServed: 3, grossRevenue: 30, venueRevenue: 30, bandEntitlement: 0, owner: "venue", shareSource: "venue_fallback" },
      events: commerceEvents(),
    },
    ...overrides,
  };
}

describe("replay checksum idempotency", () => {
  it("produces an identical checksum when a replay is regenerated from identical facts", () => {
    const first = computeReplayChecksum(replay());
    const second = computeReplayChecksum(replay());
    expect(second).toBe(first);
  });

  it("ignores event and commerce ordering, generation time and signed metadata", () => {
    const base = replay();
    const shuffled = replay({
      generatedAt: "2027-01-01T12:00:00Z",
      events: [...base.events].reverse(),
      commerce: { ...base.commerce!, events: [...commerceEvents()].reverse() },
    });
    expect(computeReplayChecksum(shuffled)).toBe(computeReplayChecksum(base));
  });

  it("changes when a material payload fact changes", () => {
    const base = computeReplayChecksum(replay());
    expect(computeReplayChecksum(replay({ durationMs: 61_000 }))).not.toBe(base);
    expect(computeReplayChecksum(replay({ simulationSeed: "other" }))).not.toBe(base);
    const drifted = replay();
    expect(
      computeReplayChecksum(replay({ commerce: { ...drifted.commerce!, bar: { ...drifted.commerce!.bar, drinksServed: 9 } } })),
    ).not.toBe(base);
  });

  it("verifies stored checksums and reports absence or drift", () => {
    const canonical = computeReplayChecksum(replay());
    expect(verifyReplayChecksum(replay({ checksum: canonical })).verdict).toBe("matched");
    expect(verifyReplayChecksum(replay({ checksum: "stale" })).verdict).toBe("mismatched");
    expect(verifyReplayChecksum(replay()).verdict).toBe("absent");
  });

  it("never includes signed asset urls or private cost data in the canonical payload", () => {
    const serialised = JSON.stringify(canonicalReplayPayload(replay()));
    expect(serialised).not.toContain("cost");
    expect(serialised).not.toContain("http");
  });
});

describe("event_replay commerce evidence", () => {
  const scene = generateVenueScene({ gigId: "gig-1", venueName: "The Testing Room", venueType: "club", capacity: 600 });

  it("switches to event_replay mode and keeps saved timings authoritative", () => {
    const source = replay();
    const plan = buildVenueActivityPlan({ replay: source, story: buildStoryModel(source, null), scene, displayedCrowd: 420 });
    expect(plan.evidenceMode).toBe("event_replay");
    const departures = plan.visits.map((visit) => visit.departureMs);
    expect(departures).toEqual([...departures].sort((a, b) => a - b));
    expect(departures.every((value) => value >= 0 && value <= source.durationMs)).toBe(true);
  });

  it("stays deterministic across rebuilds and falls back to aggregate without saved events", () => {
    const source = replay();
    const story = buildStoryModel(source, null);
    const a = buildVenueActivityPlan({ replay: source, story, scene, displayedCrowd: 420 });
    const b = buildVenueActivityPlan({ replay: source, story, scene, displayedCrowd: 420 });
    expect(b.visits.map((v) => `${v.service}:${v.departureMs}:${v.stationId}`)).toEqual(
      a.visits.map((v) => `${v.service}:${v.departureMs}:${v.stationId}`),
    );

    const aggregate = replay({ commerce: { ...source.commerce!, events: null } });
    expect(buildVenueActivityPlan({ replay: aggregate, story: buildStoryModel(aggregate, null), scene, displayedCrowd: 420 }).evidenceMode).toBe("aggregate");
  });
});
