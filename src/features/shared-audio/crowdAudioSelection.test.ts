import { describe, expect, it } from "vitest";
import { CrowdReactionCooldown, selectCrowdClip } from "./crowdAudioSelection";

const clips = [
  { id: "b", sound_type: "applause", intensity_level: 5 },
  { id: "a", sound_type: "applause", intensity_level: 5 },
  { id: "c", sound_type: "ambient_chatter", intensity_level: 5 },
  { id: "d", sound_type: "applause", intensity_level: 10 },
];

describe("shared crowd clip selection", () => {
  it.each(["gig-fnv1a", "studio-rolling31"] as const)(
    "selects the same approved clip regardless of catalogue order (%s)",
    (strategy) => {
      const selected = selectCrowdClip(clips, ["applause"], 5, "episode-42", strategy);
      expect(selected?.id).toBe(
        selectCrowdClip([...clips].reverse(), ["applause"], 5, "episode-42", strategy)?.id,
      );
      expect(["a", "b"]).toContain(selected?.id);
    },
  );

  it("rejects unavailable types, filtered assets and invalid intensity", () => {
    expect(selectCrowdClip(clips, ["encore"], 5, "x", "gig-fnv1a")).toBeNull();
    expect(selectCrowdClip(clips, ["applause"], NaN, "x", "gig-fnv1a")).toBeNull();
    expect(selectCrowdClip(clips, ["applause"], 5, "x", "gig-fnv1a", new Set(["a", "b"]))?.id).toBe("d");
  });
});

describe("crowd reaction cooldown", () => {
  it("prevents repeats inside the cue-time window and allows them later", () => {
    const cooldown = new CrowdReactionCooldown();
    expect(cooldown.canPlay("applause-a", 1000)).toBe(true);
    cooldown.record("applause-a", 1000);
    expect(cooldown.canPlay("applause-a", 14_000)).toBe(false);
    expect(cooldown.canPlay("applause-b", 14_000)).toBe(true);
    expect(cooldown.canPlay("applause-a", 16_000)).toBe(true);
  });
  it("replays deterministically after seeking back and can be cleared on exit", () => {
    const cooldown = new CrowdReactionCooldown();
    cooldown.record("applause-a", 25_000);
    expect(cooldown.canPlay("applause-a", 5_000)).toBe(true);
    cooldown.record("applause-a", 5_000);
    expect(cooldown.canPlay("applause-a", 6_000)).toBe(false);
    cooldown.reset();
    expect(cooldown.canPlay("applause-a", 6_000)).toBe(true);
  });
});
