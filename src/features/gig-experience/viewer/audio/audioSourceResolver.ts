import type { GigExperienceSongDTO } from "../../types";
import type { SongSegment } from "../engine/StoryEngine";

export type GigAudioSourceType = "generated_full" | "preview" | "fixture" | "none";
export type GigAudioPermissionState = "allowed" | "denied" | "public" | "admin_demo";
export interface GigSongAudioDescriptor { available: boolean; sourceType: GigAudioSourceType; url: string | null; durationSeconds: number | null; generationStatus: string | null; permissionState: GigAudioPermissionState; reasonUnavailable?: string }
export interface ResolvedGigAudioSource extends GigSongAudioDescriptor { songId: string | null; title: string; excerptStartSeconds: number; excerptDurationSeconds: number }

const APPROVED = new Set(["completed", "approved", "ready"]);
const BLOCKED = new Set(["generating", "processing", "pending", "failed", "deleted", "rejected", "blocked"]);

export function resolveSongAudioDescriptor(song: { audio_url?: string | null; extended_audio_url?: string | null; audio_generation_status?: string | null; duration_seconds?: number | null; is_private?: boolean | null; title?: string | null } | null | undefined, permission: GigAudioPermissionState = "allowed"): GigSongAudioDescriptor {
  if (!song) return unavailable("missing_song", null, permission);
  if (permission === "denied" || song.is_private) return unavailable("permission_denied", song.audio_generation_status ?? null, "denied");
  const status = song.audio_generation_status ?? null;
  if (status && BLOCKED.has(status)) return unavailable(status, status, permission);
  if (song.extended_audio_url && (!status || APPROVED.has(status))) return { available: true, sourceType: "generated_full", url: song.extended_audio_url, durationSeconds: song.duration_seconds ?? null, generationStatus: status, permissionState: permission };
  if (song.audio_url && (!status || APPROVED.has(status))) return { available: true, sourceType: "preview", url: song.audio_url, durationSeconds: song.duration_seconds ?? null, generationStatus: status, permissionState: permission };
  return unavailable(status ? `status_${status}` : "no_audio", status, permission);
}

export function resolveGigSongAudio(song: GigExperienceSongDTO | undefined | null, segment: SongSegment | null | undefined, replaySeed: string): ResolvedGigAudioSource {
  const descriptor = song?.audio ?? unavailable("no_audio_descriptor", null, "allowed");
  const duration = Math.max(0, descriptor.durationSeconds ?? 0);
  const segmentSeconds = Math.max(1, ((segment?.endMs ?? 0) - (segment?.startMs ?? 0)) / 1000 || 20);
  const excerptDurationSeconds = Math.min(segmentSeconds, duration || segmentSeconds);
  return { ...descriptor, songId: song?.songId ?? segment?.id ?? null, title: song?.title ?? segment?.title ?? "Unknown song", excerptStartSeconds: deterministicExcerptStart(song?.songId ?? segment?.id ?? "unknown", replaySeed, duration, excerptDurationSeconds), excerptDurationSeconds };
}

export function deterministicExcerptStart(songId: string, replaySeed: string, durationSeconds: number, excerptDurationSeconds: number) {
  const safeDuration = Math.max(0, Math.floor(durationSeconds));
  const safeExcerpt = Math.max(1, Math.ceil(excerptDurationSeconds));
  const maxStart = Math.max(0, safeDuration - safeExcerpt - 2);
  if (maxStart <= 0) return 0;
  let hash = 2166136261;
  for (const ch of `${songId}:${replaySeed}:${safeDuration}:${safeExcerpt}`) { hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return Math.max(0, Math.min(maxStart, (hash >>> 0) % (maxStart + 1)));
}
function unavailable(reason: string, status: string | null, permission: GigAudioPermissionState): GigSongAudioDescriptor { return { available: false, sourceType: "none", url: null, durationSeconds: null, generationStatus: status, permissionState: permission, reasonUnavailable: reason }; }
