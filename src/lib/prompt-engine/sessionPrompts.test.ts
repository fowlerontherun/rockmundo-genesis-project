import { describe, expect, it } from "bun:test";

import {
  buildLyricsExcerpt,
  buildSessionPromptArtifact,
  describeArrangement,
  describeStyle,
  type SessionPromptMetadata,
  type StemDescriptor,
} from "./sessionPrompts";

const baseMetadata: SessionPromptMetadata = {
  sessionId: "session-1",
  songId: "song-1",
  songTitle: "Neon Echo",
  genre: "synthwave",
  tempo: 128,
  durationHours: 3,
  totalCost: 4200,
  recordingVersion: "standard",
  studioName: "Voltage Alley",
};

const sampleStems: StemDescriptor[] = [
  { name: "guitar_lead.wav", storagePath: "session-1/guitar_lead.wav" },
  { name: "guitar_rhythm.wav", storagePath: "session-1/guitar_rhythm.wav" },
  { name: "drums_room.wav", storagePath: "session-1/drums_room.wav" },
  { name: "vox_main.wav", storagePath: "session-1/vox_main.wav" },
];

describe("session prompt summaries", () => {
  it("describes style with genre, tempo, and quality cues", () => {
    const summary = describeStyle({ ...baseMetadata, qualityImprovement: 12, qualityScore: 640 });
    expect(summary).toContain("Synthwave pulse");
    expect(summary).toContain("128 BPM");
    expect(summary).toContain("640/1000");
  });

  it("builds arrangement details from stems", () => {
    const description = describeArrangement({ ...baseMetadata, arrangementStrength: 78 }, sampleStems);
    expect(description).toContain("Guitar x2");
    expect(description).toContain("Polished");
  });

  it("limits lyrics excerpts to the requested tokens", () => {
    const excerpt = buildLyricsExcerpt("one two three four five six seven eight nine ten eleven", 5);
    expect(excerpt.split(/\s+/).length).toBeLessThanOrEqual(6);
    expect(excerpt.endsWith("…")).toBeTrue();
  });
});

describe("prompt artifact serialization", () => {
  it("creates bounded summaries and token estimates", () => {
    const artifact = buildSessionPromptArtifact({
      metadata: { ...baseMetadata, qualityScore: 600, arrangementStrength: 70 },
      stems: sampleStems,
      lyrics: Array(80)
        .fill("chorus line builds under neon skies")
        .join(" "),
      options: { maxPromptTokens: 120, maxLyricsTokens: 20 },
    });

    expect(artifact.prompt.summaries.short.split(/\s+/).length).toBeLessThanOrEqual(30);
    expect(artifact.lyricsExcerpt.split(/\s+/).length).toBeLessThanOrEqual(21);
    expect(artifact.stemPaths).toContain("session-1/guitar_lead.wav");
    expect(artifact.tokenEstimate).toBeLessThanOrEqual(120);
  });
});
