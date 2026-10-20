import { useEffect, useRef, useState } from "react";
import { CrowdAudioManager, type CrowdPlaybackClip } from "@/features/shared-audio/CrowdAudioManager";
import { useCrowdVolumePreference } from "@/features/shared-audio/CrowdVolumeControl";
import { loadCuratedCrowdAssets, selectCuratedCrowdClip, type CuratedCrowdAsset } from "@/features/shared-audio/crowdAudioCatalogue";
import type { CrowdCategory, CrowdEnvironment, CrowdSize } from "@/features/gig-experience/audio/crowdCueSelection";
import type { StorySnapshot } from "../engine/StoryEngine";
import type { ShowSequenceFrame } from "../engine/ShowSequence";
import { loadGigCrowdSounds, pickGigCrowdSound, type GigCrowdSound, type GigCrowdSoundType } from "./crowdSoundLibrary";

interface CrowdAmbienceOptions {
  enabled: boolean;
  muted: boolean;
  volume: number;
  isPlaying: boolean;
  snapshot: StorySnapshot | null;
  stageType: string;
  replaySeed?: string | number | null;
  showFrame?: ShowSequenceFrame | null;
}
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
function venueContext(stageType: string): { environment: Exclude<CrowdEnvironment, "any">; crowdSize: Exclude<CrowdSize, "any"> } {
  const stage = stageType.toLowerCase();
  if (/stadium|arena/.test(stage)) return { environment: "arena", crowdSize: "large" };
  if (/festival|outdoor/.test(stage)) return { environment: "festival", crowdSize: "large" };
  if (/club|nightclub/.test(stage)) return { environment: "club", crowdSize: "medium" };
  if (/theater|theatre|hall/.test(stage)) return { environment: "indoor", crowdSize: "medium" };
  return { environment: "pub", crowdSize: "small" };
}
function legacyTypes(category: CrowdCategory, energy: number): GigCrowdSoundType[] {
  switch (category) {
    case "ambient": return ["ambient_chatter"];
    case "encore": return ["encore_request", "crowd_singing"];
    case "finale": return ["band_exit", "applause", "crowd_cheer_large"];
    case "applause": return ["applause", "crowd_cheer_medium"];
    case "cheer": return energy > .65
      ? ["crowd_cheer_large", "band_entrance", "crowd_cheer_medium"]
      : ["crowd_cheer_medium", "crowd_cheer_small", "band_entrance"];
    case "reaction": return energy < .25
      ? ["booing", "lighter_moment", "crowd_cheer_small"]
      : ["song_recognition", "crowd_cheer_medium", "applause"];
  }
}
function legacyAsClip(sound: GigCrowdSound, ambient: boolean, level: number): CrowdPlaybackClip {
  return {
    id: sound.id, url: sound.audio_url, loopable: ambient,
    durationSeconds: sound.duration_seconds,
    gainDb: ambient ? -17 : -12 + 3 * clamp(level),
    fadeInMs: ambient ? 700 : 80, fadeOutMs: ambient ? 700 : 200,
  };
}

