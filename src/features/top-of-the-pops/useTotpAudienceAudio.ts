import { useEffect, useRef } from "react";
import type { DerivedPlaybackState } from "@/features/gig-experience/viewer/engine/PlaybackController";
import type { TotpBroadcastCue } from "./broadcastTimeline";
import { loadTotpCrowdSounds, pickTotpCrowdSound, type TotpCrowdSound } from "./crowdSoundLibrary";
import { clampTotpGain, totpMixLevels } from "./broadcastAudioMix";

let sharedTotpAudioContext: AudioContext | null = null;

function totpAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!sharedTotpAudioContext || sharedTotpAudioContext.state === "closed") sharedTotpAudioContext = new AC();
  return sharedTotpAudioContext;
}

/**
 * Call directly from the user's Play gesture. Keeping one shared running
 * context prevents later presenter/crowd cues from being muted when browsers
 * revoke transient user activation before those segments begin.
 */
export function primeTotpAudioPlayback(): void {
  const ctx = totpAudioContext();
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

export function useTotpAudienceAudio({
  playbackState,
  cue,
  audienceReaction,
  enabled = true,
}: {
  playbackState: DerivedPlaybackState;
  cue?: TotpBroadcastCue | null;
  audienceReaction: number;
  enabled?: boolean;
}) {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const ambienceRef = useRef<GainNode | null>(null);
  const lastCueRef = useRef<string | null>(null);
  const lastPulseRef = useRef(0);
  const libraryRef = useRef<TotpCrowdSound[]>([]);
  const clipRef = useRef<HTMLAudioElement | null>(null);
  const ambienceClipRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let cancelled = false;
    void loadTotpCrowdSounds()
      .then((sounds) => {
        if (cancelled) return;
        libraryRef.current = sounds;
        const bed = pickTotpCrowdSound(
          sounds,
          ["ambient_chatter", "band_entrance"],
          4,
          "totp:studio-bed",
        );
        if (bed && typeof Audio !== "undefined") {
          const audio = new Audio(bed.audio_url);
          audio.preload = "auto";
          audio.loop = true;
          audio.volume = 0.14;
          ambienceClipRef.current = audio;
        }
      })
      .catch(() => { if (!cancelled) libraryRef.current = []; });
    return () => { cancelled = true; };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !playbackState.isPlaying || typeof window === "undefined") return;
    let ctx = ctxRef.current ?? totpAudioContext();
    if (!ctx) return;
    let master = masterRef.current;
    let ambience = ambienceRef.current;

    if (ctx.state === "closed" || !master || !ambience) {
      ctx = totpAudioContext();
      if (!ctx) return;
      master = ctx.createGain();
      master.gain.value = 0.24;
      ambience = ctx.createGain();
      ambience.gain.value = 0;
      master.connect(ctx.destination);
      ambience.connect(master);

      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        const white = Math.random() * 2 - 1;
        data[i] = white * 0.16;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 520;
      filter.Q.value = 0.75;
      src.connect(filter);
      filter.connect(ambience);
      src.start();
      ctxRef.current = ctx;
      masterRef.current = master;
      ambienceRef.current = ambience;
    }

    void ctx.resume().catch(() => undefined);
    const reaction = Math.max(-10, Math.min(10, audienceReaction));
    const performing = cue?.type === "performance" || playbackState.activePhase.includes("performance");
    const mix = totpMixLevels(cue?.type, reaction);
    ambience.gain.setTargetAtTime(Math.max(0.10, mix.audienceAmbience * 2.4), ctx.currentTime, 0.25);

    const recordedBed = ambienceClipRef.current;
    if (recordedBed) {
      recordedBed.volume = cue?.type === "presenter" ? 0.11 : performing ? 0.18 : 0.14;
      if (recordedBed.paused) void recordedBed.play().catch(() => undefined);
    }

    const cueId = cue?.id ?? null;
    if (cueId && cueId !== lastCueRef.current) {
      lastCueRef.current = cueId;

      if (cue?.type === "presenter" || cue?.type === "graphic" || cue?.type === "audience") {
        playBroadcastSting(ctx, master, clampTotpGain(mix.transitionSting), cue.type);
      }

      if (cue?.type === "performance") {
        const intensity = reaction >= 6 ? 9 : reaction >= 2 ? 7 : 5;
        const clip = pickTotpCrowdSound(
          libraryRef.current,
          reaction >= 6 ? ["crowd_cheer_large", "crowd_cheer_medium", "band_entrance"] : ["crowd_cheer_medium", "crowd_cheer_small", "band_entrance"],
          intensity,
          `${cueId}:entrance`,
        );
        const hit = clampTotpGain(mix.audienceHit);
        playApprovedClip(clipRef, clip, hit)
          .catch(() => playStudioCheer(ctx!, master!, hit, 1.1));
        if (!clip) playStudioCheer(ctx, master, hit, 1.1);
      }

      if (cue?.type === "audience") {
        const clip = pickTotpCrowdSound(
          libraryRef.current,
          ["applause", "crowd_cheer_large", "crowd_cheer_medium", "band_entrance"],
          9,
          `${cueId}:applause`,
        );
        const hit = clampTotpGain(mix.audienceHit);
        playApprovedClip(clipRef, clip, hit)
          .catch(() => playStudioCheer(ctx!, master!, hit, 1.8));
        if (!clip) playStudioCheer(ctx, master, hit, 1.8);
      }
    }

    if (performing && playbackState.positionMs - lastPulseRef.current > 18_000) {
      lastPulseRef.current = playbackState.positionMs;
      const clip = pickTotpCrowdSound(
        libraryRef.current,
        reaction >= 5 ? ["crowd_cheer_medium", "crowd_singing", "band_entrance"] : ["crowd_cheer_small", "crowd_cheer_medium", "band_entrance"],
        reaction >= 5 ? 7 : 4,
        `${cueId ?? "performance"}:${Math.floor(playbackState.positionMs / 18_000)}`,
      );
      playApprovedClip(clipRef, clip, .32 + Math.max(0, reaction) * .018)
        .catch(() => playStudioCheer(ctx!, master!, 0.38 + Math.max(0, reaction) * 0.018, 0.65));
      if (!clip) playStudioCheer(ctx, master, 0.38 + Math.max(0, reaction) * 0.018, 0.65);
    }
  }, [audienceReaction, cue?.id, cue?.type, enabled, playbackState.activePhase, playbackState.isPlaying, playbackState.positionMs]);

  useEffect(() => () => {
    clipRef.current?.pause();
    clipRef.current = null;
    ambienceClipRef.current?.pause();
    ambienceClipRef.current = null;
    ctxRef.current = null;
    masterRef.current = null;
    ambienceRef.current = null;
  }, []);
}

