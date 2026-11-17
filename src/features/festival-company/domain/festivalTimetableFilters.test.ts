import { describe, expect, it } from "vitest";
import type { FestivalPublicConfirmedAct } from "./festivalLaunch";
import { festivalTimetableOptions, filterPublishedFestivalTimetable } from "./festivalTimetableFilters";

const set = (id: string, festivalDate: string): FestivalPublicConfirmedAct => ({
  id, artistName: "The Artists", artistType: "band", genre: null,
  billingPosition: "support", festivalDate, stageName: "Main Stage",
  startsAt: "2026-11-10T10:00:00Z", endsAt: "2026-11-10T11:00:00Z",
});

describe("festival timetable date and stage choices", () => {
  it("never offers impossible calendar dates as filters even alongside valid dates", () => {
    const choices = festivalTimetableOptions([set("ok", "2026-11-10"), set("bad", "2026-02-30")]);
    expect(choices.days).toEqual(["2026-11-10"]);
  });

  it("keeps real overlapping slots but excludes malformed time intervals", () => {
    const good = set("good", "2026-11-10");
    const malformed = { ...set("bad", "2026-11-10"), endsAt: "2026-11-10T09:00:00Z" };
    expect(filterPublishedFestivalTimetable([malformed, good], {
      stageName: "", festivalDate: "", upcomingOnly: false,
    }, Date.parse("2026-11-10T09:30:00Z"))).toEqual([good]);
  });
});
