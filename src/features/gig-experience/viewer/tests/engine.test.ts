import { describe, expect, it } from "vitest";
import { selectVenuePreset, scaleVenuePreset } from "../engine/VenueLayout";
import { buildEntityLayout } from "../engine/EntityLayout";
import { derivePlaybackState, ReplayClock } from "../engine/PlaybackController";
import type { GigViewerReplay } from "../../events/types";

const event = (
  sequence: number,
  offset: number,
  payload: any = { type: "venue_open", entranceIds: ["main"], lightLevel: 0.4 },
) =>
  ({
    id: `e${sequence}`,
    gigId: "g1",
    sequence,
    scheduledOffsetMs: offset,
    durationMs: 1000,
    phase: sequence === 2 ? "completed" : "venue_opening",
    eventType: sequence === 2 ? "replay_completed" : "venue_opened",
    importance: "normal",
    messageKey: "gig.viewer.venue_opened",
    messageParams: {},
    visualPayload: payload,
  }) as any;

const replay: GigViewerReplay = {
  id: "r1",
  gigId: "g1",
  gigOutcomeId: "o1",
  viewerVersion: 1,
  eventSchemaVersion: 1,
  simulationSeed: "seed",
  durationMs: 3000,
  generatedAt: "now",
  checksum: null,
  status: "ready",
  events: [
    event(0, 0),
    event(1, 1000, { type: "song_start", songId: "s1", title: "Song", position: 1, montage: false }),
    event(2, 3000),
  ],
};

describe("venue layout", () => {
  it("selects small, medium, and large presets with safe geometry", () => {
    expect(selectVenuePreset({ capacity: 100 }).name).toBe("small");
    expect(selectVenuePreset({ capacity: 700 }).name).toBe("medium");
    expect(selectVenuePreset({ capacity: 2000 }).name).toBe("large");
    expect(selectVenuePreset({ capacity: 0 }).name).toBe("medium");
    const scaled = scaleVenuePreset(selectVenuePreset({ capacity: 100 }), { width: 320, height: 240 });
    expect(scaled.stage.width).toBeGreaterThan(0);
    expect(scaled.audience.y).toBeGreaterThan(scaled.stage.y);
  });
});

describe("deterministic entity layout", () => {
  it("keeps crowd deterministic and bounded", () => {
    const a = buildEntityLayout({ replay, size: { width: 800, height: 450 } });
    const b = buildEntityLayout({ replay, size: { width: 800, height: 450 } });
    expect(a.crowd).toEqual(b.crowd);
    expect(a.performers).toEqual(b.performers);
    a.crowd.forEach((crowdMember) => {
      expect(crowdMember.x).toBeGreaterThanOrEqual(0);
      expect(crowdMember.x).toBeLessThanOrEqual(800);
      expect(crowdMember.y).toBeGreaterThanOrEqual(0);
      expect(crowdMember.y).toBeLessThanOrEqual(450);
    });
  });

  it("supports unknown and large performer groups", () => {
    const many = {
      ...replay,
      events: Array.from({ length: 12 }, (_, i) =>
        event(i, i * 100, {
          type: "performer_enter",
          performerId: `p${i}`,
          displayName: `Member ${i + 1}`,
          roleOrInstrument: i % 2 ? "unknown" : "drums",
          startPosition: { x: 0.5, y: 0.5, zone: "front_center" },
        }),
      ),
    };
    expect(buildEntityLayout({ replay: many, size: { width: 900, height: 500 } }).performers).toHaveLength(12);
  });
});

describe("playback", () => {
  it("derives active and completed events", () => {
    const state = derivePlaybackState(replay, 1200, true);
    expect(state.activeEvent?.id).toBe("e1");
    expect(state.currentSongTitle).toBe("Song");
    expect(state.completedEventIds.has("e0")).toBe(true);
    expect(state.nextEvent?.id).toBe("e2");
  });

  it("handles play, pause, speed, restart, and clock jumps", () => {
    let now = 0;
    const clock = new ReplayClock(3000, () => now);
    clock.play();
    now = 100;
    expect(clock.position()).toBe(100);
    clock.setSpeed(2);
    now = 200;
    expect(clock.position()).toBe(300);
    clock.pause();
    now = 10000;
    expect(clock.position()).toBe(300);
    clock.restart();
    expect(clock.position()).toBe(0);
  });
});

