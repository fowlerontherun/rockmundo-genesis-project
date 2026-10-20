import { CrowdReactionCooldown } from "./crowdAudioSelection";

/** One Web Audio graph per active viewer; other music/dialogue buses remain isolated. */
export type CrowdAudioBus = "music" | "dialogue" | "ambience" | "reaction" | "stageFx" | "ui";
export interface CrowdPlaybackClip {
  id: string;
  url: string;
  loopable?: boolean;
  gainDb?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  cueStartSeconds?: number;
  cueEndSeconds?: number | null;
  durationSeconds?: number | null;
}
interface Slot {
  clip: CrowdPlaybackClip;
  audio: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  stopTimer?: ReturnType<typeof setTimeout>;
}
const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, Number.isFinite(n) ? n : low));
const dbToGain = (db: number) => Math.pow(10, clamp(db, -60, 6) / 20);

export class CrowdAudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Partial<Record<CrowdAudioBus, GainNode>> = {};
  private limiter: DynamicsCompressorNode | null = null;
  private ambient: Slot | null = null;
  private reaction: Slot | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private cooldown = new CrowdReactionCooldown();
  private volume = 0.6;
  private speaking = false;
  private generation = 0;
  private ambienceEpoch = 0;
  private reactionEpoch = 0;
  private pendingAmbienceId: string | null = null;
  private pendingReactionId: string | null = null;
  private owner: symbol | null = null;

  claim(owner: symbol): void {
    if (this.owner === owner) return;
    this.stop();
    this.owner = owner;
  }

  releaseOwner(owner: symbol): void {
    if (this.owner !== owner) return;
    this.stop();
    this.owner = null;
  }

  /** Call on the explicit user Play gesture, before asynchronous cue loading. */
  prime(): void {
    const context = this.ensureGraph();
    if (context && context.state !== "running") void context.resume().catch(() => undefined);
  }

  private ensureGraph(): AudioContext | null {
    if (this.ctx?.state !== "closed" && this.ctx) return this.ctx;
    if (typeof window === "undefined") return null;
    const AC = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -9;
    limiter.knee.value = 9;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    master.connect(limiter);
    limiter.connect(ctx.destination);
    const buses: Partial<Record<CrowdAudioBus, GainNode>> = {};
    for (const name of ["music", "dialogue", "ambience", "reaction", "stageFx", "ui"] as const) {
      buses[name] = ctx.createGain();
      buses[name]!.connect(master);
    }
    // Headroom for multiple signals, even when the audio asset is normalized.
    master.gain.value = 0.7;
    this.ctx = ctx;
    this.master = master;
    this.limiter = limiter;
    this.buses = buses;
    this.refreshCrowdGains();
    return ctx;
  }

  private refreshCrowdGains(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const [name, duck] of [["ambience", 0.28], ["reaction", 0.4]] as const) {
      const bus = this.buses[name];
      if (!bus) continue;
      bus.gain.setTargetAtTime(this.volume * (this.speaking ? duck : 1), now, 0.09);
    }
  }

  /** Does not modify music, dialogue, stage FX or UI volume. */
  setCrowdVolume(volume: number): void {
    this.volume = clamp(volume, 0, 1);
    this.refreshCrowdGains();
  }

  /** Duck crowd buses for presenter links and between-song speech. */
  setDialogueActive(active: boolean): void {
    this.speaking = active;
    this.refreshCrowdGains();
  }

  private createSlot(clip: CrowdPlaybackClip, busName: "ambience" | "reaction"): Slot | null {
    const ctx = this.ensureGraph();
    const bus = this.buses[busName];
    if (!ctx || !bus || typeof Audio === "undefined" || !/^https:\/\//.test(clip.url)) return null;
    const audio = new Audio(clip.url);
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    audio.loop = !!clip.loopable && !clip.cueEndSeconds;
    const start = Math.max(0, clip.cueStartSeconds ?? 0);
    if (start) audio.addEventListener("loadedmetadata", () => { audio.currentTime = start; }, { once: true });
    if (clip.loopable && clip.cueEndSeconds && clip.cueEndSeconds > start) {
      audio.addEventListener("timeupdate", () => {
        if (audio.currentTime >= clip.cueEndSeconds!) audio.currentTime = start;
      });
    }
    const source = ctx.createMediaElementSource(audio);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(bus);
    return { clip, audio, source, gain };
  }

  private schedule(task: () => void, ms: number): ReturnType<typeof setTimeout> {
    const handle = setTimeout(() => {
      this.timers.delete(handle);
      task();
    }, ms);
    this.timers.add(handle);
    return handle;
  }

  private fadeIn(slot: Slot): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    slot.gain.gain.cancelScheduledValues(now);
    slot.gain.gain.setValueAtTime(0, now);
    slot.gain.gain.linearRampToValueAtTime(dbToGain(slot.clip.gainDb ?? -9), now + clamp(slot.clip.fadeInMs ?? 100, 0, 10000) / 1000);
  }

  private release(slot: Slot, fadeOutMs = 0): void {
    if (slot.stopTimer) {
      clearTimeout(slot.stopTimer);
      this.timers.delete(slot.stopTimer);
      slot.stopTimer = undefined;
    }
    if (fadeOutMs && this.ctx && this.ctx.state !== "closed") {
      const now = this.ctx.currentTime;
      slot.gain.gain.cancelScheduledValues(now);
      slot.gain.gain.setValueAtTime(slot.gain.gain.value, now);
      slot.gain.gain.linearRampToValueAtTime(0, now + fadeOutMs / 1000);
      slot.stopTimer = this.schedule(() => this.release(slot), fadeOutMs + 20);
      return;
    }
    slot.audio.onended = null;
    slot.audio.pause();
    slot.audio.removeAttribute("src");
    slot.audio.load();
    slot.source.disconnect();
    slot.gain.disconnect();
  }

  /** Crossfade one loop into another; never leave two sustained ambience sources. */
  async setAmbience(clip: CrowdPlaybackClip | null): Promise<boolean> {
    if (!clip) {
      this.ambienceEpoch += 1;
      this.pendingAmbienceId = null;
      const previous = this.ambient;
      this.ambient = null;
      if (previous) this.release(previous, clamp(previous.clip.fadeOutMs ?? 250, 0, 10000));
      return false;
    }
    if (this.ambient?.clip.id === clip.id || this.pendingAmbienceId === clip.id) return true;
    const epoch = ++this.ambienceEpoch;
    this.pendingAmbienceId = clip.id;
    const slot = this.createSlot({ ...clip, loopable: true }, "ambience");
    if (!slot) { this.pendingAmbienceId = null; return false; }
    const generation = this.generation;
    try {
      await slot.audio.play();
      if (generation !== this.generation || epoch !== this.ambienceEpoch) { this.release(slot); return false; }
      this.pendingAmbienceId = null;
      const previous = this.ambient;
      this.ambient = slot;
      this.fadeIn(slot);
      if (previous) this.release(previous, clamp(previous.clip.fadeOutMs ?? 250, 0, 10000));
      return true;
    } catch {
      if (epoch === this.ambienceEpoch) this.pendingAmbienceId = null;
      this.release(slot);
      return false;
    }
  }

  /** At most one foreground reaction. History uses replay cue time, never wall-clock. */
  async playReaction(clip: CrowdPlaybackClip | null, cueTimeMs: number, cooldownMs = 15000): Promise<boolean> {
    if (!clip || this.pendingReactionId === clip.id || !this.cooldown.canPlay(clip.id, cueTimeMs, cooldownMs)) return false;
    const epoch = ++this.reactionEpoch;
    this.pendingReactionId = clip.id;
    const slot = this.createSlot({ ...clip, loopable: false }, "reaction");
    if (!slot) { this.pendingReactionId = null; return false; }
    const generation = this.generation;
    try {
      await slot.audio.play();
      if (generation !== this.generation || epoch !== this.reactionEpoch) { this.release(slot); return false; }
      this.pendingReactionId = null;
      const previous = this.reaction;
      this.reaction = slot;
      this.fadeIn(slot);
      if (previous) this.release(previous, Math.min(200, clamp(previous.clip.fadeOutMs ?? 150, 0, 10000)));
      this.cooldown.record(clip.id, cueTimeMs);
      slot.audio.onended = () => {
        if (this.reaction === slot) this.reaction = null;
        this.release(slot);
      };
      const remaining = (clip.cueEndSeconds ?? clip.durationSeconds ?? 0) - (clip.cueStartSeconds ?? 0);
      if (remaining > 0) {
        slot.stopTimer = this.schedule(() => {
          if (this.reaction === slot) this.reaction = null;
          this.release(slot, Math.min(250, clamp(clip.fadeOutMs ?? 150, 0, 10000)));
        }, remaining * 1000);
      }
      return true;
    } catch {
      if (epoch === this.reactionEpoch) this.pendingReactionId = null;
      this.release(slot);
      return false;
    }
  }

  /** Pausing, seeking out, switching viewers or navigating away kills all active sources. */
  stop(): void {
    this.generation += 1;
    this.ambienceEpoch += 1;
    this.reactionEpoch += 1;
    this.pendingAmbienceId = null;
    this.pendingReactionId = null;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    if (this.ambient) this.release(this.ambient);
    if (this.reaction) this.release(this.reaction);
    this.ambient = this.reaction = null;
    this.cooldown.reset();
  }

  dispose(): void {
    this.stop();
    for (const bus of Object.values(this.buses)) bus?.disconnect();
    this.master?.disconnect();
    this.limiter?.disconnect();
    if (this.ctx?.state !== "closed") void this.ctx?.close().catch(() => undefined);
    this.ctx = this.master = this.limiter = null;
    this.buses = {};
  }
}

/** One running crowd graph shared by gigs, studio broadcasts and preview tools. */
export const sharedCrowdAudioManager = new CrowdAudioManager();
