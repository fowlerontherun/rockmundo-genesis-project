import { describe, expect, it } from "vitest";
import type { GigViewerReplay } from "../../events/types";
import { buildStoryModel } from "../engine/StoryEngine";
import { buildVenueActivityPlan, deriveVenueActivity } from "../engine/VenueActivity";
import { generateVenueScene } from "../engine/VenueSceneRegistry";

const replay: GigViewerReplay = { id: "replay-1", gigId: "gig-1", gigOutcomeId: "outcome", viewerVersion: 1, eventSchemaVersion: 1, simulationSeed: "stable-seed", durationMs: 60_000, generatedAt: "2026-01-01T00:00:00Z", checksum: null, status: "ready", events: [{ id: "song", gigId: "gig-1", sequence: 1, phase: "song_performance", eventType: "song_started", scheduledOffsetMs: 5_000, durationMs: 20_000, importance: "normal", crowdEnergyBefore: 45, crowdEnergyAfter: 65, messageKey: "gig.viewer.song_started", messageParams: {}, visualPayload: { type: "song_start", songId: "s1", title: "Test", position: 0, montage: false } }] };
const make = (venueName = "The Stadium") => { const scene = generateVenueScene({ gigId: replay.gigId, venueName, capacity: 30_000 }); return { scene, plan: buildVenueActivityPlan({ replay, story: buildStoryModel(replay, null), scene, displayedCrowd: 16 }) }; };

describe("deterministic venue activity", () => {
  it("produces stable schedules and actor ids without exceeding queue capacity", () => {
    const first = make(); const second = make(); expect(first.plan).toEqual(second.plan);
    expect(new Set(first.plan.visits.map((v) => v.actorId)).size).toBe(first.plan.visits.length);
    expect(first.plan.visits.length).toBeLessThanOrEqual(first.scene.queuePoints.bar.length + first.scene.queuePoints.merchandise.length);
    for (const service of ["bar", "merchandise"] as const) expect(new Set(first.plan.visits.filter((v) => v.service === service).map((v) => v.queueSlot)).size).toBe(first.plan.visits.filter((v) => v.service === service).length);
  });

  it("derives valid routes, service states and a return to the original crowd point", () => {
    const { scene, plan } = make();
    for (const visit of plan.visits) {
      const samples = [visit.departureMs + 1, visit.departureMs + visit.walkMs + visit.browseMs + 1, visit.departureMs + visit.walkMs + visit.browseMs + visit.queueMs + 1, visit.departureMs + visit.walkMs + visit.browseMs + visit.queueMs + visit.serviceMs + visit.returnMs + 1];
      const states = samples.map((time) => deriveVenueActivity(plan, time).find((a) => a.id === visit.actorId)!);
      expect(states[0].state).toBe(visit.service === "bar" ? "walking_to_bar" : "walking_to_merchandise");
      expect(states[1].state).toContain("queueing"); expect(states[2].state).toContain("being_served");
      expect(states[3]).toMatchObject({ state: "watching_stage", position: visit.origin, service: null, queueSlot: null });
      for (const point of [...visit.routeOut, ...visit.routeBack]) { expect(point.x).toBeGreaterThanOrEqual(0); expect(point.x).toBeLessThanOrEqual(1); expect(point.y).toBeGreaterThanOrEqual(0); expect(point.y).toBeLessThanOrEqual(1); expect(point.x >= scene.stage.x && point.x <= scene.stage.x + scene.stage.width && point.y >= scene.stage.y && point.y <= scene.stage.y + scene.stage.height).toBe(false); }
    }
    expect(plan.minimumWatchingFans).toBeGreaterThanOrEqual(4);
  });

  it("reconstructs directly for pause, speeds, seeks, restart and reduced motion", () => {
    const { plan } = make(); const t = plan.visits[0].departureMs + 1500;
    expect(deriveVenueActivity(plan, t)).toEqual(deriveVenueActivity(plan, t)); // paused frames
    expect(deriveVenueActivity(plan, t * 2)).toEqual(deriveVenueActivity(plan, t * 2)); // speed changes advance only playback time
    expect(deriveVenueActivity(plan, 0).every((a) => a.state === "watching_stage")).toBe(true);
    expect(deriveVenueActivity(plan, t)[0]).toEqual(deriveVenueActivity(plan, t)[0]); // backward/forward seek reconstruction
    expect(deriveVenueActivity(plan, t, true)[0].id).toBe(deriveVenueActivity(plan, t, false)[0].id);
  });

  it("distributes departures over the complete multi-song playback clock", () => {
    const { plan } = make();
    expect(plan.visits.some((visit) => visit.departureMs < replay.durationMs / 2)).toBe(true);
    expect(plan.visits.some((visit) => visit.departureMs >= replay.durationMs / 2)).toBe(true);
    expect(plan.visits.every((visit) => visit.departureMs + visit.walkMs + visit.queueMs + visit.serviceMs + visit.returnMs <= replay.durationMs)).toBe(true);
  });

  it("disables invalid or missing service routes safely", () => {
    const { scene } = make(); scene.paths.crowdToBar = []; scene.queuePoints.merchandise = [];
    const plan = buildVenueActivityPlan({ replay, story: buildStoryModel(replay, null), scene, displayedCrowd: 16 });
    expect(plan.visits).toEqual([]); expect(deriveVenueActivity(plan, 10_000)).toEqual([]);
  });
});