import {
  buildCrowdPackingCells,
  buildCrowdPlan,
  reconstructCrowdState,
  representedWeights,
  selectCrowdEntityCap,
} from "../engine/CrowdLifecycle";
import { pointInRect } from "../engine/Viewport";

describe("animated crowd lifecycle", () => {
  const crowdReplay: GigViewerReplay = {
    ...replay,
    durationMs: 20000,
    events: [
      event(0, 0, { type: "venue_open", entranceIds: ["main"], lightLevel: 0.4 }),
      event(1, 1000, { type: "crowd_fill", targetDensity: 0.5, zoneIds: ["front"], enteringCount: 50 }),
      event(2, 9000, { type: "song_start", songId: "s1", title: "Song", position: 1, montage: false }),
      event(3, 20000),
    ],
  };

  it("builds exact represented weights without overstatement", () => {
    expect(representedWeights(0, 100)).toEqual([]);
    expect(representedWeights(7, 100).reduce((a, b) => a + b, 0)).toBe(7);
    const odd = representedWeights(503, 100);
    expect(odd).toHaveLength(100);
    expect(odd.reduce((a, b) => a + b, 0)).toBe(503);
    expect(Math.max(...odd)).toBe(6);
    expect(representedWeights(10_001, 300).reduce((a, b) => a + b, 0)).toBe(10_001);
    const doubled = representedWeights(503, 2000, 2);
    expect(doubled).toHaveLength(1006);
    expect(doubled.reduce((a, b) => a + b, 0)).toBeCloseTo(503, 8);
  });

  it("centralizes doubled caps by device mode", () => {
    expect(selectCrowdEntityCap({ reducedMotion: true, width: 1400 })).toBeLessThanOrEqual(300);
    expect(selectCrowdEntityCap({ reducedMotion: false, width: 390 })).toBe(1800);
    expect(selectCrowdEntityCap({ reducedMotion: false, width: 800 })).toBe(3800);
    expect(selectCrowdEntityCap({ reducedMotion: false, width: 1300 })).toBe(5800);
  });

  it("assigns entrances and denser target positions deterministically inside audience bounds", () => {
    const plan = buildCrowdPlan({
      replay: crowdReplay,
      attendance: 503,
      capacity: 1500,
      size: { width: 900, height: 500 },
    });
    const again = buildCrowdPlan({
      replay: crowdReplay,
      attendance: 503,
      capacity: 1500,
      size: { width: 900, height: 500 },
    });
    expect(plan.baseEntities).toEqual(again.baseEntities);
    expect(plan.baseEntities).toHaveLength(1006);
    expect(new Set(plan.baseEntities.map((entity) => entity.entranceId)).size).toBeGreaterThan(1);
    const preset = scaleVenuePreset(selectVenuePreset({ capacity: 1500 }), { width: 900, height: 500 });
    plan.baseEntities.forEach((entity) => {
      expect(pointInRect(entity.target, preset.audience)).toBe(true);
      expect(pointInRect(entity.target, preset.stage)).toBe(false);
    });
  });

  it("orders packing cells from the stage edge outward and centre-first", () => {
    for (const capacity of [250, 700, 2000]) {
      const preset = scaleVenuePreset(selectVenuePreset({ capacity }), { width: 900, height: 500 });
      const cells = buildCrowdPackingCells(preset.crowdZones, preset.stage);
      expect(cells.length).toBeGreaterThan(0);
      for (let i = 1; i < cells.length; i += 1) {
        expect(cells[i].stageDistance).toBeGreaterThanOrEqual(cells[i - 1].stageDistance);
      }
      const nearestDepth = cells[0].stageDistance;
      const nearestBand = cells.filter((cell) => Math.abs(cell.stageDistance - nearestDepth) < 0.001);
      expect(nearestBand[0].lateralDistance).toBeLessThanOrEqual(nearestBand.at(-1)?.lateralDistance ?? 0);
      expect(cells[0].id).toContain("centre");
    }
  });

  it("fills front-centre areas before back and side areas in every venue size", () => {
    for (const capacity of [250, 700, 2000]) {
      const attendance = Math.max(1, Math.round(capacity * 0.1));
      const plan = buildCrowdPlan({
        replay: crowdReplay,
        attendance,
        capacity,
        size: { width: 900, height: 500 },
      });
      const preset = scaleVenuePreset(selectVenuePreset({ capacity }), { width: 900, height: 500 });
      const firstQuarter = plan.baseEntities.slice(0, Math.max(1, Math.floor(plan.baseEntities.length / 4)));
      const lastQuarter = plan.baseEntities.slice(-Math.max(1, Math.floor(plan.baseEntities.length / 4)));
      const stageEdgeY = preset.stage.y + preset.stage.height;
      const stageCentreX = preset.stage.x + preset.stage.width / 2;
      const averageDepth = (entities: typeof plan.baseEntities) =>
        entities.reduce((sum, entity) => sum + Math.max(0, entity.target.y - stageEdgeY), 0) / entities.length;
      const averageSideDistance = (entities: typeof plan.baseEntities) =>
        entities.reduce((sum, entity) => sum + Math.abs(entity.target.x - stageCentreX), 0) / entities.length;

      expect(plan.baseEntities.every((entity) => entity.targetZoneId.startsWith("front"))).toBe(true);
      expect(averageDepth(firstQuarter)).toBeLessThan(averageDepth(lastQuarter));
      expect(averageSideDistance(firstQuarter)).toBeLessThan(averageSideDistance(lastQuarter));
      const deepestTarget = Math.max(...plan.baseEntities.map((entity) => entity.target.y));
      expect(deepestTarget).toBeLessThan(preset.audience.y + preset.audience.height * 0.45);
    }
  });

  it("uses rear zones only after front zones are populated", () => {
    for (const capacity of [700, 2000]) {
      const partial = buildCrowdPlan({
        replay: crowdReplay,
        attendance: Math.round(capacity * 0.35),
        capacity,
        size: { width: 900, height: 500 },
      });
      const full = buildCrowdPlan({
        replay: crowdReplay,
        attendance: capacity,
        capacity,
        size: { width: 900, height: 500 },
      });
      expect(partial.baseEntities.every((entity) => entity.targetZoneId.startsWith("front"))).toBe(true);
      expect(full.baseEntities.some((entity) => !entity.targetZoneId.startsWith("front"))).toBe(true);
    }
  });

  it("reconstructs spawn, movement, settling, seeking, and reduced motion deterministically", () => {
    const plan = buildCrowdPlan({
      replay: crowdReplay,
      attendance: 120,
      capacity: 250,
      size: { width: 640, height: 360 },
    });
    const start = reconstructCrowdState(plan, 0);
    const mid = reconstructCrowdState(plan, 4500);
    const late = reconstructCrowdState(plan, 15000);
    expect(start.diagnostics.settledCount).toBe(0);
    expect(mid.diagnostics.movingCount).toBeGreaterThan(0);
    expect(late.diagnostics.settledCount).toBe(plan.baseEntities.length);
    expect(reconstructCrowdState(plan, 4500)).toEqual(mid);
    expect(reconstructCrowdState(plan, 1000).diagnostics.entityCount).toBe(plan.baseEntities.length);
    const reduced = reconstructCrowdState(plan, 4500, true);
    expect(reduced.entities.some((entity) => entity.visible && entity.x !== entity.target.x)).toBe(false);
    expect(reduced.milestones.some((milestone) => milestone.label.includes("half"))).toBe(true);
  });
});
