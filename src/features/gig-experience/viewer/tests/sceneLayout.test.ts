import { describe, expect, it } from "vitest";
import { cameraForPlayback, clampCamera, containScene, VENUE_SCENE_SIZE, VENUE_SCENE_ZONES, WIDE_VENUE_CAMERA } from "../engine/SceneLayout";

describe("responsive wide venue scene", () => {
  it.each([{ width: 1440, height: 700 }, { width: 390, height: 420 }, { width: 844, height: 240 }, { width: 1920, height: 860 }])("contains the complete logical scene in $width x $height", (box) => {
    const fit = containScene(box);
    expect(fit.width).toBeLessThanOrEqual(box.width);
    expect(fit.height).toBeLessThanOrEqual(box.height);
    expect(fit.offsetX).toBeGreaterThanOrEqual(0);
    expect(fit.offsetY).toBeGreaterThanOrEqual(0);
    expect(fit.width / fit.height).toBeCloseTo(VENUE_SCENE_SIZE.width / VENUE_SCENE_SIZE.height);
  });

  it("publishes reusable anchors for venue expansion", () => {
    expect(Object.keys(VENUE_SCENE_ZONES)).toEqual(expect.arrayContaining(["stage", "crowd", "bar", "merchandise", "entrances", "walkingPaths", "exterior"]));
  });

  it("clamps camera movement and resets at song boundaries", () => {
    const clamped = clampCamera({ x: -500, y: 5000, zoom: 9 });
    expect(clamped.zoom).toBe(1.2);
    expect(clamped.x).toBeGreaterThan(0);
    expect(clamped.y).toBeLessThan(VENUE_SCENE_SIZE.height);
    expect(cameraForPlayback({ reducedMotion: false, songBoundary: true, requested: clamped })).toEqual(WIDE_VENUE_CAMERA);
  });

  it("uses the stable wide camera when reduced motion is enabled", () => {
    expect(cameraForPlayback({ reducedMotion: true, songBoundary: false, requested: { x: 900, y: 400, zoom: 1.15 } })).toEqual(WIDE_VENUE_CAMERA);
  });
});
