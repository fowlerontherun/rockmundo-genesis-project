import { describe, expect, it } from "vitest";
import {
  buildFestivalSlotInstants,
  buildFestivalTimelineSlots,
  festivalDateTimeInputToIso,
  formatFestivalDateTimeInput,
  formatFestivalTime,
  itemStartsInTimelineSlot,
} from "./time";
import type { FestivalScheduleItem, FestivalStageOperatingHours } from "./model";

const overnightHours: FestivalStageOperatingHours = {
  stage_id: "main-stage",
  festival_date: "2030-06-01",
  opens_at: "2030-06-01T11:00:00.000Z",
  curfew_at: "2030-06-02T01:00:00.000Z",
};

const overnightItem: FestivalScheduleItem = {
  id: "slot-1",
  festival_id: "festival-1",
  edition_id: "edition-1",
  stage_id: "main-stage",
  festival_date: "2030-06-01",
  item_type: "performance_slot",
  starts_at: "2030-06-02T00:00:00.000Z",
  ends_at: "2030-06-02T01:00:00.000Z",
  duration_minutes: 60,
  title: "After midnight headline",
};

describe("Festival scheduling timezone authority", () => {
  it("formats stored instants in the Festival timezone rather than the browser timezone", () => {
    expect(formatFestivalTime("2030-06-01T18:00:00.000Z", "Europe/London")).toBe("19:00");
    expect(
      formatFestivalDateTimeInput(
        "2030-06-01T18:00:00.000Z",
        "Europe/London",
      ),
    ).toBe("2030-06-01T19:00");
  });

  it("converts Festival-local editor values to UTC for storage", () => {
    expect(
      festivalDateTimeInputToIso("2030-06-01T21:30", "Europe/London"),
    ).toBe("2030-06-01T20:30:00.000Z");
  });

  it("treats an early-morning time as the next calendar day when curfew crosses midnight", () => {
    expect(
      buildFestivalSlotInstants({
        festivalDate: "2030-06-01",
        localStartTime: "01:00",
        durationMinutes: 60,
        timeZone: "Europe/London",
        operatingHours: overnightHours,
      }),
    ).toEqual({
      startsAt: "2030-06-02T00:00:00.000Z",
      endsAt: "2030-06-02T01:00:00.000Z",
    });
  });

  it("builds timeline rows from operating hours and includes after-midnight slots", () => {
    const slots = buildFestivalTimelineSlots({
      festivalDate: "2030-06-01",
      timeZone: "Europe/London",
      operatingHours: [overnightHours],
      items: [overnightItem],
    });

    expect(slots[0]?.label).toBe("12:00");
    expect(slots.map((slot) => slot.label)).toContain("00:00 (+1)");
    const midnightSlot = slots.find((slot) => slot.label === "01:00 (+1)");
    expect(midnightSlot).toBeDefined();
    expect(itemStartsInTimelineSlot(overnightItem, midnightSlot!)).toBe(true);
  });
});
