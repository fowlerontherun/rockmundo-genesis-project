import { selectCrowdClip } from "@/features/shared-audio/crowdAudioSelection";
import { supabase } from "@/integrations/supabase/client";

export type TotpCrowdSoundType =
  | "crowd_cheer_small"
  | "crowd_cheer_medium"
  | "crowd_cheer_large"
  | "crowd_singing"
  | "applause"
  | "ambient_chatter"
  | "band_entrance"
  | "band_exit"
  | "encore_request";

export interface TotpCrowdSound {
  id: string;
  sound_type: TotpCrowdSoundType;
  audio_url: string;
  intensity_level: number;
  duration_seconds: number | null;
}

const TYPES: TotpCrowdSoundType[] = [
  "crowd_cheer_small",
  "crowd_cheer_medium",
  "crowd_cheer_large",
  "crowd_singing",
  "applause",
  "ambient_chatter",
  "band_entrance",
  "band_exit",
  "encore_request",
];

let cached: TotpCrowdSound[] | null = null;
let pending: Promise<TotpCrowdSound[]> | null = null;

export async function loadTotpCrowdSounds(): Promise<TotpCrowdSound[]> {
  if (cached) return cached;
  if (pending) return pending;

  pending = (async () => {
    const { data, error } = await supabase
      .from("gig_crowd_sounds")
      .select("id,sound_type,audio_url,intensity_level,duration_seconds")
      .eq("is_active", true)
      .in("sound_type", TYPES)
      .order("intensity_level");

    if (error) throw error;
    cached = (data ?? [])
      .filter((row) => !!row.audio_url && TYPES.includes(row.sound_type as TotpCrowdSoundType))
      .map((row) => ({
        id: String(row.id),
        sound_type: row.sound_type as TotpCrowdSoundType,
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

export function pickTotpCrowdSound(
  sounds: TotpCrowdSound[],
  types: TotpCrowdSoundType[],
  intensity: number,
  seed: string,
): TotpCrowdSound | null {
  return selectCrowdClip(sounds, types, intensity, seed, "studio-rolling31");
}

export function resetTotpCrowdSoundCacheForTests() {
  cached = null;
  pending = null;
}
