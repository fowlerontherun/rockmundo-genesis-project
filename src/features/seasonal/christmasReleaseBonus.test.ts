import { describe, expect, it } from "vitest";
import { FESTIVE_RELEASE_XP, isFestiveReleaseWindow, isFestiveTitle } from "./christmasReleaseBonus";

describe("festive release bonus", () => {
  it("matches christmas, xmas and snow in any case", () => {
    expect(isFestiveTitle("All I Want For CHRISTMAS")).toBe(true);
    expect(isFestiveTitle("Xmas Eve")).toBe(true);
    expect(isFestiveTitle("Snowfall")).toBe(true);
    expect(isFestiveTitle("Summer Nights")).toBe(false);
  });
  it("pays 250 XP", () => expect(FESTIVE_RELEASE_XP).toBe(250));
  it("is open in real December and in-game December only", () => {
    expect(isFestiveReleaseWindow(new Date("2026-12-10T12:00:00Z"))).toBe(true);
    expect(isFestiveReleaseWindow(new Date("2026-04-25T12:00:00Z"))).toBe(true); // game day 114 of year 1
    expect(isFestiveReleaseWindow(new Date("2026-11-20T12:00:00Z"))).toBe(false);
  });
});
