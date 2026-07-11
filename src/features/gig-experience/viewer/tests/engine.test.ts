import { describe, expect, it } from "vitest";
import { selectVenuePreset, scaleVenuePreset } from "../engine/VenueLayout";
import { buildEntityLayout } from "../engine/EntityLayout";
import { derivePlaybackState, ReplayClock } from "../engine/PlaybackController";
import type { GigViewerReplay } from "../../events/types";

const event = (sequence: number, offset: number, payload: any = { type: "venue_open", entranceIds: ["main"], lightLevel: .4 }) => ({ id: `e${sequence}`, gigId: "g1", sequence, scheduledOffsetMs: offset, durationMs: 1000, phase: sequence === 2 ? "completed" : "venue_opening", eventType: sequence === 2 ? "replay_completed" : "venue_opened", importance: "normal", messageKey: "gig.viewer.venue_opened", messageParams: {}, visualPayload: payload }) as any;
const replay: GigViewerReplay = { id: "r1", gigId: "g1", gigOutcomeId: "o1", viewerVersion: 1, eventSchemaVersion: 1, simulationSeed: "seed", durationMs: 3000, generatedAt: "now", checksum: null, status: "ready", events: [event(0, 0), event(1, 1000, { type: "song_start", songId: "s1", title: "Song", position: 1, montage: false }), event(2, 3000)] };

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
    a.crowd.forEach((c) => { expect(c.x).toBeGreaterThanOrEqual(0); expect(c.x).toBeLessThanOrEqual(800); expect(c.y).toBeGreaterThanOrEqual(0); expect(c.y).toBeLessThanOrEqual(450); });
  });
  it("supports unknown and large performer groups", () => {
    const many = { ...replay, events: Array.from({ length: 12 }, (_, i) => event(i, i * 100, { type: "performer_enter", performerId: `p${i}`, displayName: `Member ${i + 1}`, roleOrInstrument: i % 2 ? "unknown" : "drums", startPosition: { x: .5, y: .5, zone: "front_center" } })) };
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
    let now = 0; const clock = new ReplayClock(3000, () => now);
    clock.play(); now = 100; expect(clock.position()).toBe(100);
    clock.setSpeed(2); now = 200; expect(clock.position()).toBe(300);
    clock.pause(); now = 10000; expect(clock.position()).toBe(300);
    clock.restart(); expect(clock.position()).toBe(0);
  });
});
