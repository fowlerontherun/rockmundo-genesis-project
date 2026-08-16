import { describe, expect, it } from "vitest";
import { buildVenueSignagePlan } from "../engine/VenueSignagePlan";
import { generateVenueScene } from "../engine/VenueSceneRegistry";

const scenes = [
  generateVenueScene({ gigId: "gig-club", venueName: "The Testing Room", venueType: "club", capacity: 600 }),
  generateVenueScene({ gigId: "gig-arena", venueName: "Test Arena", venueType: "arena", capacity: 18_000 }),
  generateVenueScene({ gigId: "gig-festival", venueName: "Test Fields", venueType: "festival", capacity: 55_000 }),
];

describe("venue signage plan", () => {
  it("is deterministic for the same scene and venue name", () => {
    for (const scene of scenes) {
      const a = buildVenueSignagePlan({ scene, venueName: "Test Venue" });
      const b = buildVenueSignagePlan({ scene, venueName: "Test Venue" });
      expect(JSON.stringify(b)).toBe(JSON.stringify(a));
      expect(a.panels.length).toBeGreaterThan(0);
    }
  });

  it("keeps panels inside the viewport and off the stage", () => {
    for (const scene of scenes) {
      const plan = buildVenueSignagePlan({ scene, venueName: "Test Venue" });
      for (const panel of plan.panels) {
        expect(panel.bounds.width).toBeGreaterThan(0);
        expect(panel.bounds.height).toBeGreaterThan(0);
        expect(panel.bounds.x).toBeGreaterThanOrEqual(0);
        expect(panel.bounds.y).toBeGreaterThanOrEqual(0);
        expect(panel.bounds.x + panel.bounds.width).toBeLessThanOrEqual(1000.01);
        expect(panel.bounds.y + panel.bounds.height).toBeLessThanOrEqual(1000.01);
      }
    }
  });

  it("removes all signage motion under reduced motion", () => {
    for (const scene of scenes) {
      const plan = buildVenueSignagePlan({ scene, venueName: "Test Venue", reducedMotion: true });
      expect(plan.reducedMotion).toBe(true);
      expect(plan.panels.every((panel) => panel.motion === 0)).toBe(true);
    }
  });

  it("varies with the venue name without changing panel count", () => {
    const [scene] = scenes;
    const a = buildVenueSignagePlan({ scene, venueName: "Alpha Hall" });
    const b = buildVenueSignagePlan({ scene, venueName: "Beta Hall" });
    expect(a.panels.length).toBe(b.panels.length);
    expect(a.panels.map((panel) => panel.text)).not.toEqual(b.panels.map((panel) => panel.text));
  });
});
