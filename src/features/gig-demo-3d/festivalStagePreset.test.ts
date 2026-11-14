import { describe, expect, it } from "vitest";
import { festivalStagePreset } from "./festivalStagePreset";
import { productionLayout } from "./venueProduction";
import { resolveVenueProfile } from "./venueProfile";

const stage = { editionId: "edition", stageId: "main", stageName: "Main Stage", capacity: 20000, reducedMotion: false };

describe("festival stage preset", () => {
  it("uses the shared outdoor arena, wing screens and a deterministic edition seed", () => {
    const result = festivalStagePreset({ ...stage, artist: "Confirmed Artist", localHour: 17, crowdBand: "busy" });
    const profile = resolveVenueProfile(result.options.venue);
    expect(profile).toMatchObject({ outdoor: true, capacity: 20000, kind: "festival_stage" });
    expect(productionLayout(profile)).toMatchObject({ wings: true });
    expect(result.options).toMatchObject({ performers: [], outdoorDaylight: true, venue: { bandName: "Confirmed Artist" } });
    expect(result.settings).toMatchObject({ camera: "front", crowd: .5, quality: "low" });
    expect(result.crowdCue).toMatchObject({ environment: "festival", crowdSize: "large", category: "ambient", intensity: 3 });
    expect(festivalStagePreset(stage).options.venue.seed).toBe(result.options.venue.seed);
    expect(festivalStagePreset({ ...stage, editionId: "other" }).options.venue.seed).not.toBe(result.options.venue.seed);
  });

  it("uses night lighting, a stage name and silence without observations", () => {
    expect(festivalStagePreset({ ...stage, localHour: 22, reducedMotion: true })).toMatchObject({
      options: { outdoorDaylight: false, venue: { bandName: "Main Stage" } },
      settings: { reducedMotion: true, crowd: 0 },
      crowdCue: null,
    });
  });
});
