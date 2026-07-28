// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getBattleNewsDateRanges } from "./battleNewsDates";

describe("getBattleNewsDateRanges", () => {
  it("builds complete local-day ranges for today and yesterday", () => {
    expect(getBattleNewsDateRanges(new Date(2026, 6, 28, 12, 30))).toEqual({
      today: "2026-07-28", todayStart: "2026-07-28T00:00:00", todayEnd: "2026-07-28T23:59:59.999",
      yesterdayStart: "2026-07-27T00:00:00", yesterdayEnd: "2026-07-27T23:59:59.999",
    });
  });

  it("crosses month boundaries correctly", () => {
    expect(getBattleNewsDateRanges(new Date(2026, 7, 1, 8)).yesterdayStart).toBe("2026-07-31T00:00:00");
  });
});
