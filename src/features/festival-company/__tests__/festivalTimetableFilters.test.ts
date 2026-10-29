import { describe, expect, it } from "vitest";
import type { FestivalPublicConfirmedAct } from "../domain/festivalLaunch";
import {
  festivalTimetableOptions,
  filterPublishedFestivalTimetable,
  publishedStageOverlapIds,
} from "../domain/festivalTimetableFilters";

const make = (
  id: string,
  stageName: string,
  startsAt: string,
  endsAt: string,
  festivalDate = "2026-10-29",
): FestivalPublicConfirmedAct => ({
  id, artistName: id, artistType: "band", genre: null,
  billingPosition: "support", festivalDate, stageName, startsAt, endsAt,
});
const now = Date.parse("2026-10-29T18:00:00Z");
const first = make("first", "Main Stage", "2026-10-29T17:00:00Z", "2026-10-29T18:30:00Z");
const overlapping = make("overlap", " main stage ", "2026-10-29T18:00:00Z", "2026-10-29T19:00:00Z");
const otherStage = make("other", "Acoustic", "2026-10-29T18:00:00Z", "2026-10-29T19:00:00Z");
const tomorrow = make("tomorrow", "Acoustic", "2026-10-30T16:00:00Z", "2026-10-30T17:00:00Z", "2026-10-30");
const past = make("past", "Main Stage", "2026-10-29T15:00:00Z", "2026-10-29T16:00:00Z");
const all = [tomorrow, otherStage, first, overlapping, past];

describe("festival public timetable filters", () => {
  it("sorts stages and festival dates, keeping distinct public options", () => {
    expect(festivalTimetableOptions([first, otherStage, tomorrow])).toEqual({
      stages: ["Acoustic", "Main Stage"],
      days: ["2026-10-29", "2026-10-30"],
    });
  });

  it("filters by stage, day and upcoming without mutating canonical lineup", () => {
    const filtered = filterPublishedFestivalTimetable(
      all, { stageName: "Main Stage", festivalDate: "2026-10-29", upcomingOnly: true }, now,
    );
    expect(filtered.map((act) => act.id)).toEqual(["first", "overlap"]);
    expect(all[0].id).toBe("tomorrow");
  });

  it("detects real same-stage overlaps but not simultaneous sets on different stages", () => {
    const ids = publishedStageOverlapIds([first, overlapping, otherStage]);
    expect([...ids].sort()).toEqual(["first", "overlap"]);
  });

  it("ignores touching slot endpoints, invalid windows and unpublished dates", () => {
    const touching = make("touch", "Main Stage", "2026-10-29T18:30:00Z", "2026-10-29T19:00:00Z");
    const invalid = make("invalid", "Main Stage", "bad", "2026-10-29T20:00:00Z");
    const ids = publishedStageOverlapIds([first, touching, invalid]);
    expect(ids.size).toBe(0);
    expect(filterPublishedFestivalTimetable([invalid, touching], {stageName: "", festivalDate: "", upcomingOnly: false}, now)
      .map((act) => act.id)).toEqual(["touch"]);
  });

  it("filters dates and excludes only finished sets, not scheduled-current", () => {
    const filtered = filterPublishedFestivalTimetable(
      all, { stageName: "", festivalDate: "2026-10-29", upcomingOnly: true }, now,
    );
    expect(filtered.map((act) => act.id)).toEqual(["first", "other", "overlap"]);
    expect(filtered.some((act) => act.id === "past")).toBe(false);
  });
});
