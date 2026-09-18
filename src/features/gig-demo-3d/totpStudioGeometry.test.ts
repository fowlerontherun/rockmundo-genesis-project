import { describe, expect, it } from "vitest";
import { resolveVenueProfile } from "./venueProfile";
import {
  resolveTotpStudioStageGeometry,
  totpStudioDeckContains,
  totpStudioSafeContains,
  totpStudioStageCenter,
} from "./totpStudioGeometry";

describe("Top of the Pops shared studio geometry", () => {
  const venue = resolveVenueProfile({ type: "tv_studio", seed: 42 });

  it("has one authoritative centre for every performance zone", () => {
    expect(totpStudioStageCenter("main_stage", venue)).toEqual([0, 1.35, -2.75]);
    expect(totpStudioStageCenter("stage_b", venue)).toEqual([5.4, 1.15, 2.05]);
    expect(totpStudioStageCenter("rock_stage", venue)).toEqual([-4.5, 1.25, 4.05]);
    expect(totpStudioStageCenter("studio_floor", venue)).toEqual([1.4, 1.05, 5.65]);
  });

  it("keeps every performer safe footprint inset from the physical deck", () => {
    for (const stage of ["main_stage", "stage_b", "rock_stage", "studio_floor"] as const) {
      const geometry = resolveTotpStudioStageGeometry(stage, venue);
      expect(geometry.safeWidth).toBeLessThan(geometry.deckWidth);
      expect(geometry.safeDepth).toBeLessThan(geometry.deckDepth);
      expect(geometry.minU).toBeGreaterThan(0);
      expect(geometry.maxU).toBeLessThan(1);
      expect(geometry.minV).toBeGreaterThan(0);
      expect(geometry.maxV).toBeLessThan(1);

      expect(totpStudioDeckContains(stage, venue, geometry.centerX, geometry.centerZ, .2)).toBe(true);
      expect(totpStudioSafeContains(stage, venue, geometry.centerX, geometry.centerZ)).toBe(true);
    }
  });

  it("keeps known scenic structures outside the safe performance rectangle", () => {
    // Stage B backdrop/light wall lives behind the safe actor pocket.
    expect(totpStudioSafeContains("stage_b", venue, 5.4, .38)).toBe(false);

    // Rock Stage amp stacks sit on the outer rear corners.
    expect(totpStudioSafeContains("rock_stage", venue, -6.75, 2.55)).toBe(false);
    expect(totpStudioSafeContains("rock_stage", venue, -2.25, 2.55)).toBe(false);

    // Studio floor audience/production perimeter stays outside the central actor box.
    expect(totpStudioSafeContains("studio_floor", venue, 1.4 + 2.65, 5.65)).toBe(false);
  });
});
