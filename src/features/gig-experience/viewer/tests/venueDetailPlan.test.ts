import { afterEach, describe, expect, it, vi } from "vitest";
import { drawFloor } from "../engine/StageDecor";
import { buildVenueDetailPlan } from "../engine/VenueDetailPlan";
import { scaleVenuePreset, selectVenuePreset, type FloorPattern } from "../engine/VenueLayout";
import { generateVenueScene, type VenueArchetype } from "../engine/VenueSceneRegistry";

const build = (gigId: string, venueType: VenueArchetype, floorPattern: FloorPattern) => {
  const scene = generateVenueScene({ gigId, venueType, capacity: venueType === "stadium" ? 30_000 : 500 });
  return buildVenueDetailPlan({ scene, floorPattern });
};

afterEach(() => vi.restoreAllMocks());

describe("deterministic venue detail plan", () => {
  it("keeps floor and service detail stable for the same gig", () => {
    expect(build("gig-stable", "festival", "grass")).toEqual(build("gig-stable", "festival", "grass"));
  });

  it("keeps generated detail bounded inside its owning surface", () => {
    const plan = build("gig-bounds", "stadium", "concrete");
    expect(plan.floorMarks).toHaveLength(76);
    plan.floorMarks.forEach((mark) => {
      expect(mark.x).toBeGreaterThanOrEqual(0);
      expect(mark.x).toBeLessThanOrEqual(1);
      expect(mark.y).toBeGreaterThanOrEqual(0);
      expect(mark.y).toBeLessThanOrEqual(1);
      expect(mark.width).toBeGreaterThan(0);
      expect(mark.height).toBeGreaterThan(0);
    });
    Object.values(plan.services).flatMap((service) => service.stock).forEach((stock) => {
      expect(stock.x).toBeGreaterThanOrEqual(0);
      expect(stock.x).toBeLessThanOrEqual(1);
      expect(stock.y).toBeGreaterThanOrEqual(0);
      expect(stock.y).toBeLessThanOrEqual(1);
    });
  });

  it("varies cosmetic stock and material placement between gigs", () => {
    const first = build("gig-one", "club", "concrete");
    const second = build("gig-two", "club", "concrete");
    expect(first.floorMarks).not.toEqual(second.floorMarks);
    expect(first.services.bar.stock).not.toEqual(second.services.bar.stock);
  });

  it.each([
    ["pub", "wood", false],
    ["club", "neon", false],
    ["theatre", "heritage", false],
    ["arena", "concourse", false],
    ["stadium", "concourse", false],
    ["festival", "outdoor", true],
    ["beach", "outdoor", true],
  ] as const)("uses the %s service fixture theme", (archetype, theme, canopy) => {
    const plan = build(`gig-${archetype}`, archetype, archetype === "festival" || archetype === "beach" ? "grass" : "concrete");
    expect(plan.services.bar).toMatchObject({ theme, canopy });
    expect(plan.services.merchandise).toMatchObject({ theme, canopy });
  });

  it("draws textured floors without runtime randomness", () => {
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("frame-local randomness is not allowed");
    });
    const scene = generateVenueScene({ gigId: "gig-render", venueType: "festival", capacity: 5_000 });
    const preset = scaleVenuePreset(selectVenuePreset({ venueType: "festival", capacity: 5_000 }), { width: 800, height: 450 });
    const plan = buildVenueDetailPlan({ scene, floorPattern: preset.decorations.floorPattern });
    const gradient = { addColorStop: vi.fn() } as unknown as CanvasGradient;
    const ctx = {
      beginPath: vi.fn(),
      clip: vi.fn(),
      createLinearGradient: vi.fn(() => gradient),
      fillRect: vi.fn(),
      rect: vi.fn(),
      restore: vi.fn(),
      save: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    expect(() => drawFloor(ctx, preset, plan.floorMarks)).not.toThrow();
    expect(random).not.toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});
