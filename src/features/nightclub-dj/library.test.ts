import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({ useQuery: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: {} } }));

import { filterDjTracks, mapAdminDjTrack, mapGameDjTrack, validDjAudioUrl } from "./library";

const sample = {
  id: "song-1", title: "The Night", genre: "House",
  duration_seconds: 180, audio_url: "https://audio.example/track.mp3",
  extended_audio_url: null, profile_id: "owner",
  status: "released", dj_use_allowed: false, archived: false,
};

describe("DJ audio catalogue eligibility", () => {
  it("allows the active character to practise their own recorded song", () => {
    const track = mapGameDjTrack({ ...sample, status: "recorded" }, "owner");
    expect(track?.id).toBe("game:song-1");
    expect(track?.mine).toBe(true);
  });

  it("requires an explicit opt-in for recorded and released tracks from other artists", () => {
    expect(mapGameDjTrack(sample, "another")).toBeNull();
    expect(mapGameDjTrack({ ...sample, dj_use_allowed: true, status: "recorded" }, "another")?.source).toBe("game");
    expect(mapGameDjTrack({ ...sample, dj_use_allowed: true }, "another")?.sharedForDj).toBe(true);
  });

  it("never queues archived, unplayable or unsafe song audio", () => {
    expect(mapGameDjTrack({ ...sample, archived: true }, "owner")).toBeNull();
    expect(mapGameDjTrack({ ...sample, audio_url: null }, "owner")).toBeNull();
    expect(mapGameDjTrack({ ...sample, audio_url: "javascript:alert(1)" }, "owner")).toBeNull();
    expect(validDjAudioUrl("https://cdn.example/track.ogg")).toBe(true);
    expect(validDjAudioUrl("ftp://cdn.example/track.ogg")).toBe(false);
  });


  it("credits the recorded performing band or solo artist when available", () => {
    expect(mapGameDjTrack({ ...sample, band: { name: "War Dogs" }, artist_profile: { display_name: "Someone" } }, "owner")?.artist)
      .toBe("War Dogs");
    expect(mapGameDjTrack({ ...sample, artist_profile: { display_name: "DJ Night" } }, "owner")?.artist)
      .toBe("DJ Night");
    expect(mapGameDjTrack({ ...sample }, "another")).toBeNull();
  });

  it("searches playable tracks by title, artist, genre, tempo and key", () => {
    const game = mapGameDjTrack({ ...sample, band: { name: "War Dogs" } }, "owner")!;
    const admin = mapAdminDjTrack({
      id: "admin-1", title: "Club Pulse", artist: "DJ Night", genre: "Techno",
      bpm: 128, musical_key: "Am", duration_seconds: 240,
      storage_path: "catalog/00000000-0000-0000-0000-000000000000/track.mp3",
      rights_confirmed: true, is_active: true,
    });
    const tracks = [game, admin];
    expect(filterDjTracks(tracks, "war dogs", "all")).toEqual([game]);
    expect(filterDjTracks(tracks, "TEChNO", "all")).toEqual([admin]);
    expect(filterDjTracks(tracks, "128", "all")).toEqual([admin]);
    expect(filterDjTracks(tracks, " am ", "admin")).toEqual([admin]);
    expect(filterDjTracks(tracks, "", "game")).toEqual([game]);
    expect(filterDjTracks(tracks, "missing", "all")).toEqual([]);
  });

  it("uses the longer recording when available", () => {
    expect(mapGameDjTrack({ ...sample, extended_audio_url: "https://audio.example/full.mp3" }, "owner")?.audioUrl)
      .toBe("https://audio.example/full.mp3");
  });

  it("builds private admin tracks without exposing a permanent public URL", () => {
    const track = mapAdminDjTrack({
      id: "admin-1", title: "Club Pulse", artist: "House Band", genre: "Techno",
      bpm: 128, musical_key: "Am", duration_seconds: 240,
      storage_path: "catalog/00000000-0000-0000-0000-000000000000/track.mp3",
      rights_confirmed: true, is_active: true,
    });
    expect(track.source).toBe("admin");
    expect(track.storagePath).toContain("catalog/");
    expect(track.audioUrl).toBeNull();
  });
});
