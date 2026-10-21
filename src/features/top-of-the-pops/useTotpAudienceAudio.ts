import { useEffect, useRef, useState } from "react";
import type { DerivedPlaybackState } from "@/features/gig-experience/viewer/engine/PlaybackController";
import { sharedCrowdAudioManager, type CrowdPlaybackClip } from "@/features/shared-audio/CrowdAudioManager";
import { useCrowdVolumePreference } from "@/features/shared-audio/CrowdVolumeControl";
import { loadCuratedCrowdAssets, selectCuratedCrowdClip, type CuratedCrowdAsset } from "@/features/shared-audio/crowdAudioCatalogue";
import type { CrowdCategory } from "@/features/gig-experience/audio/crowdCueSelection";
import { loadTotpCrowdSounds, pickTotpCrowdSound, type TotpCrowdSound, type TotpCrowdSoundType } from "./crowdSoundLibrary";
import type { TotpBroadcastCue } from "./broadcastTimeline";

function useBroadcastPageVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === "undefined" || document.visibilityState !== "hidden");
  useEffect(() => {
    const sync = () => setVisible(document.visibilityState !== "hidden");
    const hide = () => setVisible(false);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", sync);
    };
  }, []);
  return visible;
}

let broadcastVoiceContext: AudioContext | null = null;
function voiceContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!broadcastVoiceContext || broadcastVoiceContext.state === "closed") broadcastVoiceContext = new AC();
  return broadcastVoiceContext;
}

/** Unlock both voice and crowd graphs inside the user's click gesture. */
export function primeTotpAudioPlayback(): void {
  sharedCrowdAudioManager.prime();
  const ctx = voiceContext();
  if (!ctx) return;
  void ctx.resume().catch(() => undefined);
  const source = ctx.createBufferSource();
  source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  const gain = ctx.createGain();
  gain.gain.value = 0;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
  source.stop(ctx.currentTime + 0.001);
}

const legacyTypes: Record<CrowdCategory, TotpCrowdSoundType[]> = {
  ambient: ["ambient_chatter"],
  applause: ["applause", "crowd_cheer_medium"],
  cheer: ["crowd_cheer_medium", "crowd_cheer_large", "band_entrance", "crowd_cheer_small"],
  encore: ["encore_request", "applause", "crowd_cheer_large"],
  finale: ["applause", "band_exit", "crowd_cheer_large"],
  reaction: ["crowd_cheer_medium", "crowd_cheer_small", "crowd_singing"],
};
function legacyClip(sound: TotpCrowdSound, ambient: boolean): CrowdPlaybackClip {
  return {
    id: sound.id, url: sound.audio_url, loopable: ambient,
    gainDb: ambient ? -19 : -11, fadeInMs: ambient ? 600 : 80, fadeOutMs: ambient ? 600 : 180,
    durationSeconds: sound.duration_seconds,
  };
}
function chooseClip(
  curated: CuratedCrowdAsset[], legacy: TotpCrowdSound[], category: CrowdCategory,
  intensity: number, seed: string, atSeconds: number,
  history: ReadonlyArray<{ assetId: string; atSeconds: number }>,
): CrowdPlaybackClip | null {
  const chosen = selectCuratedCrowdClip(curated, {
    category, crowdSize: "medium", environment: "studio",
    intensity, seed, atSeconds, history, cooldownSeconds: 20,
  });
  if (chosen) return chosen;
  const old = pickTotpCrowdSound(legacy, legacyTypes[category], intensity * 2, seed);
  return old ? legacyClip(old, category === "ambient") : null;
}

