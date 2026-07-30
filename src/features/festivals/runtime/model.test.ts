// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assertAudienceConservation, runtimeTransitionTargets } from "./model";

describe("festival edition runtime domain", () => {
  it("keeps terminal states terminal and constrains recovery", () => {
    expect(runtimeTransitionTargets.completed).toEqual([]);
    expect(runtimeTransitionTargets.recovery_required).toEqual(["paused", "live", "aborted"]);
  });
  it("enforces attendance conservation and capacity", () => {
    const base = { attendance: { expected: 100, admitted: 80, onsite: 65, departed: 15, capacity: 90 } } as any;
    expect(assertAudienceConservation(base)).toBe(true);
    expect(assertAudienceConservation({ attendance: { ...base.attendance, onsite: 91 } } as any)).toBe(false);
  });
});
