import { describe, expect, it } from "vitest";
import type { GigViewerEvent } from "../../events/types";
import { cameraShotStrength, cameraTransform, deriveCameraFrame } from "../engine/CameraDirector";

const viewport = { width: 1280, height: 720 };
const stage = { x: 250, y: 90, width: 780, height: 245 };
const audience = { x: 240, y: 355, width: 800, height: 310 };
const performers = [
  { id: "vocalist", profileId: "vocalist", position: { x: 640, y: 250 }, visible: true },
  { id: "guitarist", profileId: "guitarist", position: { x: 440, y: 245 }, visible: true },
];

function event(overrides: Partial<GigViewerEvent> = {}): GigViewerEvent {
  return {
    id: "event-4",
    gigId: "gig-1",
    sequence: 4,
    phase: "song_performance",
    eventType: "song_crowd_reaction",
    scheduledOffsetMs: 1_000,
    durationMs: 2_000,
    importance: "important",
    songId: "song-1",
    crowdEnergyBefore: 55,
    crowdEnergyAfter: 68,
    messageKey: "gig.viewer.song_reaction",
    messageParams: { title: "Song" },
    visualPayload: { type: "crowd_reaction", reaction: "bounce", intensity: 0.68 },
    ...overrides,
  };
}

describe("gig viewer camera direction", () => {
  it("keeps reduced-motion and song-boundary frames on the complete venue", () => {
    const reduced = deriveCameraFrame({ event: event(), positionMs: 2_000, viewport, stage, audience, performers, reducedMotion: true });
    const boundary = deriveCameraFrame({
      event: event({ phase: "song_intro", eventType: "song_started", visualPayload: { type: "song_start", songId: "song-1", title: "Song", position: 0, montage: false } }),
      positionMs: 2_000,
      viewport,
      stage,
      audience,
      performers,
      reducedMotion: false,
    });
    expect(reduced).toMatchObject({ camera: { x: 640, y: 360, zoom: 1 }, shot: "wide", strength: 0 });
    expect(boundary).toEqual(reduced);
  });

  it("selects band members deterministically for ordinary song coverage", () => {
    const first = deriveCameraFrame({ event: event(), positionMs: 2_000, viewport, stage, audience, performers, reducedMotion: false });
    const repeated = deriveCameraFrame({ event: event(), positionMs: 2_000, viewport, stage, audience, performers, reducedMotion: false });
    expect(first).toEqual(repeated);
    expect(first.shot).toBe("performer");
    expect(first.subjectId).toBe("vocalist");
    expect(first.camera.zoom).toBeCloseTo(1.11);
  });

  it("cuts to the audience for the recorded encore decision", () => {
    const encore = deriveCameraFrame({
      event: event({ phase: "encore_decision", eventType: "encore_decided" }),
      positionMs: 2_000,
      viewport,
      stage,
      audience,
      performers,
      reducedMotion: false,
    });
    expect(encore).toMatchObject({ shot: "crowd", subjectId: null, strength: 1 });
    expect(encore.camera.zoom).toBeCloseTo(1.1);
    expect(encore.camera.y).toBeGreaterThan(viewport.height / 2);
  });

  it("frames the recorded performance-item action and its selected performer", () => {
    const item = event({
      performanceItemId: "item-1",
      performerProfileId: "guitarist",
      songId: null,
      visualPayload: { type: "performance_item", itemId: "item-1", name: "Stage Dive", category: "stage_action", action: "stage_dive", performerId: "guitarist", intensity: 0.9 },
    });
    const frame = deriveCameraFrame({ event: item, positionMs: 2_000, viewport, stage, audience, performers, performanceItemFocus: { x: 560, y: 410 }, reducedMotion: false });
    expect(frame).toMatchObject({ shot: "performance_item", subjectId: "item-1", strength: 1 });
    expect(frame.camera.zoom).toBe(1.2);
    expect(frame.camera.x).toBe(560);
    expect(frame.camera.y).toBe(410);
  });

  it("eases every directed shot back to wide without frame-history state", () => {
    expect(cameraShotStrength(0)).toBe(0);
    expect(cameraShotStrength(0.09)).toBeCloseTo(0.5);
    expect(cameraShotStrength(0.5)).toBe(1);
    expect(cameraShotStrength(0.91)).toBeCloseTo(0.5);
    expect(cameraShotStrength(1)).toBe(0);

    const start = deriveCameraFrame({ event: event(), positionMs: 1_000, viewport, stage, audience, performers, reducedMotion: false });
    const end = deriveCameraFrame({ event: event(), positionMs: 3_000, viewport, stage, audience, performers, reducedMotion: false });
    expect(start.camera).toEqual({ x: 640, y: 360, zoom: 1 });
    expect(end.camera).toEqual(start.camera);
  });

  it("produces a no-op transform for wide and a bounded transform for close shots", () => {
    expect(cameraTransform({ x: 640, y: 360, zoom: 1 }, viewport)).toEqual({ scale: 1, translateX: 0, translateY: 0 });
    const focused = cameraTransform({ x: -500, y: 5_000, zoom: 9 }, viewport);
    expect(focused.scale).toBe(1.2);
    expect(focused.translateX).toBeCloseTo(0);
    expect(focused.translateY).toBeCloseTo(-144);
  });
});
