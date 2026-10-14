import { selectCrowdClip } from "@/features/shared-audio/crowdAudioSelection";
import { supabase } from "@/integrations/supabase/client";

export type GigCrowdSoundType =
  | "band_entrance"
  | "band_exit"
  | "encore_request"
  | "crowd_cheer_small"
  | "crowd_cheer_medium"
  | "crowd_cheer_large"
  | "crowd_singing"
  | "applause"
  | "booing"
  | "ambient_chatter"
  | "song_recognition"
  | "mosh_pit"
  | "lighter_moment";

export interface GigCrowdSound {
  id: string;
  name: string;
  sound_type: GigCrowdSoundType;
  audio_url: string;
  intensity_level: number;
  duration_seconds: number | null;
}

export const GIG_CROWD_SOUND_TYPES: GigCrowdSoundType[] = [
  "band_entrance",
  "band_exit",
  "encore_request",
  "crowd_cheer_small",
  "crowd_cheer_medium",
  "crowd_cheer_large",
  "crowd_singing",
  "applause",
  "booing",
  "ambient_chatter",
  "song_recognition",
  "mosh_pit",
  "lighter_moment",
];

let cached: GigCrowdSound[] | null = null;
let pending: Promise<GigCrowdSound[]> | null = null;

export async function loadGigCrowdSounds(): Promise<GigCrowdSound[]> {
  if (cached) return cached;
  if (pending) return pending;

  pending = (async () => {
    const { data, error } = await supabase
      .from("gig_crowd_sounds")
      .select("id,name,sound_type,audio_url,intensity_level,duration_seconds")
      .eq("is_active", true)
      .order("sound_type")
      .order("intensity_level");

    if (error) throw error;

    cached = (data ?? [])
      .filter((row) => !!row.audio_url && GIG_CROWD_SOUND_TYPES.includes(row.sound_type as GigCrowdSoundType))
      .map((row) => ({
        id: String(row.id),
        name: String(row.name ?? row.sound_type ?? "Crowd sound"),
        sound_type: row.sound_type as GigCrowdSoundType,
        audio_url: String(row.audio_url),
        intensity_level: Number(row.intensity_level ?? 5),
        duration_seconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
      }));

    return cached;
  })().finally(() => {
    pending = null;
  });

  return pending;
}

export function pickGigCrowdSound(
  sounds: GigCrowdSound[],
  types: GigCrowdSoundType[],
  intensity: number,
  seed: string,
): GigCrowdSound | null {
  return selectCrowdClip(sounds, types, intensity, seed, "gig-fnv1a");
}

export function resetGigCrowdSoundCacheForTests() {
  cached = null;
  pending = null;
}
