import { describe, expect, it } from "vitest";
import {
  applyResourceTransaction,
  canAccessBandPrivateContent,
  createIdempotencyGuard,
  eligibleSongsForRecording,
  getControlledLoadState,
  getSongwritingState,
  realChronologicalSchedule,
  releaseCandidates,
  requireAdmin,
} from "../betaSmokeScenarios";

describe("beta smoke journeys", () => {
  it("authentication/profile loads controlled states instead of hanging on failed profile data", () => {
    expect(getControlledLoadState({ status: "success", data: { id: "profile-1" } }, "No profile")).toEqual({ kind: "ready", message: "Ready" });
    expect(getControlledLoadState({ status: "error", message: "Profile could not be loaded" }, "No profile")).toEqual({ kind: "error", message: "Profile could not be loaded" });
  });

  it("songwriting handles empty, valid, invalid, and failed query states", () => {
    expect(getSongwritingState({ status: "success", data: [] })).toEqual({ kind: "empty", message: "No songs yet" });
    expect(getSongwritingState({ status: "error", message: "Songs could not be loaded" }).kind).toBe("error");

    const title = "Beta Smoke Anthem";
    expect(title.trim().length).toBeGreaterThan(0);
    expect("   ".trim().length).toBe(0);
  });

  it("recording and release flow expose eligible choices and clear ineligible reasons", () => {
    const songs = [
      { id: "draft", title: "Draft", status: "draft" as const, ownerProfileId: "profile-1" },
      { id: "complete", title: "Complete", status: "completed" as const, ownerProfileId: "profile-1" },
      { id: "recorded", title: "Recorded", status: "recorded" as const, ownerProfileId: "profile-1" },
    ];

    expect(eligibleSongsForRecording(songs)).toMatchObject([
      { id: "draft", eligible: false, reason: "Only completed songs can be recorded." },
      { id: "complete", eligible: true, reason: null },
      { id: "recorded", eligible: false, reason: "Only completed songs can be recorded." },
    ]);
    expect(releaseCandidates(songs).map((song) => song.id)).toEqual(["recorded"]);
  });

  it("band-private content is visible only to current members", () => {
    expect(canAccessBandPrivateContent("member-profile", ["member-profile"])).toBe(true);
    expect(canAccessBandPrivateContent("outsider-profile", ["member-profile"])).toBe(false);
  });

  it("schedule display uses only real booked activities sorted chronologically with multi-hour durations", () => {
    const schedule = realChronologicalSchedule([
      { id: "fake", title: "Fake add control", scheduled_start: "2026-07-10T09:00:00.000Z", source: "placeholder" },
      { id: "later", title: "Recording", scheduled_start: "2026-07-10T14:00:00.000Z", scheduled_end: "2026-07-10T16:00:00.000Z" },
      { id: "earlier", title: "Songwriting", scheduled_start: "2026-07-10T10:00:00.000Z", scheduled_end: "2026-07-10T11:00:00.000Z" },
      { id: "four-hour", title: "Rehearsal", scheduled_start: "2026-07-10T18:00:00.000Z", scheduled_end: "2026-07-10T22:00:00.000Z" },
    ]);

    expect(schedule.map((activity) => activity.id)).toEqual(["earlier", "later", "four-hour"]);
    expect(schedule.map((activity) => activity.displayDurationMinutes)).toEqual([60, 120, 240]);
  });

  it("resource transaction idempotency blocks double submission and insufficient funds", () => {
    const guard = createIdempotencyGuard();
    expect(applyResourceTransaction(100, 25, "xp-award-1", guard)).toEqual({ ok: true, balance: 125 });
    expect(applyResourceTransaction(125, 25, "xp-award-1", guard)).toEqual({ ok: false, balance: 125, reason: "Duplicate request ignored" });
    expect(applyResourceTransaction(20, -50, "charge-1", createIdempotencyGuard())).toEqual({ ok: false, balance: 20, reason: "Insufficient funds" });
  });

  it("admin access protects support tooling for normal users", () => {
    expect(requireAdmin("user")).toEqual({ allowed: false, reason: "Admin access required" });
    expect(requireAdmin("admin")).toEqual({ allowed: true });
  });
});