function playStudioCheer(ctx: AudioContext, out: AudioNode, intensity: number, duration: number) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    const p = i / length;
    const envelope = Math.sin(Math.min(1, p * 5) * Math.PI / 2) * Math.pow(1 - p, .55);
    const clap = Math.random() < .055 ? (Math.random() * 2 - 1) * 1.4 : 0;
    const roar = (Math.random() * 2 - 1) * .45;
    data[i] = (clap + roar) * envelope;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 280;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 4200;
  const gain = ctx.createGain();
  gain.gain.value = Math.max(.08, Math.min(.9, intensity));
  src.connect(hp);
  hp.connect(lp);
  lp.connect(gain);
  gain.connect(out);
  src.start();
}


async function playApprovedClip(
  clipRef: { current: HTMLAudioElement | null },
  sound: TotpCrowdSound | null,
  volume: number,
) {
  if (!sound || typeof Audio === "undefined") return;
  clipRef.current?.pause();
  const audio = new Audio(sound.audio_url);
  audio.preload = "auto";
  audio.volume = Math.max(.08, Math.min(.9, volume));
  clipRef.current = audio;
  audio.onended = () => { if (clipRef.current === audio) clipRef.current = null; };
  await audio.play();
}


function playBroadcastSting(
  ctx: AudioContext,
  out: AudioNode,
  intensity: number,
  kind: "presenter" | "graphic" | "audience",
) {
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = kind === "audience" ? 1600 : 2400;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.02, intensity), now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
  filter.connect(gain);
  gain.connect(out);

  const frequencies = kind === "graphic" ? [440, 660] : kind === "audience" ? [220, 330] : [330, 495];
  frequencies.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    oscillator.type = index === 0 ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.08, now + 0.28);
    oscillator.connect(filter);
    oscillator.start(now + index * 0.018);
    oscillator.stop(now + 0.36);
  });
}

export function useTotpContinuityAudienceAudio({
  active,
  seed,
  intensity = 5,
}: {
  active: boolean;
  seed: string;
  intensity?: number;
}) {
  const ambientRef = useRef<HTMLAudioElement | null>(null);
  const reactionRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    ambientRef.current?.pause();
    reactionRef.current?.pause();
    ambientRef.current = null;
    reactionRef.current = null;
    if (!active || typeof Audio === "undefined") return;

    let cancelled = false;
    void loadTotpCrowdSounds().then((sounds) => {
      if (cancelled) return;

      const ambient = pickTotpCrowdSound(
        sounds,
        ["ambient_chatter", "band_entrance"],
        Math.max(2, intensity - 2),
        `${seed}:presenter-bed`,
      );
      if (ambient) {
        const audio = new Audio(ambient.audio_url);
        audio.preload = "auto";
        audio.loop = true;
        audio.volume = 0.14;
        ambientRef.current = audio;
        void audio.play().catch(() => undefined);
      }

      const reaction = pickTotpCrowdSound(
        sounds,
        intensity >= 8 ? ["applause", "crowd_cheer_large", "crowd_cheer_medium", "band_entrance"] : ["applause", "crowd_cheer_medium", "crowd_cheer_small", "band_entrance"],
        intensity,
        `${seed}:presenter-reaction`,
      );
      if (reaction) {
        const audio = new Audio(reaction.audio_url);
        audio.preload = "auto";
        audio.volume = Math.min(0.42, 0.22 + intensity * 0.02);
        reactionRef.current = audio;
        window.setTimeout(() => {
          if (!cancelled) void audio.play().catch(() => undefined);
        }, 250);
      }
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      ambientRef.current?.pause();
      reactionRef.current?.pause();
      ambientRef.current = null;
      reactionRef.current = null;
    };
  }, [active, intensity, seed]);
}
