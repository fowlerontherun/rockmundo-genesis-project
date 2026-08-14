import { describe, expect, it } from "vitest";
import { resolveNumericMetric, resolvePresentationAttendance } from "../engine/AuthoritativeMetric";
import { representativeCrowdCount } from "../engine/RepresentativeCrowd";

const metric = (value: unknown) => ({ status: "available", value });

describe("authoritative attendance presentation", () => {
  it("classifies numeric metrics without losing zero", () => {
    expect(resolveNumericMetric(metric(0))).toEqual({ state: "available", value: 0 });
    expect(resolveNumericMetric(undefined)).toEqual({ state: "missing" });
    expect(resolveNumericMetric(metric("bad"))).toEqual({ state: "invalid" });
  });

  it.each([
    ["zero", metric(0), undefined, metric(1000), { state: "valid", source: "headline", value: 0 }],
    ["positive", metric(400), 900, metric(1000), { state: "valid", source: "headline", value: 400 }],
    ["replay fallback", undefined, 350, metric(1000), { state: "valid", source: "replay", value: 350 }],
    ["invalid headline with valid replay", metric("bad"), 350, metric(1000), { state: "valid", source: "replay", value: 350 }],
    ["zero replay", undefined, 0, metric(1000), { state: "valid", source: "replay", value: 0 }],
    ["missing headline with invalid replay", undefined, "bad", metric(1000), { state: "invalid", source: "none", value: 0 }],
    ["capacity fallback", undefined, undefined, metric(1000), { state: "valid", source: "capacity", value: 1000 }],
    ["invalid capacity", undefined, undefined, metric("bad"), { state: "invalid", source: "none", value: 0 }],
    ["missing", undefined, undefined, undefined, { state: "missing", source: "none", value: 0 }],
    ["invalid string", metric("bad"), undefined, metric(1000), { state: "invalid", source: "none", value: 0 }],
    ["negative", metric(-1), undefined, metric(1000), { state: "invalid", source: "none", value: 0 }],
    ["NaN", metric(Number.NaN), undefined, metric(1000), { state: "invalid", source: "none", value: 0 }],
  ])("resolves %s", (_name, headline, replay, capacity, expected) => {
    expect(resolvePresentationAttendance(headline, replay, capacity)).toEqual(expected);
  });

  it("invalid-with-capacity fails closed to zero representative fans", () => {
    const resolution = resolvePresentationAttendance(metric("bad"), undefined, metric(1000));
    expect(representativeCrowdCount({ attendance: resolution.value, capacity: null, archetype: "club" })).toBe(0);
  });
});
