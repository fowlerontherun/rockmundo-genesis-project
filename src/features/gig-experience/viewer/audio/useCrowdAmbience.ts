import { useEffect, useRef, useState } from "react";
import { CrowdReactionCooldown } from "@/features/shared-audio/crowdAudioSelection";
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

async function playClip(
  ref: { current: HTMLAudioElement | null }, sound: GigCrowdSound, volume: number,
): Promise<boolean> {
  if (typeof Audio === "undefined") return false;
  const previous = ref.current;
  previous?.pause();
  if (previous) {
    previous.onended = null;
    previous.removeAttribute("src");
    previous.load();
  }
  const audio = new Audio(sound.audio_url);
  audio.preload = "auto";
  audio.volume = clamp(volume, 0.03, 0.9);
  ref.current = audio;
  audio.onended = () => { if (ref.current === audio) ref.current = null; };
  try {
    await audio.play();
    // Autoplay may reject or resolve after the viewer has paused or swapped
    // the clip. Neither case should consume a reaction cooldown.
    return ref.current === audio && !audio.paused;
  } catch {
    if (ref.current === audio) ref.current = null;
    audio.onended = null;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    return false;
  }
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
  // A ref-only async library load never retriggered the mixer effect when the
  // viewer was otherwise static (for example on its pre-show frame).
  const [library, setLibrary] = useState<GigCrowdSound[]>([]);
  const [isDocumentHidden, setDocumentHidden] = useState(() =>
    typeof document !== "undefined" && document.visibilityState === "hidden",
  );
  const ambientRef = useRef<HTMLAudioElement | null>(null);
  const reactionRef = useRef<HTMLAudioElement | null>(null);
  const lastReactionRef = useRef<string | null>(null);
  const lastPhaseRef = useRef<string | null>(null);
  const lastSongIdRef = useRef<string | null>(null);
  const lastPulseAtRef = useRef(0);
  const reactionCooldownRef = useRef(new CrowdReactionCooldown());
  const pendingReactionRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!enabled) return;

    void loadGigCrowdSounds()
      .then((sounds) => {
        if (cancelled) return;
        setLibrary(sounds);
      })
      .catch(() => {
        if (!cancelled) setLibrary([]);
      });

    return () => { cancelled = true; };
  }, [enabled]);

  useEffect(() => {
    const visibility = () => setDocumentHidden(document.visibilityState === "hidden");
    const pageHide = () => setDocumentHidden(true);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pageHide);
    window.addEventListener("pageshow", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pageHide);
      window.removeEventListener("pageshow", visibility);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !isPlaying || muted || isDocumentHidden || typeof Audio === "undefined") {
      ambientRef.current?.pause();
      reactionRef.current?.pause();
      pendingReactionRef.current = null;
      if (!enabled) {
        // Re-entering the viewer must be able to replay its initial cue.
        lastReactionRef.current = null;
        lastPhaseRef.current = null;
        lastSongIdRef.current = null;
        lastPulseAtRef.current = 0;
        reactionCooldownRef.current.reset();
        pendingReactionRef.current = null;
      }
      return;
    }

    const energy = clamp((snapshot?.crowdEnergy ?? 30) / 100);
    const intensity = crowdSizeIntensity(stageType, energy);
    const phase = showFrame?.phase ?? null;
    const sounds = library;
    const cueTimeMs = Math.max(0, snapshot?.song?.elapsedMs ?? 0);
    const playReaction = (sound: GigCrowdSound | null, level: number) => {
      if (!sound || pendingReactionRef.current ||
          !reactionCooldownRef.current.canPlay(sound.id, cueTimeMs)) return;
      pendingReactionRef.current = sound.id;
      void playClip(reactionRef, sound, level).then(started => {
        if (pendingReactionRef.current !== sound.id) return;
        pendingReactionRef.current = null;
        if (started) reactionCooldownRef.current.record(sound.id, cueTimeMs);
      }).catch(() => {
        // Audio construction itself can reject on unsupported/malformed URLs.
        if (pendingReactionRef.current === sound.id) pendingReactionRef.current = null;
      });
    };

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

    if (!bed && existingBed) {
      // An empty or removed catalogue must not keep an obsolete ambience loop.
      existingBed.pause();
      existingBed.removeAttribute("src");
      existingBed.load();
      ambientRef.current = null;
    } else if (bed && existingUrl !== bed.audio_url) {
      if (existingBed) {
        existingBed.pause();
        existingBed.removeAttribute("src");
        existingBed.load();
      }
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
    // Never mark the first cue as consumed before the async sound catalogue
    // has loaded. Otherwise an initial entrance/applause can be lost forever.
    if (songId && songId !== lastSongIdRef.current && sounds.length > 0) {
      lastSongIdRef.current = songId;
      lastPulseAtRef.current = 0;
      reactionCooldownRef.current.reset();
      const recognition = pickGigCrowdSound(
        sounds,
        ["song_recognition", "crowd_cheer_medium", "crowd_cheer_small"],
        intensity,
        `${songId}:recognition`,
      );
      playReaction(recognition, volume * (0.25 + energy * 0.2));
    }

    const reaction = snapshot?.reaction ?? null;
    if (reaction && reaction !== lastReactionRef.current && sounds.length > 0) {
      lastReactionRef.current = reaction;
      const clip = pickGigCrowdSound(sounds, reactionTypes(reaction, energy), intensity, `${songId ?? "gig"}:${reaction}`);
      playReaction(clip, volume * (0.3 + energy * 0.28));
    }

    if (phase && phase !== lastPhaseRef.current && sounds.length > 0) {
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
        playReaction(clip, volume * (phase === "bows" ? 0.65 : 0.5));
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
      playReaction(pulse, volume * (0.18 + energy * 0.2));
    }
  }, [
    enabled,
    muted,
    volume,
    isPlaying,
    isDocumentHidden,
    library,
    stageType,
    snapshot?.crowdEnergy,
    snapshot?.reaction,
    snapshot?.song?.id,
    snapshot?.song?.elapsedMs,
    showFrame?.phase,
  ]);

  useEffect(() => () => {
    pendingReactionRef.current = null;
    reactionCooldownRef.current.reset();
    for (const audio of [ambientRef.current, reactionRef.current]) {
      if (!audio) continue;
      audio.pause();
      audio.onended = null;
      audio.removeAttribute("src");
      audio.load();
    }
    ambientRef.current = null;
    reactionRef.current = null;
  }, []);
}
