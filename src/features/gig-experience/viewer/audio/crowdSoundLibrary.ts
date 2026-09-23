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
  const candidates = sounds
    .filter((sound) => types.includes(sound.sound_type))
    .sort((a, b) =>
      Math.abs(a.intensity_level - intensity) - Math.abs(b.intensity_level - intensity)
      || a.id.localeCompare(b.id),
    );

  if (!candidates.length) return null;

  const bestDistance = Math.abs(candidates[0].intensity_level - intensity);
  const nearest = candidates.filter((sound) => Math.abs(sound.intensity_level - intensity) === bestDistance);
  let hash = 2166136261;
  for (const ch of seed) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return nearest[(hash >>> 0) % nearest.length] ?? nearest[0] ?? null;
}

export function resetGigCrowdSoundCacheForTests() {
  cached = null;
  pending = null;
}
