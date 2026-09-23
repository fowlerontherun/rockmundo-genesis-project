import { useEffect, useRef } from "react";
import type { StorySnapshot } from "../engine/StoryEngine";
import type { ShowSequenceFrame } from "../engine/ShowSequence";
import {
  loadGigCrowdSounds,
  pickGigCrowdSound,
  type GigCrowdSound,
  type GigCrowdSoundType,
} from "./crowdSoundLibrary";

interface CrowdAmbienceOptions {
  enabled: boolean;
  muted: boolean;
  volume: number;
  isPlaying: boolean;
  snapshot: StorySnapshot | null;
  stageType: string;
  /** Show lifecycle frame: drives pre-show murmur, entrances, encore and final applause. */
  showFrame?: ShowSequenceFrame | null;
}

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function crowdSizeIntensity(stageType: string, energy: number) {
  const base = stageType === "stadium" ? 9 : stageType === "arena" || stageType === "festival" ? 8 : stageType === "theater" ? 6 : stageType === "club" ? 5 : 4;
  return Math.round(clamp(base + (energy - 0.5) * 4, 1, 10));
}

function reactionTypes(reaction: string | null, energy: number): GigCrowdSoundType[] {
  const value = (reaction ?? "").toLowerCase();
  if (/boo|negative|hostile/.test(value)) return ["booing", "ambient_chatter"];
  if (/mosh|pit|headbang|jump/.test(value)) return ["mosh_pit", "crowd_cheer_large", "crowd_cheer_medium"];
  if (/sing|chant/.test(value)) return ["crowd_singing", "crowd_cheer_medium"];
  if (/recogn|favourite|favorite/.test(value)) return ["song_recognition", "crowd_cheer_large", "crowd_cheer_medium"];
  if (/lighter|phone|quiet|sway/.test(value)) return ["lighter_moment", "crowd_singing", "ambient_chatter"];
  return energy >= 0.75
    ? ["crowd_cheer_large", "applause", "crowd_cheer_medium"]
    : energy >= 0.45
      ? ["crowd_cheer_medium", "applause", "crowd_cheer_small"]
      : ["crowd_cheer_small", "ambient_chatter"];
}

function playClip(ref: { current: HTMLAudioElement | null }, sound: GigCrowdSound | null, volume: number) {
  if (!sound || typeof Audio === "undefined") return false;
  ref.current?.pause();
  const audio = new Audio(sound.audio_url);
  audio.preload = "auto";
  audio.volume = clamp(volume, 0.03, 0.9);
  ref.current = audio;
  audio.onended = () => { if (ref.current === audio) ref.current = null; };
  void audio.play().catch(() => {
    if (ref.current === audio) ref.current = null;
  });
  return true;
}

/**
 * Recorded crowd-audio mixer for the 3D gig viewer.
 *
 * Every active entry in gig_crowd_sounds is eligible for playback. The viewer
 * chooses deterministic clips from venue size, crowd energy, song changes,
 * crowd reactions and show phases. If the library is unavailable, the visual
 * replay continues silently rather than failing the gig viewer.
 */
