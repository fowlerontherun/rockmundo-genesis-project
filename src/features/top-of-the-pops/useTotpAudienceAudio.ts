import { useEffect, useRef } from "react";
import type { DerivedPlaybackState } from "@/features/gig-experience/viewer/engine/PlaybackController";
import type { TotpBroadcastCue } from "./broadcastTimeline";

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
    ambience.gain.setTargetAtTime(performing ? 0.06 + Math.max(0, reaction) * 0.004 : 0.025, ctx.currentTime, 0.25);

    const cueId = cue?.id ?? null;
    if (cueId && cueId !== lastCueRef.current) {
      lastCueRef.current = cueId;
      if (cue?.type === "performance") playStudioCheer(ctx, master, 0.72 + Math.max(0, reaction) * 0.025, 1.1);
      if (cue?.type === "audience") playStudioCheer(ctx, master, 0.95, 1.8);
    }

    if (performing && playbackState.positionMs - lastPulseRef.current > 18_000) {
      lastPulseRef.current = playbackState.positionMs;
      playStudioCheer(ctx, master, 0.38 + Math.max(0, reaction) * 0.018, 0.65);
    }
  }, [audienceReaction, cue?.id, cue?.type, playbackState.activePhase, playbackState.isPlaying, playbackState.positionMs]);

  useEffect(() => () => {
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