export function useTotpAudienceAudio({
  playbackState, cue, audienceReaction, enabled = true,
}: {
  playbackState: DerivedPlaybackState;
  cue?: TotpBroadcastCue | null;
  audienceReaction: number;
  enabled?: boolean;
}) {
  const [legacy, setLegacy] = useState<TotpCrowdSound[]>([]);
  const [curated, setCurated] = useState<CuratedCrowdAsset[]>([]);
  const [loaded, setLoaded] = useState(false);
  const visible = useBroadcastPageVisible();
  const [volume] = useCrowdVolumePreference();
  const ownerRef = useRef(Symbol("totp-episode"));
  const lastCueRef = useRef<string | null>(null);
  const lastPulseRef = useRef(-1);
  const lastPositionRef = useRef(-1);
  const historyRef = useRef<Array<{ assetId: string; atSeconds: number }>>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoaded(false);
    void Promise.all([
      loadTotpCrowdSounds().catch(() => [] as TotpCrowdSound[]),
      loadCuratedCrowdAssets().catch(() => [] as CuratedCrowdAsset[]),
    ]).then(([oldSounds, newSounds]) => {
      if (cancelled) return;
      setLegacy(oldSounds);
      setCurated(newSounds);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [enabled]);

  useEffect(() => {
    const manager = sharedCrowdAudioManager;
    const owner = ownerRef.current;
    if (!enabled || !visible || !playbackState.isPlaying || volume === 0) {
      manager.releaseOwner(owner);
      if (!enabled) {
        lastCueRef.current = null;
        lastPulseRef.current = lastPositionRef.current = -1;
        historyRef.current = [];
      }
      return;
    }
    manager.claim(owner);
    manager.setCrowdVolume(volume);
    manager.setDialogueActive(cue?.type === "presenter");
    const pos = Math.max(0, playbackState.positionMs);
    if (lastPositionRef.current >= 0 && pos < lastPositionRef.current - 250) {
      manager.stop();
      lastCueRef.current = null;
      lastPulseRef.current = -1;
      historyRef.current = [];
    }
    lastPositionRef.current = pos;
    if (!loaded) return;
    const intensity = Math.max(1, Math.min(5, Math.round((audienceReaction + 10) / 5) + 1));
    const key = cue?.id ?? playbackState.activePhase;
    const pick = (category: CrowdCategory, suffix: string) =>
      chooseClip(curated, legacy, category, intensity, `${key}:${suffix}`, pos / 1000, historyRef.current);
    const bed = pick("ambient", "studio-bed");
    void manager.setAmbience(bed);

    const react = (category: CrowdCategory, suffix: string) => {
      const clip = pick(category, suffix);
      if (!clip) return;
      void manager.playReaction(clip, pos).then((played) => {
        if (played) historyRef.current.push({ assetId: clip.id, atSeconds: pos / 1000 });
        historyRef.current = historyRef.current.filter((hit) => pos / 1000 - hit.atSeconds < 120).slice(-20);
      });
    };

    if (cue?.id && cue.id !== lastCueRef.current) {
      lastCueRef.current = cue.id;
      if (cue.type === "presenter") react("cheer", "presenter-entrance");
      if (cue.type === "performance") react("cheer", "act-entrance");
      if (cue.type === "audience") react(audienceReaction >= 7 ? "finale" : "applause", "audience-reaction");
      if (cue.type === "graphic" && /number.?one|number.?1|chart.?milestone/i.test(JSON.stringify(cue.graphic ?? {}))) {
        react("reaction", "chart-milestone");
      }
    }
    if (cue?.type === "performance" && pos - lastPulseRef.current >= 18000) {
      lastPulseRef.current = pos;
      react("reaction", `performance-pulse-${Math.floor(pos / 18000)}`);
    }
  }, [
    enabled, visible, volume, loaded, curated, legacy, audienceReaction,
    cue?.id, cue?.type, cue?.graphic, playbackState.positionMs,
    playbackState.isPlaying, playbackState.activePhase,
  ]);
  useEffect(() => () => { sharedCrowdAudioManager.releaseOwner(ownerRef.current); }, []);
}

/** Presenter interstitials, chart rundowns and credits share the same crowd graph. */
export function useTotpContinuityAudienceAudio({
  active, seed, intensity = 5,
}: { active: boolean; seed: string; intensity?: number }) {
  const [volume] = useCrowdVolumePreference();
  const visible = useBroadcastPageVisible();
  const ownerRef = useRef(Symbol("totp-continuity"));

  useEffect(() => {
    const manager = sharedCrowdAudioManager;
    const owner = ownerRef.current;
    if (!active || !visible || volume === 0) {
      manager.releaseOwner(owner);
      return;
    }
    manager.claim(owner);
    manager.setCrowdVolume(volume);
    manager.setDialogueActive(true);
    let cancelled = false;
    void Promise.all([
      loadTotpCrowdSounds().catch(() => [] as TotpCrowdSound[]),
      loadCuratedCrowdAssets().catch(() => [] as CuratedCrowdAsset[]),
    ]).then(([legacy, curated]) => {
      if (cancelled) return;
      const bed = chooseClip(curated, legacy, "ambient", Math.max(1, Math.min(5, Math.round(intensity / 2))), `${seed}:bed`, 0, []);
      const cheer = chooseClip(curated, legacy, "applause", Math.max(1, Math.min(5, Math.round(intensity / 2))), `${seed}:audience`, 1, []);
      void manager.setAmbience(bed);
      if (cheer) void manager.playReaction(cheer, 1000);
    });
    return () => {
      cancelled = true;
      manager.releaseOwner(owner);
    };
  }, [active, visible, volume, seed, intensity]);
}