export function useCrowdAmbience({
  enabled,
  muted,
  volume,
  isPlaying,
  snapshot,
  stageType,
  showFrame = null,
}: CrowdAmbienceOptions) {
  const libraryRef = useRef<GigCrowdSound[]>([]);
  const ambientRef = useRef<HTMLAudioElement | null>(null);
  const reactionRef = useRef<HTMLAudioElement | null>(null);
  const lastReactionRef = useRef<string | null>(null);
  const lastPhaseRef = useRef<string | null>(null);
  const lastSongIdRef = useRef<string | null>(null);
  const lastPulseAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    if (!enabled) return;

    void loadGigCrowdSounds()
      .then((sounds) => {
        if (cancelled) return;
        libraryRef.current = sounds;
      })
      .catch(() => {
        if (!cancelled) libraryRef.current = [];
      });

    return () => { cancelled = true; };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !isPlaying || muted || typeof Audio === "undefined") {
      ambientRef.current?.pause();
      reactionRef.current?.pause();
      return;
    }

    const energy = clamp((snapshot?.crowdEnergy ?? 30) / 100);
    const intensity = crowdSizeIntensity(stageType, energy);
    const phase = showFrame?.phase ?? null;
    const sounds = libraryRef.current;

    const bedTypes: GigCrowdSoundType[] =
      phase === "encore_break"
        ? ["encore_request", "crowd_singing", "ambient_chatter"]
        : phase === "pre_show" || phase === "load_out"
          ? ["ambient_chatter", "band_exit"]
          : energy > 0.7
            ? ["ambient_chatter", "crowd_singing"]
            : ["ambient_chatter", "lighter_moment"];

    const bed = pickGigCrowdSound(sounds, bedTypes, Math.max(2, intensity - 2), `${stageType}:${phase ?? "performance"}:bed`);
    const existingBed = ambientRef.current;
    const existingUrl = existingBed?.dataset.rockmundoUrl ?? null;

    if (bed && existingUrl !== bed.audio_url) {
      existingBed?.pause();
      const audio = new Audio(bed.audio_url);
      audio.preload = "auto";
      audio.loop = true;
      audio.dataset.rockmundoUrl = bed.audio_url;
      ambientRef.current = audio;
    }

    if (ambientRef.current) {
      ambientRef.current.volume = clamp(volume * (0.10 + energy * 0.12), 0.03, 0.28);
      if (ambientRef.current.paused) void ambientRef.current.play().catch(() => undefined);
    }

    const songId = snapshot?.song?.id ?? null;
    if (songId && songId !== lastSongIdRef.current) {
      lastSongIdRef.current = songId;
      const recognition = pickGigCrowdSound(
        sounds,
        ["song_recognition", "crowd_cheer_medium", "crowd_cheer_small"],
        intensity,
        `${songId}:recognition`,
      );
      playClip(reactionRef, recognition, volume * (0.25 + energy * 0.2));
    }

    const reaction = snapshot?.reaction ?? null;
    if (reaction && reaction !== lastReactionRef.current) {
      lastReactionRef.current = reaction;
      const clip = pickGigCrowdSound(sounds, reactionTypes(reaction, energy), intensity, `${songId ?? "gig"}:${reaction}`);
      playClip(reactionRef, clip, volume * (0.3 + energy * 0.28));
    }

    if (phase && phase !== lastPhaseRef.current) {
      lastPhaseRef.current = phase;
      const phaseTypes: GigCrowdSoundType[] | null =
        phase === "band_entry"
          ? ["band_entrance", "crowd_cheer_large", "crowd_cheer_medium"]
          : phase === "encore"
            ? ["encore_request", "band_entrance", "crowd_cheer_large"]
            : phase === "bows"
              ? ["applause", "crowd_cheer_large", "band_exit"]
              : phase === "load_out"
                ? ["band_exit", "applause", "ambient_chatter"]
                : null;
      if (phaseTypes) {
        const clip = pickGigCrowdSound(sounds, phaseTypes, phase === "bows" ? 10 : intensity, `${stageType}:${phase}`);
        playClip(reactionRef, clip, volume * (phase === "bows" ? 0.65 : 0.5));
      }
    }

    const elapsedMs = snapshot?.song?.elapsedMs ?? 0;
    if (
      snapshot?.song
      && elapsedMs - lastPulseAtRef.current >= 18_000
      && energy >= 0.45
    ) {
      lastPulseAtRef.current = elapsedMs;
      const pulse = pickGigCrowdSound(
        sounds,
        reactionTypes(reaction, energy),
        intensity,
        `${songId ?? "song"}:pulse:${Math.floor(elapsedMs / 18_000)}`,
      );
      playClip(reactionRef, pulse, volume * (0.18 + energy * 0.2));
    }
  }, [
    enabled,
    muted,
    volume,
    isPlaying,
    stageType,
    snapshot?.crowdEnergy,
    snapshot?.reaction,
    snapshot?.song?.id,
    snapshot?.song?.elapsedMs,
    showFrame?.phase,
  ]);

  useEffect(() => () => {
    ambientRef.current?.pause();
    reactionRef.current?.pause();
    ambientRef.current = null;
    reactionRef.current = null;
  }, []);
}
