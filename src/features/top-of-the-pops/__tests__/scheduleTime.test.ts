import { describe, expect, it } from "vitest";
import { londonTimeOfDay, londonWallClockToIso } from "../scheduleTime";

describe("Top of the Pops London schedule time helpers", () => {
  it("converts BST broadcast times to the correct UTC instant", () => {
    expect(londonWallClockToIso("2026-10-01", "19:30")).toBe("2026-10-01T18:30:00.000Z");
    expect(londonTimeOfDay("2026-10-01T18:30:00.000Z")).toBe("19:30");
  });

  it("converts GMT broadcast times without a DST offset", () => {
    expect(londonWallClockToIso("2026-11-12", "19:30")).toBe("2026-11-12T19:30:00.000Z");
    expect(londonTimeOfDay("2026-11-12T19:30:00.000Z")).toBe("19:30");
  });
});
