import { describe, expect, it } from "vitest";
import type { GigViewerReplay } from "../../events/types";
import { buildCrowdPlan } from "../engine/CrowdLifecycle";
import {
  CROWD_TUNING_PRESETS,
  DEFAULT_CROWD_TUNING,
  buildTunedCrowdPlan,
  normalizeCrowdTuning,
} from "../engine/CrowdTuning";
import { pointInRect } from "../engine/Viewport";
import { scaleVenuePreset, selectVenuePreset } from "../engine/VenueLayout";

const event = (sequence: number, offset: number, payload: any) => ({
  id: `event-${sequence}`,
  gigId: "gig-1",
  sequence,
  scheduledOffsetMs: offset,
  durationMs: 1000,
  phase: sequence === 2 ? "completed" : "venue_opening",
  eventType: sequence === 2 ? "replay_completed" : "venue_opened",
  importance: "normal",
  messageKey: "gig.viewer.fixture",
  messageParams: {},
  visualPayload: payload,
}) as any;

const replay: GigViewerReplay = {
  id: "crowd-tuning-replay",
  gigId: "gig-1",
  gigOutcomeId: "outcome-1",
  viewerVersion: 1,
  eventSchemaVersion: 1,
  simulationSeed: "crowd-tuning-seed",
  durationMs: 20_000,
  generatedAt: "2026-08-04T00:00:00Z",
  checksum: null,
  status: "ready",
  events: [
    event(0, 0, { type: "venue_open", entranceIds: ["main"], lightLevel: 0.4 }),
    event(1, 1000, { type: "crowd_fill", targetDensity: 0.7, zoneIds: ["front"], enteringCount: 300 }),
    event(2, 9000, { type: "song_start", songId: "song-1", title: "Fixture", position: 1, montage: false }),
  ],
};

const size = { width: 900, height: 500 };
const capacity = 1500;
const attendance = 750;
const preset = scaleVenuePreset(selectVenuePreset({ capacity }), size);

function tuned(values: Partial<typeof DEFAULT_CROWD_TUNING>) {
  return buildTunedCrowdPlan({
    replay,
    attendance,
    capacity,
    size,
    preset,
    tuning: values,
  });
}

describe("gig viewer crowd tuning", () => {
  it("leaves production crowd plans untouched without an explicit override", () => {
    const production = buildCrowdPlan({ replay, attendance, capacity, size });
    const throughTuner = buildTunedCrowdPlan({ replay, attendance, capacity, size, preset });
    expect(throughTuner).toEqual(production);
  });

  it("normalizes saved or pasted settings to safe renderer limits", () => {
    expect(normalizeCrowdTuning({
      densityMultiplier: 99,
      depthSpread: -4,
      lateralSpread: Number.NaN,
      stagePull: 8,
      randomness: -1,
      fanScale: 10,
      arrivalSpeed: 0,
    })).toEqual({
      densityMultiplier: 4,
      depthSpread: 0.45,
      lateralSpread: 1,
      stagePull: 1,
      randomness: 0,
      fanScale: 1.6,
      arrivalSpeed: 0.5,
    });
  });

  it("changes visual density without changing authoritative attendance", () => {
    const sparse = tuned({ ...DEFAULT_CROWD_TUNING, densityMultiplier: 0.5 });
    const dense = tuned({ ...DEFAULT_CROWD_TUNING, densityMultiplier: 4 });
    expect(dense.baseEntities.length).toBeGreaterThan(sparse.baseEntities.length);
    expect(sparse.baseEntities.reduce((sum, entity) => sum + entity.weight, 0)).toBeCloseTo(attendance, 8);
    expect(dense.baseEntities.reduce((sum, entity) => sum + entity.weight, 0)).toBeCloseTo(attendance, 8);
    expect(dense.attendance).toBe(attendance);
    expect(dense.capacity).toBe(capacity);
  });

  it("lets the demo compress crowds toward the stage and centre", () => {
    const front = tuned(CROWD_TUNING_PRESETS.frontCrush.values);
    const wide = tuned(CROWD_TUNING_PRESETS.wideFestival.values);
    const stageEdge = preset.stage.y + preset.stage.height;
    const stageCentre = preset.stage.x + preset.stage.width / 2;
    const averageDepth = (plan: typeof front) =>
      plan.baseEntities.reduce((sum, entity) => sum + Math.max(0, entity.target.y - stageEdge), 0) /
      plan.baseEntities.length;
    const averageLateral = (plan: typeof front) =>
      plan.baseEntities.reduce((sum, entity) => sum + Math.abs(entity.target.x - stageCentre), 0) /
      plan.baseEntities.length;

    expect(averageDepth(front)).toBeLessThan(averageDepth(wide));
    expect(averageLateral(front)).toBeLessThan(averageLateral(wide));
  });

  it("keeps every tuned target inside a valid audience area", () => {
    for (const values of Object.values(CROWD_TUNING_PRESETS).map((entry) => entry.values)) {
      const plan = tuned(values);
      plan.baseEntities.forEach((entity) => {
        const valid = (preset.crowdZones.length ? preset.crowdZones : [preset.audience])
          .some((zone) => pointInRect(entity.target, zone));
        expect(valid).toBe(true);
        expect(pointInRect(entity.target, preset.stage)).toBe(false);
      });
    }
  });

  it("applies fan size and arrival speed independently from packing", () => {
    const slowSmall = tuned({ ...DEFAULT_CROWD_TUNING, fanScale: 0.6, arrivalSpeed: 0.5 });
    const fastLarge = tuned({ ...DEFAULT_CROWD_TUNING, fanScale: 1.6, arrivalSpeed: 2 });
    expect(fastLarge.baseEntities[0].radius).toBeGreaterThan(slowSmall.baseEntities[0].radius);
    expect(fastLarge.baseEntities[0].travelMs).toBeLessThan(slowSmall.baseEntities[0].travelMs);
  });
});
