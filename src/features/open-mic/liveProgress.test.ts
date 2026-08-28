import { describe, expect, it } from "vitest";
import {
  getOpenMicSongDurationMs,
  getOpenMicSongProgress,
  getOpenMicSongRemainingMs,
  getOpenMicSongStartedAtMs,
} from "./liveProgress";

describe("Open Mic live progress", () => {
  it("caps simulated songs at one minute", () => {
    expect(getOpenMicSongDurationMs(240)).toBe(60_000);
    expect(getOpenMicSongDurationMs(45)).toBe(45_000);
  });

  it("resumes song one from the persisted performance start", () => {
    expect(
      getOpenMicSongStartedAtMs(1, "2026-08-28T09:00:00.000Z", []),
    ).toBe(Date.parse("2026-08-28T09:00:00.000Z"));
  });

  it("resumes song two from the persisted first-song result", () => {
    expect(
      getOpenMicSongStartedAtMs(2, "2026-08-28T09:00:00.000Z", [
        { position: 1, created_at: "2026-08-28T09:01:00.000Z" },
      ]),
    ).toBe(Date.parse("2026-08-28T09:01:00.000Z"));
  });

  it("finishes immediately after a reload when the persisted timer has elapsed", () => {
    const startedAt = Date.parse("2026-08-28T09:00:00.000Z");
    const now = Date.parse("2026-08-28T09:05:00.000Z");

    expect(getOpenMicSongProgress(now, startedAt, 60_000)).toBe(100);
    expect(getOpenMicSongRemainingMs(now, startedAt, 60_000)).toBe(0);
  });

  it("keeps partial progress across a remount", () => {
    const startedAt = Date.parse("2026-08-28T09:00:00.000Z");
    const now = Date.parse("2026-08-28T09:00:15.000Z");

    expect(getOpenMicSongProgress(now, startedAt, 60_000)).toBe(25);
    expect(getOpenMicSongRemainingMs(now, startedAt, 60_000)).toBe(45_000);
  });
});
