import * as T from "three";
import { describe, expect, it } from "vitest";
import { buildFestivalOutdoorAtmosphere } from "./festivalOutdoorAtmosphere";
import { resolveVenueProfile } from "./venueProfile";
import { festivalStagePreset } from "./festivalStagePreset";

describe("outdoor scenery isolation", () => {
  it("uses a bounded, replay-stable precipitation batch and disables motion", () => {
    const atmosphere = { season: "winter", condition: "snowy", ground: "snow", temperature: -2, source: "seasonal" } as const;
    const preset = festivalStagePreset({ editionId: "edition", stageId: "main", stageName: "Main", capacity: 5000, reducedMotion: false, atmosphere });
    const scene = new T.Scene();
    const dressing = buildFestivalOutdoorAtmosphere(scene, resolveVenueProfile(preset.options.venue), atmosphere, true, 10, () => "white");
    const particles = scene.getObjectByName("festival-weather-particles") as T.Points;
    expect(particles.geometry.attributes.position.count).toBe(160);
    dressing.update(1, false);
    const frame = Array.from(particles.geometry.attributes.position.array);
    dressing.update(2, false);
    dressing.update(1, false);
    expect(Array.from(particles.geometry.attributes.position.array)).toEqual(frame);
    dressing.update(1, true);
    expect(particles.visible).toBe(false);
    expect(preset.settings.crowd).toBe(0);
    expect(preset.crowdCue).toBeNull();
    expect(preset.options.performers).toEqual([]);
    scene.traverse(object => {
      if (object instanceof T.Mesh || object instanceof T.Points) {
        object.geometry.dispose();
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose());
      }
    });
  });
});