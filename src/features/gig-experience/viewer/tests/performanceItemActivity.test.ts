import { describe, expect, it } from "vitest";
import type { GigViewerEvent } from "../../events/types";
import { derivePerformanceItemActivity } from "../engine/PerformanceItemActivity";

const stage = { x: 20, y: 10, width: 200, height: 100 };
const audience = { x: 10, y: 120, width: 220, height: 180 };

function itemEvent(action: "stage_dive" | "crowd_surf" = "stage_dive"): GigViewerEvent {
  return {
    id: "item-event",
    gigId: "gig-1",
    sequence: 0,
    phase: "song_performance",
    eventType: "song_crowd_reaction",
    scheduledOffsetMs: 1_000,
    durationMs: 1_000,
    importance: "important",
    performanceItemId: "item-1",
    performerProfileId: "performer-1",
    messageKey: "gig.viewer.performance_item_reaction",
    messageParams: { title: "Stage Dive" },
    visualPayload: { type: "performance_item", itemId: "item-1", name: "Stage Dive", category: "stage_action", action, performerId: "performer-1", intensity: 0.8 },
  };
}

describe("performance-item canvas reconstruction", () => {
  it("ignores non-item events and positions outside the active interval", () => {
    expect(derivePerformanceItemActivity(undefined, 1_500, stage, audience, false)).toBeNull();
    expect(derivePerformanceItemActivity(itemEvent(), 999, stage, audience, false)).toBeNull();
    expect(derivePerformanceItemActivity(itemEvent(), 2_001, stage, audience, false)).toBeNull();
  });

  it("reconstructs a stage dive deterministically and replaces the stage marker", () => {
    const origin = { x: 80, y: 70 };
    const early = derivePerformanceItemActivity(itemEvent(), 1_200, stage, audience, false, origin)!;
    const late = derivePerformanceItemActivity(itemEvent(), 1_900, stage, audience, false, origin)!;

    expect(early).toEqual(derivePerformanceItemActivity(itemEvent(), 1_200, stage, audience, false, origin));
    expect(early.hideStagePerformer).toBe(true);
    expect(early.performerId).toBe("performer-1");
    expect(late.performerPosition?.y).toBeGreaterThan(early.performerPosition?.y ?? 0);
    expect(late.focus.y).toBeGreaterThanOrEqual(audience.y);
  });

  it("keeps reduced-motion choreography stable across playback positions", () => {
    const first = derivePerformanceItemActivity(itemEvent(), 1_200, stage, audience, true)!;
    const second = derivePerformanceItemActivity(itemEvent(), 1_800, stage, audience, true)!;
    expect(first.progress).toBe(0.5);
    expect(second.progress).toBe(0.5);
    expect(first.performerPosition).toEqual(second.performerPosition);
  });

  it("keeps crowd surfing inside the audience bounds", () => {
    const frame = derivePerformanceItemActivity(itemEvent("crowd_surf"), 1_600, stage, audience, false)!;
    expect(frame.performerPosition?.x).toBeGreaterThanOrEqual(audience.x);
    expect(frame.performerPosition?.x).toBeLessThanOrEqual(audience.x + audience.width);
    expect(frame.performerPosition?.y).toBeGreaterThanOrEqual(audience.y);
    expect(frame.performerPosition?.y).toBeLessThanOrEqual(audience.y + audience.height);
  });
});
