import { describe, expect, it } from "vitest";
import { PRACTICE_AUDIO_MAX_BYTES, practiceTrackStorageKey, validatePracticeAudioFile } from "./practiceTrackAudio";

const file = (name: string, type = "audio/mpeg", size = 1024) => ({ name, type, size });

describe("legacy practice audio administration", () => {
  it("accepts supported music formats, including browsers without a detected MIME", () => {
    expect(validatePracticeAudioFile(file("rock.MP3"))).toEqual({ ext: "mp3", contentType: "audio/mpeg" });
    expect(validatePracticeAudioFile(file("dance.m4a", "audio/x-m4a")).ext).toBe("m4a");
    expect(validatePracticeAudioFile(file("room.wav", "audio/x-wav")).ext).toBe("wav");
    expect(validatePracticeAudioFile(file("dj.ogg", "application/ogg")).ext).toBe("ogg");
    expect(validatePracticeAudioFile(file("night.webm", "")).ext).toBe("webm");
  });

  it("rejects missing, oversize, mismatched and non-audio files before upload", () => {
    expect(() => validatePracticeAudioFile(file("rock.mp3", "audio/mpeg", 0))).toThrow(/non-empty/);
    expect(() => validatePracticeAudioFile(file("rock.mp3", "audio/mpeg", PRACTICE_AUDIO_MAX_BYTES + 1))).toThrow(/50 MiB/);
    expect(() => validatePracticeAudioFile(file("rock.exe"))).toThrow(/MP3/);
    expect(() => validatePracticeAudioFile(file("rock.mp3", "image/png"))).toThrow(/does not match/);
    expect(() => validatePracticeAudioFile(file("rock.mp3", "audio/wav"))).toThrow(/does not match/);
  });

  it("removes only the expected track's public storage object", () => {
    const id = "default-rock-basics";
    const base = "https://assets.example/storage/v1/object/public/practice-tracks/";
    expect(practiceTrackStorageKey(id, base + id + ".mp3")).toBe(id + ".mp3");
    expect(practiceTrackStorageKey(id, base + id + ".WAV?download=1")).toBe(id + ".WAV");
    expect(practiceTrackStorageKey(id, base + "other.mp3")).toBeNull();
    expect(practiceTrackStorageKey(id, base + id + ".txt")).toBeNull();
    expect(practiceTrackStorageKey(id, base + "subdir/" + id + ".mp3")).toBeNull();
    expect(practiceTrackStorageKey(id, "https://other.example/other-bucket/" + id + ".mp3")).toBeNull();
    expect(practiceTrackStorageKey(id, base + id + ".mp3%2F..%2Fother.mp3")).toBeNull();
    expect(practiceTrackStorageKey(id, "invalid url")).toBeNull();
    expect(practiceTrackStorageKey("bad/track", base + id + ".mp3")).toBeNull();
  });
});
