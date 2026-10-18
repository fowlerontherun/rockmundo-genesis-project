import { describe, expect, it } from "vitest";
import { calculateEducationVideoCooldown } from "./educationVideoCooldown";

const now = Date.parse("2026-10-18T20:00:00Z");

describe("PooTube server cooldown", () => {
  it("counts persisted claims", () => {
    const state = calculateEducationVideoCooldown(["2026-10-18T19:30:00Z", "2026-10-18T19:40:00Z"], now);
    expect(state.videosWatched).toBe(2);
    expect(state.canWatch).toBe(false);
    expect(state.cooldownEndsAt?.toISOString()).toBe("2026-10-18T21:30:00.000Z");
  });
  it("frees a slot at exactly two hours", () => {
    const state = calculateEducationVideoCooldown(["2026-10-18T18:00:00Z", "2026-10-18T19:20:00Z"], now);
    expect(state.videosWatched).toBe(1);
    expect(state.canWatch).toBe(true);
  });
  it("ignores invalid and future claims", () => {
    const state = calculateEducationVideoCooldown(["garbage", "2026-10-18T21:30:00Z"], now);
    expect(state.videosWatched).toBe(0);
  });
});