/** Gig cues and TOTP cues now feed the same isolated Web Audio crowd engine. */
export function useCrowdAmbience({
  enabled, muted, volume, isPlaying, snapshot, stageType, showFrame = null, replaySeed,
}: CrowdAmbienceOptions) {
  const [curated, setCurated] = useState<CuratedCrowdAsset[]>([]);
  const [legacy, setLegacy] = useState<GigCrowdSound[]>([]);
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.visibilityState === "hidden");
  const [crowdPreference] = useCrowdVolumePreference();
  const engineRef = useRef<CrowdAudioManager | null>(null);
  if (!engineRef.current) engineRef.current = new CrowdAudioManager();
  const lastSongRef = useRef<string | null>(null);
  const lastReactionRef = useRef<string | null>(null);
  const lastPhaseRef = useRef<string | null>(null);
  const lastPulseRef = useRef(-1);
  const lastElapsedRef = useRef(-1);
  const historyRef = useRef<Array<{ assetId: string; atSeconds: number }>>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void loadCuratedCrowdAssets().then((value) => { if (!cancelled) setCurated(value); }).catch(() => undefined);
    void loadGigCrowdSounds().then((value) => { if (!cancelled) setLegacy(value); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [enabled]);

  useEffect(() => {
    const sync = () => setHidden(document.visibilityState === "hidden");
    const hide = () => setHidden(true);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", sync);
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current!;
    if (!enabled || muted || !isPlaying || hidden || crowdPreference === 0) {
      engine.stop();
      if (!enabled) {
        lastSongRef.current = lastReactionRef.current = lastPhaseRef.current = null;
        lastPulseRef.current = lastElapsedRef.current = -1;
        historyRef.current = [];
      }
      return;
    }
    const energy = clamp((snapshot?.crowdEnergy ?? 30) / 100);
    const intensity = Math.max(1, Math.min(5, Math.round(2 + 3 * energy)));
    const phase = showFrame?.phase ?? null;
    const elapsedMs = Math.max(0, snapshot?.song?.elapsedMs ?? 0);
    const songId = snapshot?.song?.id ?? null;
    const seed = String(replaySeed ?? stageType);
    const { crowdSize, environment } = venueContext(stageType);
    if (lastElapsedRef.current >= 0 && elapsedMs + 350 < lastElapsedRef.current && songId === lastSongRef.current) {
      lastSongRef.current = lastReactionRef.current = lastPhaseRef.current = null;
      lastPulseRef.current = -1;
      historyRef.current = [];
      engine.stop();
    }
    lastElapsedRef.current = elapsedMs;
    engine.setCrowdVolume(clamp(volume) * crowdPreference);
    engine.setDialogueActive(/banter|talk|dialogue|speech/.test(phase ?? ""));

    const choose = (category: CrowdCategory, cueSeed: string, isBed: boolean): CrowdPlaybackClip | null => {
      const request = {
        category, crowdSize, environment, intensity, seed: cueSeed,
        atSeconds: elapsedMs / 1000, history: historyRef.current, cooldownSeconds: 20,
      };
      const curatedClip = selectCuratedCrowdClip(curated, request);
      if (curatedClip) return curatedClip;
      const old = pickGigCrowdSound(legacy, legacyTypes(category, energy), intensity * 2, cueSeed);
      return old ? legacyAsClip(old, isBed, energy) : null;
    };

    const ambientCategory: CrowdCategory = phase === "encore_break" ? "encore" : "ambient";
    const ambient = choose(ambientCategory, `${seed}:${stageType}:${phase ?? "performance"}:bed`, true);
    void engine.setAmbience(ambient);

    const play = (category: CrowdCategory, cueSeed: string) => {
      const clip = choose(category, cueSeed, false);
      if (!clip) return;
      void engine.playReaction(clip, elapsedMs).then((played) => {
        if (played) historyRef.current.push({ assetId: clip.id, atSeconds: elapsedMs / 1000 });
        historyRef.current = historyRef.current.filter((item) => elapsedMs / 1000 - item.atSeconds < 120).slice(-20);
      });
    };

    if (songId && songId !== lastSongRef.current && (curated.length > 0 || legacy.length > 0)) {
      lastSongRef.current = songId;
      lastPulseRef.current = -1;
      play("cheer", `${seed}:${songId}:recognition`);
    }
    const reaction = snapshot?.reaction ?? null;
    if (reaction && reaction !== lastReactionRef.current) {
      lastReactionRef.current = reaction;
      play(/applaus|clap/i.test(reaction) ? "applause" : "reaction", `${seed}:${songId ?? "gig"}:${reaction}`);
    }
    if (phase && phase !== lastPhaseRef.current) {
      lastPhaseRef.current = phase;
      if (phase === "band_entry") play("cheer", `${seed}:entrance`);
      if (phase === "encore") play("encore", `${seed}:encore`);
      if (phase === "bows") play("finale", `${seed}:finale`);
      if (phase === "load_out") play("applause", `${seed}:exit`);
    }
    if (songId && energy >= .45 && elapsedMs - lastPulseRef.current >= 18000) {
      lastPulseRef.current = elapsedMs;
      play("reaction", `${seed}:${songId}:pulse:${Math.floor(elapsedMs / 18000)}`);
    }
  }, [
    enabled, muted, volume, isPlaying, hidden, crowdPreference, curated, legacy, stageType,
    replaySeed, snapshot?.crowdEnergy, snapshot?.reaction,
    snapshot?.song?.id, snapshot?.song?.elapsedMs, showFrame?.phase,
  ]);

  useEffect(() => () => {
    engineRef.current?.dispose();
    engineRef.current = null;
  }, []);
}
