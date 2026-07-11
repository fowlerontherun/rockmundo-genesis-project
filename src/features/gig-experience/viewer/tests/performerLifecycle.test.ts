import { describe, expect, it } from "vitest";
import type { GigViewerReplay } from "../../events/types";
import { buildPerformerPlan, normalizePerformerRole, reconstructPerformerState } from "../engine/PerformerLifecycle";

const replay = (roles = ["Vocals", "Lead Guitarist", "Bass", "Drums"]): GigViewerReplay => ({
  id: "r", gigId: "g", gigOutcomeId: "o", viewerVersion: 1, eventSchemaVersion: 1, simulationSeed: "seed", durationMs: 30000, generatedAt: "2026-07-11T00:00:00Z", checksum: null, status: "ready",
  events: [
    { id: "v", gigId: "g", sequence: 0, phase: "venue_opening", eventType: "venue_opened", scheduledOffsetMs: 0, durationMs: 1000, importance: "normal", messageKey: "", messageParams: {}, visualPayload: { type: "venue_open", entranceIds: [], lightLevel: 1 } },
    ...roles.map((role, i) => ({ id: `e-${i}`, gigId: "g", sequence: i + 1, phase: "band_entrance" as const, eventType: "performer_entered" as const, scheduledOffsetMs: 1000 + i * 500, durationMs: 1000, importance: "normal" as const, performerProfileId: `p-${i}`, messageKey: "", messageParams: {}, visualPayload: { type: "performer_enter" as const, performerId: `p-${i}`, displayName: `Person ${i}`, roleOrInstrument: role, startPosition: { x: .5, y: .5, zone: "front_center" as const } } })),
    { id: "m", gigId: "g", sequence: 20, phase: "song_performance", eventType: "performer_moved", scheduledOffsetMs: 9000, durationMs: 2000, importance: "normal", messageKey: "", messageParams: {}, visualPayload: { type: "performer_move", performerId: "p-1", targetPosition: { x: .4, y: .6, zone: "front_left" }, movementStyle: "walk" } },
    { id: "x", gigId: "g", sequence: 21, phase: "band_exit", eventType: "band_exited", scheduledOffsetMs: 20000, durationMs: 2000, importance: "normal", messageKey: "", messageParams: {}, visualPayload: { type: "band_exit", exitStyle: "quick", performerIds: roles.map((_, i) => `p-${i}`) } },
    { id: "c", gigId: "g", sequence: 22, phase: "completed", eventType: "replay_completed", scheduledOffsetMs: 29000, durationMs: 1000, importance: "ambient", messageKey: "", messageParams: {}, visualPayload: { type: "crowd_reaction", reaction: "still", intensity: 0 } },
  ]
});

describe("performer role normalization", () => {
  it("normalizes aliases and capitalization", () => {
    expect(normalizePerformerRole("Lead Guitarist")).toBe("lead_guitar");
    expect(normalizePerformerRole("Guitar - Lead")).toBe("lead_guitar");
    expect(normalizePerformerRole("rhythm_guitar")).toBe("rhythm_guitar");
    expect(normalizePerformerRole("DJ")).toBe("dj");
    expect(normalizePerformerRole("Keyboardist")).toBe("keyboard");
    expect(normalizePerformerRole(null)).toBe("unknown");
    expect(normalizePerformerRole("theremin wizard")).toBe("unknown");
  });
});

describe("performer stage lifecycle", () => {
  it("keeps slots bounded and uses deterministic role placement", () => {
    const plan = buildPerformerPlan({ replay: replay(), size: { width: 900, height: 500 } });
    expect(plan.entities).toHaveLength(4);
    expect(plan.entities.find((p) => p.role === "drums")?.stageZone).toBe("back_center");
    for (const p of plan.entities) expect(p.stageSlot.x).toBeGreaterThanOrEqual(plan.stage.x);
    expect(buildPerformerPlan({ replay: replay(), size: { width: 900, height: 500 } }).entities).toEqual(plan.entities);
  });

  it("supports solo, duplicate, large, and unknown role layout", () => {
    const solo = buildPerformerPlan({ replay: replay(["unknown"]), size: { width: 600, height: 400 } });
    expect(solo.entities[0].stageZone).toBe("front_center");
    const large = buildPerformerPlan({ replay: replay(Array.from({ length: 14 }, (_, i) => i % 2 ? "Guitar" : "Mystery")), size: { width: 900, height: 500 } });
    expect(large.entities).toHaveLength(14);
    expect(new Set(large.entities.map((p) => `${Math.round(p.stageSlot.x)}:${Math.round(p.stageSlot.y)}`)).size).toBeGreaterThan(6);
  });

  it("reconstructs entrance, performance, move override, exit, seeking, and reduced motion", () => {
    const r = replay(); const plan = buildPerformerPlan({ replay: r, size: { width: 900, height: 500 } });
    expect(reconstructPerformerState(plan, r, 0)[0].lifecycleState).toBe("waiting_backstage");
    expect(reconstructPerformerState(plan, r, 1200)[0].lifecycleState).toBe("entering");
    expect(reconstructPerformerState(plan, r, 8000)[0].lifecycleState).toBe("performing");
    expect(reconstructPerformerState(plan, r, 9500).find((p) => p.id === "p-1")?.activeMoveEventId).toBe("m");
    expect(reconstructPerformerState(plan, r, 21000)[0].lifecycleState).toBe("exiting");
    expect(reconstructPerformerState(plan, r, 23000)[0].lifecycleState).toBe("hidden");
    expect(reconstructPerformerState(plan, r, 8000)).toEqual(reconstructPerformerState(plan, r, 8000));
    expect(reconstructPerformerState(plan, r, 1200, { reducedMotion: true })[0].currentPosition).toEqual(plan.entities[0].stageSlot);
  });

  it("uses role movement zones and reduced low-performance idle", () => {
    const r = replay(); const plan = buildPerformerPlan({ replay: r, size: { width: 900, height: 500 } });
    const vocalist = plan.entities.find((p) => p.role === "vocalist")!;
    const drummer = plan.entities.find((p) => p.role === "drums")!;
    expect(vocalist.movementZone.radius).toBeGreaterThan(drummer.movementZone.radius);
    const normal = reconstructPerformerState(plan, r, 10000).find((p) => p.role === "vocalist")!;
    const reduced = reconstructPerformerState(plan, r, 10000, { reducedMotion: true }).find((p) => p.role === "vocalist")!;
    expect(reduced.currentPosition).toEqual(vocalist.stageSlot);
    expect(Math.abs(normal.currentPosition.x - vocalist.stageSlot.x)).toBeLessThanOrEqual(vocalist.movementZone.radius);
  });
});
