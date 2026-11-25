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
    expect(read([original], "2026-11-19", stage, [{ ...lineup[0], festivalDate: "2026-11-20" }]))
      .toEqual([expect.objectContaining({ artistName: null })]);
    expect(read([{ ...original, stageName: "Other Stage" }])).toEqual([]);
    expect(read([{ ...original, stageId: "123e4567-e89b-42d3-a456-426614174099" }])).toEqual([]);
    expect(read([{ ...original, kind: "incident", message: "Secret security report" }])).toEqual([]);
  });

  it("rejects stale, future, other-day and forged replay events", () => {
    expect(read([{ ...original, observedAt: "2026-11-18T18:00:00.000Z" }])).toEqual([]);
    expect(read([{ ...original, observedAt: "2026-11-19T19:02:00.000Z" }])).toEqual([]);
    expect(read([{ ...original, id: "forged" }])).toEqual([]);
    expect(read([{ ...original, status: "settled" }])).toEqual([]);
    expect(read([{ ...original, observedAt: "2026-11-19T18:50:00" }])).toEqual([]);
    expect(read([{ ...original, observedAt: "2026-11-19" }])).toEqual([]);
    expect(read([original], "2026-11-20")).toEqual([]);
    expect(read([original], "", stage)).toEqual([]);
  });

  it("uses the festival-local day for explicitly offset provider observations", () => {
    expect(read([{ ...original, observedAt: "2026-11-19T19:50:00+01:00" }])).toHaveLength(1);
    expect(read([{ ...original, observedAt: "2026-11-20T00:50:00+06:00" }])).toHaveLength(1);
  });

  it("keeps multi-stage announcements isolated as an edition advances through three local days", () => {
    const otherStageId = "123e4567-e89b-42d3-a456-426614174003";
    const otherItemId = "123e4567-e89b-42d3-a456-426614174004";
    const otherEventId = "123e4567-e89b-42d3-a456-426614174005";
    const stages = [...stage, { id: otherStageId, name: "Second Stage", capacity: 300 }];
    const acts = [...lineup, { ...lineup[0], id: otherItemId, artistName: "Second Artist", stageName: "Second Stage" }];
    const secondStage = { ...original, id: otherEventId, stageId: otherStageId,
      stageName: "Second Stage", scheduleItemId: otherItemId };
    const dayOne = { ...original, observedAt: "2026-11-18T18:50:00Z" };
    const dayThree = { ...secondStage, observedAt: "2026-11-20T18:50:00Z" };
    expect(readPublicFestivalActivityFeed([dayOne, original, secondStage, dayThree], stages, acts,
      "2026-11-19", "Europe/London", now)).toEqual(expect.arrayContaining([
      expect.objectContaining({ stageId, artistName: "Published Act" }),
      expect.objectContaining({ stageId: otherStageId, artistName: "Second Artist" }),
    ]));
    // Even a matching display name cannot disguise an event from an
    // unpublished stage (or attach one stage's slot to another stage).
    expect(readPublicFestivalActivityFeed([{ ...secondStage, scheduleItemId }], stages, acts,
      "2026-11-19", "Europe/London", now)).toEqual([
      expect.objectContaining({ stageId: otherStageId, artistName: null }),
    ]);
    expect(readPublicFestivalActivityFeed([secondStage], stage, acts,
      "2026-11-19", "Europe/London", now)).toEqual([]);
  });

  it("accepts both repeated London clock-change hours without crossing a festival-day boundary", () => {
    const before = "2026-10-25T00:30:00Z"; // 01:30 BST
    const after = "2026-10-25T01:30:00Z"; // 01:30 GMT
    const events = [{ ...original, observedAt: before },
      { ...original, id: "123e4567-e89b-42d3-a456-426614174006", observedAt: after }];
    const result = readPublicFestivalActivityFeed(events, stage, [{ ...lineup[0], festivalDate: "2026-10-25" }],
      "2026-10-25", "Europe/London", Date.parse("2026-10-25T01:35:00Z"));
    expect(result).toHaveLength(2);
    expect(result.map((item) => item.observedAt)).toEqual([after, before]);
    expect(readPublicFestivalActivityFeed(events, stage, lineup, "2026-10-26", "Europe/London",
      Date.parse("2026-10-26T01:35:00Z"))).toEqual([]);
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
