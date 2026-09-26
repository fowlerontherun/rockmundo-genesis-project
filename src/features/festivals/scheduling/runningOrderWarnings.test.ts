import { describe, expect, it } from "vitest";
import { getRunningOrderWarnings, previewRunningOrderMove } from "./runningOrderWarnings";
import type { FestivalScheduleItem } from "./model";

const slot = (id: string, start: string, duration: number, changeover = 15): FestivalScheduleItem => ({
  id, festival_id: "festival", edition_id: "edition", item_type: "performance_slot",
  title: id, duration_minutes: duration, changeover_minutes: changeover,
  starts_at: start, ends_at: new Date(Date.parse(start) + duration * 60000).toISOString(),
  stage_id: "stage", festival_date: "2030-06-01", version: 1,
});
const first = slot("first", "2030-06-01T17:00:00Z", 45, 20);
const second = slot("second", "2030-06-01T18:00:00Z", 60, 10);
const third = slot("third", "2030-06-01T19:30:00Z", 30);

describe("festival running order preview", () => {
  it("moves a slot earlier and recalculates starts and ends using each preceding changeover", () => {
    const result = previewRunningOrderMove([first, second, third], "second", -1);
    expect(result?.map(item => item.id)).toEqual(["second", "first", "third"]);
    expect(result?.map(item => [item.startsAt, item.endsAt])).toEqual([
      ["2030-06-01T17:00:00.000Z", "2030-06-01T18:00:00.000Z"],
      ["2030-06-01T18:10:00.000Z", "2030-06-01T18:55:00.000Z"],
      ["2030-06-01T19:15:00.000Z", "2030-06-01T19:45:00.000Z"],
    ]);
    expect(first.starts_at).toBe("2030-06-01T17:00:00Z");
  });
  it("rejects moving outside the stage and locked acts", () => {
    expect(previewRunningOrderMove([first, second], "first", -1)).toBeNull();
    expect(previewRunningOrderMove([{...first, locked:true}, second], "second", -1)).toBeNull();
  });
  it("rejects invalid duration and unscheduled acts", () => {
    expect(previewRunningOrderMove([first, {...second, duration_minutes:0}], "second", -1)).toBeNull();
    expect(previewRunningOrderMove([first, {...second, starts_at:null}], "second", -1)).toBeNull();
  });
  it("warns about overlaps and short changeovers", () => {
    const overlap = slot("overlap", "2030-06-01T17:40:00Z", 30);
    expect(getRunningOrderWarnings([first, overlap])[0].warning).toMatch(/Overlaps next act by 5 min/);
    expect(getRunningOrderWarnings([first, second])[0].warning).toBeNull();
    const shortGap = slot("short", "2030-06-01T17:55:00Z", 30);
    expect(getRunningOrderWarnings([first, shortGap])[0].warning).toMatch(/Only 10 min/);
  });
});
