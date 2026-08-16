import { useEffect, useRef } from "react";
import type { VenueAmbiencePlan } from "../engine/VenueAmbiencePlan";

interface VenueAmbienceOptions {
  /** Opt-in ambience toggle (separate from the setlist audio switch). */
  enabled: boolean;
  muted: boolean;
  volume: number;
  isPlaying: boolean;
  plan: VenueAmbiencePlan | null;
}

/**
 * Phase 6 ambience buses. Each bus in the plan becomes one filtered noise voice
 * beneath music and crowd audio. The graph is created once per activation and
 * only bus gains are retargeted afterwards, so there is no allocation in the
 * frame loop. Nodes are torn down on disable, pause, hidden tab and unmount.
 */
export function useVenueAmbience({ enabled, muted, volume, isPlaying, plan }: VenueAmbienceOptions) {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const busRef = useRef<Map<string, { gain: GainNode; filter: BiquadFilterNode; source: AudioBufferSourceNode }>>(new Map());
  const hiddenRef = useRef(false);

  useEffect(() => {
    if (!enabled || !isPlaying || !plan || plan.buses.length === 0) {
      teardown();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;

    const ctx = new AC();
    ctxRef.current = ctx;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    masterRef.current = master;

    const noise = createNoiseBuffer(ctx);
    for (const bus of plan.buses) {
      const source = ctx.createBufferSource();
      source.buffer = noise;
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = bus.centreHz > 1500 ? "highpass" : "bandpass";
      filter.frequency.value = bus.centreHz;
      filter.Q.value = 0.8;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
      busRef.current.set(bus.id, { gain, filter, source });
    }

    return () => teardown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isPlaying, plan?.buses.length]);

  // Level updates only retarget existing gains.
  useEffect(() => {
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (!ctx || !master || !plan) return;
    const now = ctx.currentTime;
    const target = muted || hiddenRef.current ? 0 : Math.max(0, Math.min(1, volume)) * 0.35;
    master.gain.setTargetAtTime(target, now, 0.4);
    for (const bus of plan.buses) {
      const node = busRef.current.get(bus.id);
      if (!node) continue;
      node.gain.gain.setTargetAtTime(bus.level, now, plan.reducedMotion ? 0.8 : 0.35);
      node.filter.frequency.setTargetAtTime(bus.centreHz, now, 0.6);
    }
  }, [plan, muted, volume]);

  useEffect(() => {
    const onVisibility = () => {
      hiddenRef.current = document.visibilityState === "hidden";
      const ctx = ctxRef.current;
      const master = masterRef.current;
      if (!ctx || !master) return;
      master.gain.setTargetAtTime(hiddenRef.current ? 0 : Math.max(0, Math.min(1, volume)) * 0.35, ctx.currentTime, 0.2);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume]);

  function teardown() {
    for (const node of busRef.current.values()) {
      try { node.source.stop(); } catch { /* already stopped */ }
      node.source.disconnect();
      node.filter.disconnect();
      node.gain.disconnect();
    }
    busRef.current.clear();
    masterRef.current?.disconnect();
    masterRef.current = null;
    ctxRef.current?.close().catch(() => { /* context already closed */ });
    ctxRef.current = null;
  }
}

function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}
