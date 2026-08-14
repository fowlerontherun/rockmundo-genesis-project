import { describe, expect, it } from "vitest";
import { attendanceForPresentation, resolveNumericMetric } from "../engine/AuthoritativeMetric";
import { representativeCrowdCount } from "../engine/RepresentativeCrowd";

describe("authoritative attendance presentation", () => {
  it("distinguishes zero, missing, and invalid metrics", () => {
    expect(resolveNumericMetric({ status: "available", value: 0 })).toEqual({ state: "available", value: 0 });
    expect(resolveNumericMetric(undefined)).toEqual({ state: "missing" });
    expect(resolveNumericMetric({ status: "available", value: "0" })).toEqual({ state: "invalid" });
  });

  it("preserves zero and only falls back when attendance is unavailable", () => {
    const capacity = { status: "available", value: 1_000 };
    expect(attendanceForPresentation({ status: "available", value: 0 }, capacity)).toBe(0);
    expect(attendanceForPresentation(undefined, capacity)).toBe(1_000);
    expect(attendanceForPresentation({ status: "available", value: "bad" }, capacity)).toBeUndefined();
    expect(attendanceForPresentation({ status: "available", value: 400 }, capacity)).toBe(400);
    expect(attendanceForPresentation(undefined, { status: "available", value: 0 })).toBe(0);
  });

  it("renders no representative fans for an authoritative empty gig", () => {
    expect(representativeCrowdCount({ attendance: 0, capacity: 1_000, archetype: "club" })).toBe(0);
    expect(representativeCrowdCount({ attendance: 400, capacity: 1_000, archetype: "club" })).toBeGreaterThan(0);
  });
});
