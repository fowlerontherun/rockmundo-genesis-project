import { describe, expect, it } from "vitest";
import { generateVenueScene, resolveVenueArchetype, VENUE_LAYOUT_REGISTRY, type VenueSceneLayout } from "../engine/VenueSceneRegistry";

const intersects = (a: { x: number; y: number; width: number; height: number }, b: typeof a) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const inside = (point: { x: number; y: number }) => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;

function verifyLayout(layout: VenueSceneLayout) {
  expect(layout.stage.width).toBeGreaterThanOrEqual(.45);
  expect(intersects(layout.stage, layout.bar)).toBe(false);
  expect(intersects(layout.stage, layout.merchandise)).toBe(false);
  expect(Object.keys(layout.bandPositions)).toEqual(expect.arrayContaining(["vocalist", "guitar", "bass", "drums"]));
  expect(Object.keys(layout.paths)).toEqual(expect.arrayContaining(["crowdToBar", "barToCrowd", "crowdToMerchandise", "merchandiseToCrowd", "entranceToCrowd", "staffToBar", "staffToMerchandise"]));
  Object.values(layout.paths).flat().forEach((waypoint) => expect(inside(waypoint)).toBe(true));
  layout.decorations.forEach(({ bounds }) => {
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(1); expect(bounds.y + bounds.height).toBeLessThanOrEqual(1);
    expect(intersects(bounds, layout.stage)).toBe(false);
  });
}

describe("venue scene registry", () => {
  it.each([
    ["Pub", "pub"], ["public_house", "pub"], ["Night Club", "club"], ["concert theatre", "theatre"],
    ["sports arena", "arena"], ["Olympic Stadium", "stadium"], ["open-air festival", "festival"], ["seafront stage", "beach"],
  ] as const)("normalises %s", (venueType, expected) => expect(resolveVenueArchetype({ venueType })).toBe(expected));

  it("uses capacity and a reliable club fallback", () => {
    expect(resolveVenueArchetype({ capacity: 60 })).toBe("pub");
    expect(resolveVenueArchetype({ capacity: 30_000 })).toBe("stadium");
    expect(resolveVenueArchetype({ venueType: "mystery" })).toBe("club");
  });

  it("contains three valid structural variations for every archetype", () => {
    for (const layouts of Object.values(VENUE_LAYOUT_REGISTRY)) { expect(layouts).toHaveLength(3); layouts.forEach(verifyLayout); }
  });

  it("is stable for rerenders and resize-independent", () => {
    const input = { gigId: "gig-stable", venueId: "venue-1", venueType: "pub", capacity: 120 };
    expect(generateVenueScene(input)).toEqual(generateVenueScene(input));
  });

  it("uses gig IDs for deterministic variation and venue data when an ID is absent", () => {
    const variations = new Set(Array.from({ length: 30 }, (_, index) => generateVenueScene({ gigId: `gig-${index}`, venueType: "club" }).variation));
    expect(variations.size).toBeGreaterThan(1);
    expect(generateVenueScene({ venueId: "venue-1", venueName: "The Cellar", venueType: "club" })).toEqual(generateVenueScene({ venueId: "venue-1", venueName: "The Cellar", venueType: "club" }));
  });
});
