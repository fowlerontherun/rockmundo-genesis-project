import { describe, expect, it } from "vitest";
import { festivalLiveSnapshotFreshness } from "../domain/festivalLiveSnapshotFreshness";

const now = Date.parse("2026-10-29T12:00:00Z");
const snapshot = {
  runtimeStatus: "live",
  currentDay: "2026-10-29",
  updatedAt: "2026-10-29T11:55:00Z",
};

describe("canonical festival live snapshot freshness", () => {
  it("permits a recently updated active-day observation", () => {
    expect(festivalLiveSnapshotFreshness(snapshot, now)).toBe("current");
  });
  it("fails closed on stale or future timestamps after reconnect", () => {
    expect(festivalLiveSnapshotFreshness({ ...snapshot, updatedAt: "2026-10-29T10:00:00Z" }, now)).toBe("stale");
    expect(festivalLiveSnapshotFreshness({ ...snapshot, updatedAt: "2026-10-29T12:03:00Z" }, now)).toBe("stale");
  });
  it("rejects missing/malformed timestamps and records", () => {
    expect(festivalLiveSnapshotFreshness({ ...snapshot, updatedAt: null }, now)).toBe("unavailable");
    expect(festivalLiveSnapshotFreshness({ ...snapshot, updatedAt: "bad" }, now)).toBe("stale");
    expect(festivalLiveSnapshotFreshness(null, now)).toBe("unavailable");
  });
  it("does not brand archived completed festivals as stale current activity", () => {
    expect(festivalLiveSnapshotFreshness({
      ...snapshot, runtimeStatus: "runtime_complete", currentDay: null, updatedAt: "2026-09-01T10:00:00Z",
    }, now)).toBe("inactive");
  });
  it("treats stopped gates as historical rather than live crowd information", () => {
    expect(festivalLiveSnapshotFreshness({ ...snapshot, runtimeStatus: "ready_to_open", currentDay: null }, now)).toBe("inactive");
  });
});
