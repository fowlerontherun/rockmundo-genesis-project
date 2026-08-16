import { describe, expect, it } from "vitest";
import { createRecordingCanvas } from "./support/recordingCanvas";
import { generateVenueScene } from "../engine/VenueSceneRegistry";
import { buildVenueDetailPlan } from "../engine/VenueDetailPlan";
import { buildVenueSignagePlan, drawVenueSignage } from "../engine/VenueSignagePlan";
import { drawSceneDecorationsAndServices, drawVenueArchitecture } from "../engine/VenueSceneRenderer";

const SIZE = { width: 1280, height: 720 };

const CASES = [
  { name: "club", input: { gigId: "vr-club", venueName: "The Testing Room", venueType: "club", capacity: 600 } },
  { name: "arena", input: { gigId: "vr-arena", venueName: "Test Arena", venueType: "arena", capacity: 18_000 } },
  { name: "festival", input: { gigId: "vr-festival", venueName: "Test Fields", venueType: "festival", capacity: 55_000 } },
] as const;

function renderCase(input: (typeof CASES)[number]["input"], reducedMotion: boolean, positionMs: number) {
  const scene = generateVenueScene(input);
  const detail = buildVenueDetailPlan({ scene, floorPattern: "wood" });
  const signage = buildVenueSignagePlan({ scene, venueName: input.venueName, reducedMotion });
  const recorder = createRecordingCanvas();
  drawVenueArchitecture(recorder.ctx, SIZE, scene);
  drawSceneDecorationsAndServices(recorder.ctx, SIZE, scene, detail);
  drawVenueSignage(recorder.ctx, SIZE, signage, positionMs, reducedMotion);
  return recorder;
}

describe("viewer visual regression gate", () => {
  it.each(CASES)("renders $name identically across repeated draws", ({ input }) => {
    const first = renderCase(input, false, 12_000);
    const second = renderCase(input, false, 12_000);
    expect(second.fingerprint()).toBe(first.fingerprint());
    expect(first.ops.length).toBeGreaterThan(20);
  });

  it("keeps archetypes visually distinct", () => {
    const fingerprints = CASES.map(({ input }) => renderCase(input, false, 12_000).fingerprint());
    expect(new Set(fingerprints).size).toBe(CASES.length);
  });

  it("freezes animated signage output under reduced motion", () => {
    const early = renderCase(CASES[1].input, true, 0).fingerprint();
    const late = renderCase(CASES[1].input, true, 45_000).fingerprint();
    expect(late).toBe(early);
  });

  it("animates signage over time when motion is allowed", () => {
    const early = renderCase(CASES[1].input, false, 0).fingerprint();
    const late = renderCase(CASES[1].input, false, 45_000).fingerprint();
    expect(late).not.toBe(early);
  });
});
