import { describe, expect, it } from "vitest";
import { educationLocalDay } from "./educationLocalDay";
import { visibleEducationActivities } from "./educationActivityVisibility";

describe("character-local education dates", () => {
  const midnight = new Date("2026-10-18T23:30:00Z");
  it("uses the character's city, not the browser's calendar date", () => {
    expect(educationLocalDay(midnight, "Europe/London")).toBe("2026-10-19");
    expect(educationLocalDay(midnight, "America/New_York")).toBe("2026-10-18");
    expect(educationLocalDay(midnight, "Asia/Tokyo")).toBe("2026-10-19");
  });
  it("handles DST transitions without relying on local machine timezone", () => {
    expect(educationLocalDay(new Date("2026-10-25T00:30:00Z"), "Europe/London")).toBe("2026-10-25");
    expect(educationLocalDay(new Date("2026-03-29T23:30:00Z"), "Europe/London")).toBe("2026-03-30");
  });
  it("defaults to UTC for missing or invalid city timezone", () => {
    expect(educationLocalDay(midnight, null)).toBe("2026-10-18");
    expect(educationLocalDay(midnight, "Invalid/City")).toBe("2026-10-18");
  });
});

describe("active learning tier visibility", () => {
  const activities = [
    { id: "basic", book: { skill: "guitar" } },
    { id: "mastery", book: { skill: "guitar_mastery" } },
    { id: "orphan", book: null },
    { id: "unverified", book: { skill: "hidden_professional_skill" } },
  ];
  const getSlug = (activity: (typeof activities)[number]) => activity.book?.skill;
  it("does not leak a legacy Mastery book, course or orphaned activity title", () => {
    const access = new Map([["guitar", true], ["guitar_mastery", false]]);
    expect(visibleEducationActivities(activities, getSlug, access).map((a) => a.id)).toEqual(["basic"]);
  });
  it("reveals mastery resources as soon as eligibility is confirmed", () => {
    const access = new Map([["guitar", true], ["guitar_mastery", true]]);
    expect(visibleEducationActivities(activities, getSlug, access).map((a) => a.id)).toEqual(["basic", "mastery"]);
  });
  it("fails closed before access data loads or after the request fails", () => {
    expect(visibleEducationActivities(activities, getSlug, new Map())).toEqual([]);
  });
});

import { calculateEducationVideoCooldown } from "./educationVideoCooldown";

describe("PooTube persisted claim cooldown", () => {
  const now = Date.parse("2026-10-18T20:00:00Z");
  it("shows the two claims stored on the server, even after switching devices", () => {
    const status = calculateEducationVideoCooldown(["2026-10-18T19:30:00Z", "2026-10-18T19:40:00Z"], now);
    expect(status.videosWatched).toBe(2);
    expect(status.canWatch).toBe(false);
    expect(status.cooldownEndsAt?.toISOString()).toBe("2026-10-18T21:30:00.000Z");
  });
  it("reopens a slot precisely at the two-hour rolling boundary", () => {
    const status = calculateEducationVideoCooldown(["2026-10-18T18:00:00Z", "2026-10-18T19:20:00Z"], now);
    expect(status.videosWatched).toBe(1);
    expect(status.canWatch).toBe(true);
  });
});
