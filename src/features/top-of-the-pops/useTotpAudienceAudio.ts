import { useEffect, useRef } from "react";
import type { DerivedPlaybackState } from "@/features/gig-experience/viewer/engine/PlaybackController";
import type { TotpBroadcastCue } from "./broadcastTimeline";
import { loadTotpCrowdSounds, pickTotpCrowdSound, type TotpCrowdSound } from "./crowdSoundLibrary";
import { clampTotpGain, totpMixLevels } from "./broadcastAudioMix";

export function useTotpAudienceAudio({
  playbackState,
  cue,
  audienceReaction,
}: {
  playbackState: DerivedPlaybackState;
  cue?: TotpBroadcastCue | null;
  audienceReaction: number;
}) {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const ambienceRef = useRef<GainNode | null>(null);
  const lastCueRef = useRef<string | null>(null);
  const lastPulseRef = useRef(0);
  const libraryRef = useRef<TotpCrowdSound[]>([]);
  const clipRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    void loadTotpCrowdSounds()
      .then((sounds) => { if (!cancelled) libraryRef.current = sounds; })
      .catch(() => { if (!cancelled) libraryRef.current = []; });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!playbackState.isPlaying || typeof window === "undefined") return;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;

    let ctx = ctxRef.current;
    let master = masterRef.current;
    let ambience = ambienceRef.current;

    if (!ctx || ctx.state === "closed" || !master || !ambience) {
      ctx = new AC();
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
    ambience.gain.setTargetAtTime(mix.audienceAmbience, ctx.currentTime, 0.25);

    const cueId = cue?.id ?? null;
    if (cueId && cueId !== lastCueRef.current) {
      lastCueRef.current = cueId;

      if (cue?.type === "performance") {
        const intensity = reaction >= 6 ? 9 : reaction >= 2 ? 7 : 5;
        const clip = pickTotpCrowdSound(
          libraryRef.current,
          reaction >= 6 ? ["crowd_cheer_large", "crowd_cheer_medium"] : ["crowd_cheer_medium", "crowd_cheer_small"],
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
          ["applause", "crowd_cheer_large", "crowd_cheer_medium"],
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
        reaction >= 5 ? ["crowd_cheer_medium", "crowd_singing"] : ["crowd_cheer_small", "crowd_cheer_medium"],
        reaction >= 5 ? 7 : 4,
        `${cueId ?? "performance"}:${Math.floor(playbackState.positionMs / 18_000)}`,
      );
      playApprovedClip(clipRef, clip, .32 + Math.max(0, reaction) * .018)
        .catch(() => playStudioCheer(ctx!, master!, 0.38 + Math.max(0, reaction) * 0.018, 0.65));
      if (!clip) playStudioCheer(ctx, master, 0.38 + Math.max(0, reaction) * 0.018, 0.65);
    }
  }, [audienceReaction, cue?.id, cue?.type, playbackState.activePhase, playbackState.isPlaying, playbackState.positionMs]);

  useEffect(() => () => {
    clipRef.current?.pause();
    clipRef.current = null;
    ctxRef.current?.close().catch(() => undefined);
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
