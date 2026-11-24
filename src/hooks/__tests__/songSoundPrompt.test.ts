import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSongStylePrompt, prepareSongLyricsForModel } from "../../../supabase/functions/_shared/songSoundPrompt";
import { compactLyricsForShortAudio } from "../../../supabase/functions/_shared/shortSongLyrics";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Basic and Advanced songwriting AI sound direction", () => {
  it("keeps Basic creation simple and uses a genre/vocal default", () => {
    const result = buildSongStylePrompt({ model: "music-1.5", genre: "Indie rock", creatorGender: "female" });
    expect(result.prompt).toContain("Indie rock");
    expect(result.prompt).toContain("female vocal");
    expect(result.prompt.length).toBeLessThanOrEqual(300);
  });

  it("translates previously disconnected songwriting fields into actual sound instructions", () => {
    const result = buildSongStylePrompt({
      model: "music-1.5", genre: "Rock", quality: 65,
      instruments: ["instruments_basic_electric_guitar", "instruments_basic_bass_guitar"],
      creativeBrief: { mood_modifiers: ["uplifting"], inspiration_modifiers: ["retro"] },
    });
    expect(result.prompt).toContain("electric guitar");
    expect(result.prompt).toContain("bass guitar");
    expect(result.prompt).toContain("uplifting");
    expect(result.prompt).toContain("retro");
    expect(result.prompt.length).toBeLessThanOrEqual(300);
  });

  it("keeps explicit Advanced choices ahead of defaults under Music 1.5 limits", () => {
    const result = buildSongStylePrompt({
      model: "music-1.5", genre: "Alternative rock", creatorGender: "male",
      bandSoundDescription: "Loud and distorted".repeat(20),
      creativeBrief: { sound_profile: {
        bpm: 118, musical_key: "E minor", energy: "building",
        vocal_style: "smooth", guitar_tone: "jangly", production_style: "vintage",
      } },
    });
    expect(result.prompt).toContain("118 BPM");
    expect(result.prompt).toContain("E minor");
    expect(result.prompt).toContain("smooth gentle vocals");
    expect(result.prompt).toContain("jangly clean guitar");
    expect(result.prompt).not.toContain("male vocal");
    expect(result.wasTruncated).toBe(true);
  });

  it("allows Music 2.6's larger prompt while retaining the 1.5 cap", () => {
    const long = "vintage studio sound, ".repeat(55);
    const options = { genre: "Pop", creativeBrief: { additional_notes: long }, bandSoundDescription: long };
    const standard = buildSongStylePrompt({ ...options, model: "music-1.5" });
    const advanced = buildSongStylePrompt({ ...options, model: "music-2.6" });
    expect(standard.finalLength).toBeLessThanOrEqual(300);
    expect(advanced.finalLength).toBeGreaterThan(standard.finalLength);
    expect(advanced.finalLength).toBeLessThanOrEqual(2000);
  });

  it("does not force Music 2.6 lyrics into the old 580-character radio edit", () => {
    const original = "[Verse]\n" + "Lines of lyrics repeated gently\n".repeat(22) + "[Chorus]\nWe're going home\n[Outro]\nGoodbye";
    expect(compactLyricsForShortAudio(original)!.length).toBeLessThanOrEqual(580);
    expect(prepareSongLyricsForModel(original, "music-2.6")).toBe(original);
    const withSolo = prepareSongLyricsForModel(original, "music-2.6", "solo")!;
    expect(withSolo).toContain("[Solo]\n\n[Outro]");
    expect(original).not.toContain("[Solo]");
  });

  it("keeps acoustic versions stripped back without importing heavy band styling", () => {
    const result = buildSongStylePrompt({
      model: "music-1.5", genre: "acoustic", isAcousticVersion: true,
      bandSoundDescription: "heavy distorted metal synths",
    });
    expect(result.prompt).toContain("stripped-back acoustic");
    expect(result.prompt).not.toContain("heavy distorted metal synths");
  });

  it("connects both authenticated generator paths to the shared composer and preserves the durable queue", () => {
    for (const path of ["supabase/functions/generate-song-audio/index.ts", "supabase/functions/admin-generate-song-audio/index.ts"]) {
      const file = source(path);
      expect(file).toContain("buildSongStylePrompt({");
      expect(file).toContain("project?.instruments");
      expect(file).toContain("generationModel === 'music-2.6' ? 3500 : 600");
      expect(file).toContain("enqueue_ai_song_generation");
    }
  });
});
