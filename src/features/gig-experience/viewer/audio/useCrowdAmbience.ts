import { useEffect, useRef } from "react";
import type { StorySnapshot } from "../engine/StoryEngine";

interface CrowdAmbienceOptions {
  enabled: boolean;
  muted: boolean;
  volume: number;
  isPlaying: boolean;
  snapshot: StorySnapshot | null;
  stageType: string;
}

/**
 * Synthesizes ambient crowd sounds using the Web Audio API. Uses pink noise
 * filtered through a bandpass to emulate crowd murmur, gain scaled by crowd
 * energy, and periodic cheer/applause bursts triggered by reactions.
 * No audio assets required — driven entirely from the existing crowd state
 * (energy, reaction, finaleActive) already tracked by the gig replay engine.
 */
export function useCrowdAmbience({ enabled, muted, volume, isPlaying, snapshot, stageType }: CrowdAmbienceOptions) {
  const ctxRef = useRef<AudioContext | null>(null);
  const noiseRef = useRef<AudioBufferSourceNode | null>(null);
  const bandpassRef = useRef<BiquadFilterNode | null>(null);
  const ambienceGainRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const cheerGainRef = useRef<GainNode | null>(null);
  const lastCheerAtRef = useRef<number>(0);
  const lastReactionRef = useRef<string | null>(null);

  // Setup / teardown
  useEffect(() => {
    if (!enabled || !isPlaying) {
      teardown();
      return;
    }
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return;
    const ctx = new AC();
    ctxRef.current = ctx;

    // Pink noise buffer (Voss-McCartney approximation)
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 480;
    bandpass.Q.value = 0.9;

    const shelf = ctx.createBiquadFilter();
    shelf.type = "lowshelf";
    shelf.frequency.value = 200;
    shelf.gain.value = 3;

    const ambienceGain = ctx.createGain();
    ambienceGain.gain.value = 0;

    const cheerGain = ctx.createGain();
    cheerGain.gain.value = 0;

    const master = ctx.createGain();
    master.gain.value = muted ? 0 : Math.max(0, Math.min(1, volume));

    noise.connect(shelf);
    shelf.connect(bandpass);
    bandpass.connect(ambienceGain);
    ambienceGain.connect(master);
    cheerGain.connect(master);
    master.connect(ctx.destination);

    noise.start();

    noiseRef.current = noise;
    bandpassRef.current = bandpass;
    ambienceGainRef.current = ambienceGain;
    cheerGainRef.current = cheerGain;
    masterGainRef.current = master;

    return () => teardown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isPlaying]);

  // Reactive parameter updates from snapshot
  useEffect(() => {
    const ctx = ctxRef.current; const ambience = ambienceGainRef.current; const bp = bandpassRef.current; const master = masterGainRef.current; const cheer = cheerGainRef.current;
    if (!ctx || !ambience || !bp || !master || !cheer) return;

    const now = ctx.currentTime;
    master.gain.setTargetAtTime(muted ? 0 : Math.max(0, Math.min(1, volume)) * 0.6, now, 0.15);

    const energy = snapshot ? Math.max(0, Math.min(100, snapshot.crowdEnergy)) / 100 : 0.3;
    // Stage type modifies size/reverb feel via bandpass width
    const typeMod = stageType === "club" ? 0.75 : stageType === "theater" ? 0.85 : stageType === "arena" ? 1.1 : stageType === "stadium" ? 1.25 : stageType === "festival" ? 1.15 : 1;
    const targetLevel = (0.06 + energy * 0.32) * typeMod;
    ambience.gain.setTargetAtTime(targetLevel, now, 0.5);
    bp.frequency.setTargetAtTime(360 + energy * 620, now, 0.6);
    bp.Q.setTargetAtTime(0.7 + energy * 0.6, now, 0.6);

    // Trigger a cheer burst on qualifying reactions
    const reaction = snapshot?.reaction ?? null;
    const shouldCheer = snapshot && (
      (reaction === "cheer_pulse" && lastReactionRef.current !== "cheer_pulse") ||
      (snapshot.finaleActive && energy >= 0.75 && now - lastCheerAtRef.current > 4.5) ||
      (reaction === "jump" && lastReactionRef.current !== "jump" && energy >= 0.6)
    );
    lastReactionRef.current = reaction;

    if (shouldCheer && now - lastCheerAtRef.current > 1.2) {
      lastCheerAtRef.current = now;
      playCheer(ctx, cheer, energy, typeMod);
    }
  }, [snapshot?.crowdEnergy, snapshot?.reaction, snapshot?.finaleActive, muted, volume, stageType, snapshot]);

  function teardown() {
    try { noiseRef.current?.stop(); } catch { /* noop */ }
    noiseRef.current?.disconnect();
    bandpassRef.current?.disconnect();
    ambienceGainRef.current?.disconnect();
    cheerGainRef.current?.disconnect();
    masterGainRef.current?.disconnect();
    ctxRef.current?.close().catch(() => { /* noop */ });
    noiseRef.current = null; bandpassRef.current = null; ambienceGainRef.current = null; cheerGainRef.current = null; masterGainRef.current = null; ctxRef.current = null;
  }
}

function playCheer(ctx: AudioContext, out: GainNode, intensity: number, typeMod: number) {
  const now = ctx.currentTime;
  const duration = 1.2 + intensity * 1.4;

  // White noise burst shaped as applause + cheer
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize;
    // Clap-like transient density modulated over time
    const clapDensity = 0.35 + (1 - t) * 0.55;
    const clap = Math.random() < clapDensity * 0.15 ? (Math.random() * 2 - 1) * 0.9 : 0;
    const roar = (Math.random() * 2 - 1) * 0.35;
    data[i] = clap + roar;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 380;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 3600;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, now);
  const peak = (0.35 + intensity * 0.55) * typeMod;
  env.gain.exponentialRampToValueAtTime(peak, now + 0.06);
  env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  src.connect(hp); hp.connect(lp); lp.connect(env); env.connect(out);
  src.start(now);
  src.stop(now + duration + 0.05);
}
