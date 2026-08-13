import { describe, expect, it } from "vitest";
import type { PerformerPresentationEntity } from "../engine/PerformerLifecycle";
import {
  buildPerformerTrail,
  derivePerformerFocusPulse,
  instrumentGlyphForRole,
  performerIsMoving,
} from "../engine/PerformerCounterRenderer";

function performer(
  overrides: Partial<PerformerPresentationEntity> = {},
): PerformerPresentationEntity {
  return {
    id: "performer-1",
    profileId: "profile-1",
    displayName: "Ari Stone",
    initials: "AS",
    role: "vocalist",
    roleLabel: "Vocals",
    instrument: "Vocals",
    performerType: "member",
    currentPosition: { x: 100, y: 100 },
    targetPosition: { x: 120, y: 100 },
    backstagePosition: { x: 20, y: 20 },
    entrancePoint: { x: 40, y: 40 },
    stageSlot: { x: 100, y: 100 },
    stageZone: "front_center",
    stageDescription: "front centre",
    movementZone: { x: 80, y: 80, width: 40, height: 40, radius: 20 },
    movementSpeed: 1,
    idlePhase: 0,
    visible: true,
    lifecycleState: "performing",
    activeMoveEventId: null,
    label: "VO",
    ...overrides,
  };
}

describe("performer counter presentation", () => {
  it("maps every performer family to a compact instrument glyph", () => {
    expect(instrumentGlyphForRole("vocalist")).toBe("microphone");
    expect(instrumentGlyphForRole("backing_vocals")).toBe("microphone");
    expect(instrumentGlyphForRole("lead_guitar")).toBe("guitar");
    expect(instrumentGlyphForRole("bass")).toBe("bass");
    expect(instrumentGlyphForRole("drums")).toBe("drums");
    expect(instrumentGlyphForRole("electronic")).toBe("keys");
    expect(instrumentGlyphForRole("dj")).toBe("turntables");
    expect(instrumentGlyphForRole("strings")).toBe("strings");
    expect(instrumentGlyphForRole("brass")).toBe("brass");
    expect(instrumentGlyphForRole("percussion")).toBe("percussion");
    expect(instrumentGlyphForRole("unknown")).toBe("generic");
  });

  it("shows trails only for active lifecycle or recorded movement", () => {
    expect(performerIsMoving(performer())).toBe(false);
    expect(performerIsMoving(performer({ lifecycleState: "entering" }))).toBe(true);
    expect(performerIsMoving(performer({ lifecycleState: "taking_position" }))).toBe(true);
    expect(performerIsMoving(performer({ lifecycleState: "exiting" }))).toBe(true);
    expect(performerIsMoving(performer({ activeMoveEventId: "move-1" }))).toBe(true);
  });

  it("builds a chronological trail and removes stationary samples", () => {
    const current = performer({
      lifecycleState: "entering",
      currentPosition: { x: 110, y: 100 },
    });
    const trail = buildPerformerTrail({
      performer: current,
      history: [
        [performer({ lifecycleState: "entering", currentPosition: { x: 90, y: 100 } })],
        [performer({ lifecycleState: "entering", currentPosition: { x: 90.2, y: 100 } })],
        [performer({ lifecycleState: "entering", currentPosition: { x: 100, y: 100 } })],
      ],
      reducedMotion: false,
    });

    expect(trail).toEqual([
      { x: 90, y: 100 },
      { x: 100, y: 100 },
      { x: 110, y: 100 },
    ]);
    expect(buildPerformerTrail({ performer: current, history: [], reducedMotion: true })).toEqual([]);
    expect(buildPerformerTrail({ performer: performer(), history: [], reducedMotion: false })).toEqual([]);
  });

  it("derives deterministic pulses and freezes them for reduced motion", () => {
    expect(derivePerformerFocusPulse(1000, false, false)).toBeNull();
    expect(derivePerformerFocusPulse(1000, true, true)).toEqual({ radius: 24, alpha: 0.5 });
    expect(derivePerformerFocusPulse(1000, true, false)).toEqual(
      derivePerformerFocusPulse(1000, true, false),
    );
    expect(derivePerformerFocusPulse(1000, true, false)).not.toEqual(
      derivePerformerFocusPulse(1180, true, false),
    );
  });
});
