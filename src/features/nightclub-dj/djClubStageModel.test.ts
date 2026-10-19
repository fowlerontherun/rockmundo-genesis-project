import { describe, expect, it } from "vitest";
import { buildDjClubStageOptions, buildDjClubStageFrame, djStageOccupancy } from "./djClubStageModel";
import type { DjStageMixEvent, DjStageBooking } from "./djClubStageModel";

const profileId = "33333333-3333-4333-8333-333333333333";
const clubId = "44444444-4444-4444-8444-444444444444";
const booking: DjStageBooking = {
  id: "55555555-5555-4555-8555-555555555555",
  status: "live",
  starts_at: "2026-10-20T20:00:00Z",
  ends_at: "2026-10-20T21:00:00Z",
};
const mix = (event_no: number, kind: string): DjStageMixEvent => ({
  event_no, kind, recorded_at: "2026-10-20T20:05:00Z",
});

describe("read-only nightclub 3D booth contract", () => {
  it("uses exactly one real character avatar and existing turntable rig, not a fake band", () => {
    const options = buildDjClubStageOptions(profileId, clubId, "Blue Notes", 120, null);
    expect(options.performers).toHaveLength(1);
    expect(options.performers[0]).toMatchObject({
      id: profileId, role: "dj", instrument: "turntablism",
    });
    expect(options.venue).toMatchObject({ name: "Blue Notes", type: "rock_club", capacity: 120 });
    expect(options.performers[0].position).not.toEqual([0, 0, 0]);
    expect(options.externalClock).toBe(false);
  });

  it("uses a stable venue seed across reloads without requiring a browser clock", () => {
    const first = buildDjClubStageOptions(profileId, clubId, "Blue Notes", 80, null);
    const again = buildDjClubStageOptions(profileId, clubId, "Blue Notes", 80, null);
    expect(again).toEqual(first);
    expect(buildDjClubStageOptions(profileId, "other-club", "Blue Notes", 80, null).venue.seed)
      .not.toBe(first.venue.seed);
  });

  it("does not invent authoritative attendance while a DJ is live", () => {
    expect(djStageOccupancy(null, 200)).toEqual({ occupancy: 0.12, verified: false });
    expect(djStageOccupancy({ attendance: 0, venue_capacity: 100 }, 100))
      .toEqual({ occupancy: 0, verified: true });
  });

  it("always clamps verified crowds to the strictest known official capacity", () => {
    expect(djStageOccupancy({ attendance: 800, venue_capacity: 100 }, 50))
      .toEqual({ occupancy: 1, verified: true });
    expect(djStageOccupancy({ attendance: 25, venue_capacity: 100 }, 50))
      .toEqual({ occupancy: 0.5, verified: true });
    expect(djStageOccupancy({ attendance: -1, venue_capacity: 100 }, 50))
      .toEqual({ occupancy: 0, verified: false });
    expect(djStageOccupancy({ attendance: Number.POSITIVE_INFINITY, venue_capacity: 100 }, 50))
      .toEqual({ occupancy: 0, verified: false });
  });

  it("reflects only server-recorded mixer actions and does not mutate incoming evidence", () => {
    const events = Object.freeze([mix(3, "crossfade"), mix(1, "deck_play"), mix(2, "tempo")]);
    const position = buildDjClubStageOptions(profileId, clubId, "Blue Notes", 100, null)
      .performers[0].position;
    const frame = buildDjClubStageFrame(
      booking, profileId, events, null, 100,
      Date.parse("2026-10-20T20:15:00Z"), false, position,
    );
    expect(frame.crowdReaction).toBe("cheer");
    expect(frame.look).toBe("encore");
    expect(frame.positionMs).toBe(15 * 60_000);
    expect(frame.performers).toEqual([{
      id: profileId, position, visible: true, walking: false,
      action: "dj_mix", actionProgress: 0,
    }]);
    expect(events[0].event_no).toBe(3);
    expect(frame.energy).toBeCloseTo(0.405);
    expect(frame.effect).toBeNull();
  });

  it("does not animate a missed or cancelled show, even with old mixer evidence", () => {
    const frame = buildDjClubStageFrame(
      { ...booking, status: "missed" }, profileId, [mix(1, "crossfade")],
      null, 100, Date.parse("2026-10-20T21:05:00Z"),
    );
    expect(frame.performing).toBe(false);
    expect(frame.performers[0].visible).toBe(false);
    expect(frame.crowdReaction).toBe("still");
  });

  it("honours reduced motion without changing the server evidence", () => {
    const frame = buildDjClubStageFrame(
      booking, profileId, [mix(1, "crossfade")], null, 100,
      Date.parse("2026-10-20T20:30:00Z"), true,
    );
    expect(frame.crowdReaction).toBe("still");
    expect(frame.energy).toBeCloseTo(0.295);
  });

  it("clips animation timeline to the real booked window", () => {
    const early = buildDjClubStageFrame(
      booking, profileId, [], null, 100, Date.parse("2026-10-20T19:50:00Z"),
    );
    const late = buildDjClubStageFrame(
      booking, profileId, [], null, 100, Date.parse("2026-10-20T21:50:00Z"),
    );
    expect(early.positionMs).toBe(0);
    expect(late.positionMs).toBe(3600_000);
  });
});
