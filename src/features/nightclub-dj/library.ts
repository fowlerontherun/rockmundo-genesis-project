import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DJ_AUDIO_BUCKET = "dj-tracks";
export const DJ_FILE_SIZE_LIMIT = 50 * 1024 * 1024;

export interface DjAudioTrack {
  id: string;
  source: "game" | "admin";
  sourceId: string;
  title: string;
  artist: string;
  genre: string;
  bpm: number | null;
  musicalKey: string | null;
  durationSeconds: number | null;
  audioUrl: string | null;
  storagePath: string | null;
  mine: boolean;
  sharedForDj: boolean;
}

type GameSong = {
  id: string; title: string | null; genre: string | null;
  duration_seconds: number | null; audio_url: string | null;
  extended_audio_url: string | null; profile_id: string | null;
  status: string | null; dj_use_allowed: boolean | null;
  archived: boolean | null;
};

export type AdminDjTrack = {
  id: string; title: string; artist: string; genre: string;
  bpm: number | null; musical_key: string | null;
  duration_seconds: number | null; storage_path: string;
  rights_confirmed: boolean; is_active: boolean;
  rights_notes?: string | null;
};

export function validDjAudioUrl(input: string | null | undefined): input is string {
  if (!input) return false;
  try {
    const url = new URL(input, typeof location !== "undefined" ? location.origin : "https://rockmundo.example");
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  } catch { return false; }
}

export function mapGameDjTrack(song: GameSong, myProfileId: string): DjAudioTrack | null {
  const mine = song.profile_id === myProfileId;
  const allowed = mine || (song.status === "released" && song.dj_use_allowed === true);
  const url = validDjAudioUrl(song.extended_audio_url) ? song.extended_audio_url
    : validDjAudioUrl(song.audio_url) ? song.audio_url : null;
  if (!allowed || song.archived || !url) return null;
  return {
    id: `game:${song.id}`, source: "game", sourceId: song.id,
    title: song.title?.trim() || "Untitled",
    artist: mine ? "My song" : "RockMundo artist",
    genre: song.genre || "Unknown", bpm: null, musicalKey: null,
    durationSeconds: song.duration_seconds ?? null,
    audioUrl: url, storagePath: null, mine,
    sharedForDj: song.dj_use_allowed === true,
  };
}

export function mapAdminDjTrack(track: AdminDjTrack): DjAudioTrack {
  return {
    id: `admin:${track.id}`, source: "admin", sourceId: track.id,
    title: track.title, artist: track.artist, genre: track.genre,
    bpm: track.bpm, musicalKey: track.musical_key,
    durationSeconds: track.duration_seconds, audioUrl: null,
    storagePath: track.storage_path, mine: false, sharedForDj: true,
  };
}

/** Only an admin-approved storage path gets a signed, short-lived URL from Storage RLS. */
export async function getDjPlaybackUrl(track: DjAudioTrack): Promise<string> {
  if (track.source === "game" && validDjAudioUrl(track.audioUrl)) return track.audioUrl;
  if (!track.storagePath || track.source !== "admin") throw new Error("Audio unavailable");
  const { data, error } = await supabase.storage.from(DJ_AUDIO_BUCKET).createSignedUrl(track.storagePath, 3600);
  if (error || !data?.signedUrl) throw new Error(error?.message || "Audio not available for playback");
  return data.signedUrl;
}

export function useDjTrackLibrary(profileId: string | null) {
  return useQuery({
    queryKey: ["dj-track-library", profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<DjAudioTrack[]> => {
      if (!profileId) return [];
      const [mine, shared, admin] = await Promise.all([
        supabase.from("songs")
          .select("id,title,genre,duration_seconds,audio_url,extended_audio_url,profile_id,status,dj_use_allowed,archived")
          .eq("profile_id", profileId)
          .in("status", ["recorded", "released", "completed", "mastered"])
          .eq("archived", false)
          .order("created_at", { ascending: false }).limit(100),
        supabase.from("songs")
          .select("id,title,genre,duration_seconds,audio_url,extended_audio_url,profile_id,status,dj_use_allowed,archived")
          .eq("status", "released").eq("dj_use_allowed", true)
          .eq("archived", false).order("created_at", { ascending: false }).limit(200),
        (supabase as any).from("dj_audio_tracks")
          .select("id,title,artist,genre,bpm,musical_key,duration_seconds,storage_path,rights_confirmed,is_active")
          .eq("is_active", true).eq("rights_confirmed", true)
          .order("title").limit(250),
      ]);
      if (mine.error) throw mine.error;
      if (shared.error) throw shared.error;
      if (admin.error) throw admin.error;
      const unique = new Map<string, DjAudioTrack>();
      for (const song of [...(mine.data ?? []), ...(shared.data ?? [])] as GameSong[]) {
        const track = mapGameDjTrack(song, profileId);
        if (track) unique.set(track.id, track);
      }
      for (const row of (admin.data ?? []) as AdminDjTrack[]) {
        unique.set(`admin:${row.id}`, mapAdminDjTrack(row));
      }
      return [...unique.values()];
    },
    staleTime: 30_000,
  });
}
