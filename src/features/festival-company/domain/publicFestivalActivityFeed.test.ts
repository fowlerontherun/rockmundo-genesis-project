import { describe, expect, it } from "vitest";
import { readPublicFestivalActivityFeed } from "./publicFestivalActivityFeed";

const stageId = "123e4567-e89b-42d3-a456-426614174000";
const scheduleItemId = "123e4567-e89b-42d3-a456-426614174001";
const eventId = "123e4567-e89b-42d3-a456-426614174002";
const now = Date.parse("2026-11-19T19:00:00.000Z");
const stage = [{ id: stageId, name: "Main Stage", capacity: 2000 }];
const lineup = [{ id: scheduleItemId, artistName: "Published Act", artistType: "band" as const, genre: null,
  billingPosition: "headliner", festivalDate: "2026-11-19", stageName: "Main Stage", startsAt: null, endsAt: null }];
const original = { id: eventId, kind: "stage", status: "live", stageId, stageName: "Main Stage", scheduleItemId,
  observedAt: "2026-11-19T18:50:00.000Z", message: "Untrusted private operations note", exactCrowd: 1200 };

const read = (events: unknown, date = "2026-11-19", stages = stage, acts = lineup) =>
  readPublicFestivalActivityFeed(events, stages, acts, date, "Europe/London", now);

describe("canonical public festival activity feed", () => {
  it("keeps one stable official event on duplicate polls and discards untrusted fields", () => {
    expect(read([original, original])).toEqual([{
      id: eventId, status: "live", stageId, stageName: "Main Stage", scheduleItemId,
      observedAt: original.observedAt, artistName: "Published Act",
    }]);
  });

  it("does not reveal unpublished artist names, raw payloads or mismatched stages", () => {
    expect(read([original], "2026-11-19", stage, [])).toEqual([expect.objectContaining({ artistName: null })]);
    expect(read([{ ...original, stageName: "Other Stage" }])).toEqual([]);
    expect(read([{ ...original, stageId: "123e4567-e89b-42d3-a456-426614174099" }])).toEqual([]);
    expect(read([{ ...original, kind: "incident", message: "Secret security report" }])).toEqual([]);
  });

  it("rejects stale, future, other-day and forged replay events", () => {
    expect(read([{ ...original, observedAt: "2026-11-18T18:00:00.000Z" }])).toEqual([]);
    expect(read([{ ...original, observedAt: "2026-11-19T19:02:00.000Z" }])).toEqual([]);
    expect(read([{ ...original, id: "forged" }])).toEqual([]);
    expect(read([{ ...original, status: "settled" }])).toEqual([]);
    expect(read([original], "2026-11-20")).toEqual([]);
    expect(read([original], "", stage)).toEqual([]);
  });

  it("sorts replayed events by source time and caps the rendering budget", () => {
    const messages = Array.from({ length: 30 }, (_, index) => ({ ...original,
      id: `123e4567-e89b-42d3-a456-${(426614174000 + index).toString().padStart(12, "0")}`,
      observedAt: new Date(now - (30 - index) * 30_000).toISOString(),
    }));
    const events = read(messages.reverse());
    expect(events).toHaveLength(20);
    expect(events[0].observedAt).toBe("2026-11-19T18:59:30.000Z");
  });
});
