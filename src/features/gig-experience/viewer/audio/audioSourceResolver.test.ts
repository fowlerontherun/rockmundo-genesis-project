import { describe, expect, it } from "vitest";
import { deterministicExcerptStart, resolveSongAudioDescriptor } from "./audioSourceResolver";

describe("gig viewer audio source resolution", () => {
  it("selects approved generated full audio before preview", () => {
    expect(resolveSongAudioDescriptor({ extended_audio_url: "full.mp3", audio_url: "preview.mp3", audio_generation_status: "completed", duration_seconds: 180 }).sourceType).toBe("generated_full");
  });
  it("falls back to approved preview audio", () => {
    const source = resolveSongAudioDescriptor({ audio_url: "preview.mp3", audio_generation_status: "completed", duration_seconds: 90 });
    expect(source.available).toBe(true); expect(source.sourceType).toBe("preview");
  });
  it("rejects processing failed private and missing audio safely", () => {
    expect(resolveSongAudioDescriptor({ audio_url: "a.mp3", audio_generation_status: "processing" }).available).toBe(false);
    expect(resolveSongAudioDescriptor({ audio_url: "a.mp3", audio_generation_status: "failed" }).available).toBe(false);
    expect(resolveSongAudioDescriptor({ audio_url: "a.mp3", is_private: true }).permissionState).toBe("denied");
    expect(resolveSongAudioDescriptor(null).available).toBe(false);
  });
});

describe("deterministic gig audio excerpts", () => {
  it("keeps offset deterministic and inside bounds", () => {
    const a = deterministicExcerptStart("song", "seed", 180, 25);
    const b = deterministicExcerptStart("song", "seed", 180, 25);
    expect(a).toBe(b); expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThanOrEqual(153);
  });
  it("uses zero for short audio or segment longer than track", () => {
    expect(deterministicExcerptStart("song", "seed", 20, 25)).toBe(0);
    expect(deterministicExcerptStart("song", "seed", 0, 25)).toBe(0);
  });
});
