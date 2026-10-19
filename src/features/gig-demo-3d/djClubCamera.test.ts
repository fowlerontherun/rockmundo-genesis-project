import { describe, expect, it } from "vitest";
import { djClubCameraPose, type DjClubCameraShot } from "./djClubCamera";
import { resolveVenueProfile, stagePosition } from "./venueProfile";

const makeVenue = (capacity: number) => resolveVenueProfile({
  id: "club-1", name: "The Warehouse", bandName: "DJ SET",
  type: "rock_club", archetype: "club", capacity, seed: 153,
});

describe("DJ-only camera framing", () => {
  it.each([120, 600, 2000])("keeps the overhead lens below the indoor roof at capacity %i", capacity => {
    const venue = makeVenue(capacity);
    const booth = stagePosition(venue, .5, .43);
    const pose = djClubCameraPose("dj_overhead", venue, booth, 16 / 9);
    expect(pose.position[1]).toBeLessThanOrEqual(venue.roofHeight - .4);
    expect(pose.position[1]).toBeGreaterThan(booth[1] + 1.5);
    expect(pose.target[1]).toBeGreaterThan(booth[1]);
  });

  it("frames the DJ's actual onstage position in close-up, not generic band centre", () => {
    const venue = makeVenue(200);
    const spot: [number, number, number] = [1.4, venue.stageHeight, -2.2];
    const close = djClubCameraPose("dj_booth", venue, spot, .65);
    expect(close.target[0]).toBe(spot[0]);
    expect(close.position[2]).toBeGreaterThan(close.target[2]);
    expect(close.position.every(Number.isFinite)).toBe(true);
  });

  it("separates booth, floor and reverse viewpoints without faking crowd size", () => {
    const venue = makeVenue(200);
    const booth = stagePosition(venue, .5, .43);
    const shots: DjClubCameraShot[] = ["dj_booth", "dj_overhead", "dj_dancefloor", "dj_reverse"];
    const poses = shots.map(shot => djClubCameraPose(shot, venue, booth, 1.78));
    expect(new Set(poses.map(p => p.position.join(","))).size).toBe(4);
    expect(poses[2].position[2]).toBeGreaterThan(booth[2]);
    expect(poses[3].position[2]).toBeLessThan(booth[2]);
    expect(poses[3].target[2]).toBeGreaterThan(booth[2]);
  });

  it("handles portrait camera aspect and malformed aspect without nonfinite coordinates", () => {
    const venue = makeVenue(500);
    const booth = stagePosition(venue, .5, .43);
    for (const aspect of [0.4, 1, 1.8, Number.NaN]) {
      const close = djClubCameraPose("dj_booth", venue, booth, aspect);
      expect(close.position.every(Number.isFinite)).toBe(true);
      expect(close.target.every(Number.isFinite)).toBe(true);
    }
  });
});
