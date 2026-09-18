import { describe, expect, it } from "vitest";
import { pickTotpCrowdSound, type TotpCrowdSound } from "./crowdSoundLibrary";

const sounds: TotpCrowdSound[] = [
  { id: "small-a", sound_type: "crowd_cheer_small", audio_url: "/small-a.mp3", intensity_level: 4, duration_seconds: 2 },
  { id: "medium-a", sound_type: "crowd_cheer_medium", audio_url: "/medium-a.mp3", intensity_level: 7, duration_seconds: 3 },
  { id: "medium-b", sound_type: "crowd_cheer_medium", audio_url: "/medium-b.mp3", intensity_level: 7, duration_seconds: 3 },
  { id: "large-a", sound_type: "crowd_cheer_large", audio_url: "/large-a.mp3", intensity_level: 9, duration_seconds: 4 },
  { id: "applause-a", sound_type: "applause", audio_url: "/applause.mp3", intensity_level: 9, duration_seconds: 4 },
];

describe("Top of the Pops crowd sound selection", () => {
  it("chooses the nearest approved intensity", () => {
    expect(pickTotpCrowdSound(sounds, ["crowd_cheer_large", "crowd_cheer_medium"], 9, "cue-1")?.id).toBe("large-a");
    expect(pickTotpCrowdSound(sounds, ["crowd_cheer_small"], 4, "cue-1")?.id).toBe("small-a");
  });

  it("is deterministic when several clips are equally suitable", () => {
    const first = pickTotpCrowdSound(sounds, ["crowd_cheer_medium"], 7, "performance-3");
    const second = pickTotpCrowdSound(sounds, ["crowd_cheer_medium"], 7, "performance-3");
    expect(first?.id).toBe(second?.id);
  });

  it("returns null when the approved library has no requested sound type", () => {
    expect(pickTotpCrowdSound(sounds, ["ambient_chatter"], 5, "cue")).toBeNull();
  });
});
