import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { activityOverlapsWindow, mobileLocalDateKey } from "./useMobileDaySchedule";

const source = readFileSync("src/mobile/hooks/useMobileDaySchedule.ts", "utf8");

describe("mobile day schedule", () => {
  it("keys the visible day from local calendar components", () => {
    expect(mobileLocalDateKey(new Date(2026, 7, 21, 0, 30))).toBe("2026-08-21");
  });

  it("includes activities that started before midnight but are still running", () => {
    const start = new Date("2026-08-21T00:00:00.000Z");
    const end = new Date("2026-08-22T00:00:00.000Z");
    expect(activityOverlapsWindow("2026-08-20T23:30:00.000Z", "2026-08-21T01:00:00.000Z", start, end)).toBe(true);
    expect(activityOverlapsWindow("2026-08-20T22:00:00.000Z", "2026-08-20T23:00:00.000Z", start, end)).toBe(false);
  });

  it("queries schedule rows by overlap rather than only by start time", () => {
    expect(source).toContain('.lt("scheduled_start", dayEndIso)');
    expect(source).toContain('.gt("scheduled_end", dayStartIso)');
    expect(source).toContain('.lt("departure_date", dayEndIso)');
    expect(source).toContain('.gt("arrival_date", dayStartIso)');
  });

  it("scopes recording sessions to the active character, legacy unscoped rows and current bands", () => {
    expect(source).toContain('.eq("profile_id", profileId)');
    expect(source).toContain('.is("profile_id", null)');
    expect(source).toContain('.in("band_id", bandIds)');
    expect(source).toContain("recordingMap");
  });

  it("surfaces partial source failures instead of silently presenting an empty day", () => {
    expect(source).toContain("warnings.push");
    expect(source).toContain("coreScheduleAvailable");
    expect(source).toContain("core schedule");
  });
});
