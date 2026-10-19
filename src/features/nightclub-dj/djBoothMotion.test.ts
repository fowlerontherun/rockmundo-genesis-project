import { describe, expect, it } from "vitest";
import { djBoothGripTargets } from "@/features/gig-demo-3d/djBoothMotion";
import { buildDjClubStageFrame, buildDjClubStageOptions, djBoothActionAt, djMixerActivityLabel, type DjStageBooking, type DjStageMixEvent } from "./djClubStageModel";

const booking: DjStageBooking = {
  id: "d1", status: "live", club_id: "c1",
  starts_at: "2026-10-19T19:00:00Z",
  ends_at: "2026-10-19T20:00:00Z",
};
const at = Date.parse("2026-10-19T19:20:00Z");
const mix = (
  kind: string, deck: string | null, recordedAtMs = at, event_no = 1,
): DjStageMixEvent => ({
  event_no, kind, deck,
  recorded_at: new Date(recordedAtMs).toISOString(),
});

describe("verified DJ booth movements and cameras", () => {
  it.each([
    ["deck_play", "A", "dj_cue_a"],
    ["deck_play", "B", "dj_cue_b"],
    ["tempo", "A", "dj_tempo_a"],
    ["tempo", "B", "dj_tempo_b"],
    ["crossfade", null, "dj_crossfade"],
  ] as const)("maps accepted %s on %s to %s", (kind, deck, action) => {
    expect(djBoothActionAt([mix(kind, deck)], at + 4000)).toEqual({
      action, actionProgress: .5,
    });
  });

  it("rejects stale or future actions instead of holding a pose", () => {
    expect(djBoothActionAt([mix("deck_play", "A")], at + 8001)).toBeNull();
    expect(djBoothActionAt([mix("deck_play", "A")], at - 1)).toBeNull();
    expect(djBoothActionAt([mix("deck_play", "A")], Number.NaN)).toBeNull();
  });

  it("rejects unsupported kinds, missing decks and malformed timestamps", () => {
    expect(djBoothActionAt([mix("screenshot", null)], at)).toBeNull();
    expect(djBoothActionAt([mix("deck_play", null)], at)).toBeNull();
    expect(djBoothActionAt([mix("tempo", "C")], at)).toBeNull();
    expect(djBoothActionAt([{ ...mix("crossfade", null), recorded_at: "invalid" }], at)).toBeNull();
    expect(djBoothActionAt([{ ...mix("crossfade", null), event_no: 0 }], at)).toBeNull();
  });

  it("chooses the latest accepted sequence without reordering a shared event array", () => {
    const events = Object.freeze([
      mix("tempo", "A", at, 2),
      mix("deck_play", "B", at - 1000, 1),
    ]);
    expect(djBoothActionAt(events, at + 4000)?.action).toBe("dj_tempo_a");
    expect(events[0].event_no).toBe(2);
  });

  it("drives the 3D performer's action from persisted events for live and replay", () => {
    const evidence = [mix("crossfade", null)];
    const live = buildDjClubStageFrame(booking, "p1", evidence, null, 100, at + 4000);
    const completed = buildDjClubStageFrame(
      { ...booking, status: "completed" }, "p1", evidence,
      { attendance: 0, venue_capacity: 100 }, 100, at + 4000,
      false, [0, 0, 0], true,
    );
    expect(live.performers[0]).toMatchObject({
      visible: true, action: "dj_crossfade", actionProgress: .5,
    });
    expect(completed.performers[0]).toMatchObject({
      visible: true, action: "dj_crossfade", actionProgress: .5,
    });
    expect(completed.crowd).toBe(0);
  });

  it("never animates a non-live or reduced-motion performer", () => {
    const evidence = [mix("deck_play", "B")];
    const missed = buildDjClubStageFrame(
      { ...booking, status: "missed" }, "p1", evidence, null, 100, at + 1000,
    );
    const reduced = buildDjClubStageFrame(
      booking, "p1", evidence, null, 100, at + 4000, true,
    );
    expect(missed.performers[0].action).toBeNull();
    expect(reduced.performers[0].action).toBe("dj_mix");
    expect(reduced.crowdReaction).toBe("still");
  });

  it("moves only the corresponding platter hand, keeping positions in the physical booth", () => {
    const a = djBoothGripTargets("dj_cue_a", .5)!;
    const b = djBoothGripTargets("dj_cue_b", .5)!;
    expect(a.left[0]).toBeGreaterThan(0);
    expect(b.right[0]).toBeLessThan(0);
    expect(a.right).toEqual([-.25, 1.04, .44]);
    expect(b.left).toEqual([.26, 1.04, .44]);
    expect(djBoothGripTargets("dj_crossfade", .5)?.right[0]).toBe(0);
  });

  it("labels verified activity without claiming scores, song ownership or payments", () => {
    expect(djMixerActivityLabel(mix("deck_play", "A"))).toBe("Played a track on Deck A");
    expect(djMixerActivityLabel(mix("tempo", "B"))).toBe("Adjusted tempo on Deck B");
    expect(djMixerActivityLabel(mix("crossfade", null))).toBe("Moved the crossfader");
    expect(djMixerActivityLabel(mix("unrecognized", null))).toBe("Recorded mixer action");
    expect(djMixerActivityLabel(mix("deck_play", null))).toBe("Recorded mixer action");
  });

  it("opts only the nightclub fixture into DJ-specific camera blocking", () => {
    const options = buildDjClubStageOptions("p1", "c1", "Night Owl", 180, null);
    expect(options.djClub).toBe(true);
    expect(options.performers).toHaveLength(1);
    expect(options.performers[0].instrument).toBe("turntablism");
  });

  it("limits the arm pulse to the bounded eight-second window", () => {
    expect(djBoothGripTargets("dj_tempo_a", 0)?.influence).toBeCloseTo(0);
    expect(djBoothGripTargets("dj_tempo_a", .5)?.influence).toBeCloseTo(1);
    expect(djBoothGripTargets("dj_tempo_a", 1)?.influence).toBeCloseTo(0);
    expect(djBoothGripTargets("dj_tempo_a", -0.1)).toBeNull();
    expect(djBoothGripTargets("dj_tempo_a", 1.1)).toBeNull();
    expect(djBoothGripTargets("dj_tempo_a", Number.NaN)).toBeNull();
    expect(djBoothGripTargets("not_a_dj_action", .5)).toBeNull();
  });
});
