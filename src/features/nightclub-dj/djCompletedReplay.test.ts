import { describe, expect, it } from "vitest";
import {
  buildDjClubStageFrame, djReplayDurationMs, djReplayEventsThrough, hasVerifiedDjReplay,
  type DjStageBooking, type DjStageMixEvent, type DjStageAudience,
} from "./djClubStageModel";

const booking: DjStageBooking = {
  id: "b1", club_id: "c1", status: "completed",
  starts_at: "2026-10-19T18:00:00Z",
  ends_at: "2026-10-19T19:00:00Z",
};
const receipt: DjStageAudience = { attendance: 0, venue_capacity: 200 };
const event = (event_no: number, kind: string, minute: number): DjStageMixEvent => ({
  event_no, kind, recorded_at: `2026-10-19T18:${String(minute).padStart(2, "0")}:00Z`,
});

describe("completed booked DJ replay integrity", () => {
  it("allows only a completed booking with matching club, audience receipt and loaded mixer data", () => {
    expect(hasVerifiedDjReplay(booking, "c1", receipt, [])).toBe(true);
    expect(hasVerifiedDjReplay(booking, "c2", receipt, [])).toBe(false);
    expect(hasVerifiedDjReplay({ ...booking, status: "missed" }, "c1", receipt, [])).toBe(false);
    expect(hasVerifiedDjReplay({ ...booking, status: "live" }, "c1", receipt, [])).toBe(false);
    expect(hasVerifiedDjReplay(booking, "c1", null, [])).toBe(false);
    expect(hasVerifiedDjReplay(booking, "c1", receipt, undefined)).toBe(false);
    expect(hasVerifiedDjReplay(booking, "c1", receipt, [], true)).toBe(false);
    expect(hasVerifiedDjReplay({ ...booking, ends_at: booking.starts_at }, "c1", receipt, [])).toBe(false);
  });

  it("uses the exact booked interval and rejects a malformed or reversed timeline", () => {
    expect(djReplayDurationMs(booking)).toBe(3_600_000);
    expect(djReplayDurationMs({ ...booking, ends_at: "bad" })).toBe(0);
    expect(djReplayDurationMs({ ...booking, ends_at: "2026-10-19T17:00:00Z" })).toBe(0);
  });

  it("filters accepted evidence by server timestamp, sorts by immutable sequence without mutation", () => {
    const inputs = Object.freeze([event(3, "crossfade", 40), event(1, "deck_play", 5), event(2, "tempo", 15)]);
    const early = djReplayEventsThrough(inputs, Date.parse("2026-10-19T18:10:00Z"));
    expect(early.map(x => x.event_no)).toEqual([1]);
    const middle = djReplayEventsThrough(inputs, Date.parse("2026-10-19T18:20:00Z"));
    expect(middle.map(x => x.event_no)).toEqual([1, 2]);
    const late = djReplayEventsThrough(inputs, Date.parse("2026-10-19T18:41:00Z"));
    expect(late.map(x => x.event_no)).toEqual([1, 2, 3]);
    expect(inputs[0].event_no).toBe(3);
  });

  it("rejects malformed evidence timestamps and nonpositive event IDs", () => {
    expect(djReplayEventsThrough([
      { event_no: 0, kind: "crossfade", recorded_at: "2026-10-19T18:05:00Z" },
      { event_no: 1, kind: "tempo", recorded_at: "invalid" },
    ], Date.parse("2026-10-19T19:00:00Z"))).toEqual([]);
  });

  it("renders settled 0-attendance crowds empty but keeps the historical DJ visible", () => {
    const frame = buildDjClubStageFrame(
      booking, "p1", [], receipt, 200,
      Date.parse("2026-10-19T18:00:00Z"), false, [0, .5, -2], true,
    );
    expect(frame.crowd).toBe(0);
    expect(frame.occupancy).toBe(0);
    expect(frame.performing).toBe(true);
    expect(frame.performers[0].visible).toBe(true);
    expect(frame.effect).toBeNull();
  });

  it("never treats completed performances as live without the explicit verified replay flag", () => {
    const f = buildDjClubStageFrame(
      booking, "p1", [event(1, "crossfade", 40)], receipt,
      100, Date.parse("2026-10-19T18:50:00Z"),
    );
    expect(f.performing).toBe(false);
    expect(f.performers[0].visible).toBe(false);
    expect(f.crowdReaction).toBe("still");
  });

  it("seeking before and after a mix event changes visual reactions deterministically", () => {
    const events = [event(1, "deck_play", 5), event(2, "tempo", 15), event(3, "crossfade", 40)];
    const at = (minute: number) => {
      const time = Date.parse(booking.starts_at) + minute * 60_000;
      return buildDjClubStageFrame(
        booking, "p1", djReplayEventsThrough(events, time), receipt,
        200, time, false, [0, 0, 0], true,
      );
    };
    expect(at(10).crowdReaction).toBe("bounce");
    expect(at(20).crowdReaction).toBe("sway");
    expect(at(45).crowdReaction).toBe("cheer");
    expect(at(10).energy).toBeLessThan(at(45).energy);
    expect(at(45).positionMs).toBe(45 * 60_000);
  });

  it("replay reduced motion remains still even after an energetic crossfade", () => {
    const f = buildDjClubStageFrame(
      booking, "p1", [event(3, "crossfade", 40)], receipt,
      200, Date.parse("2026-10-19T18:45:00Z"), true, [0, 0, 0], true,
    );
    expect(f.crowdReaction).toBe("still");
  });
});
