import type { ResolvedGigAudioSource } from "./audioSourceResolver";
export type GigAudioLoadStatus = "idle" | "loading" | "ready" | "playing" | "paused" | "unavailable" | "error";
export class GigAudioController {
  private audio: HTMLAudioElement | null = null; private sourceKey = ""; private stopAt = 0;
  status: GigAudioLoadStatus = "idle"; error: string | null = null;
  load(source: ResolvedGigAudioSource, volume: number, muted: boolean) {
    const key = `${source.songId}:${source.url}:${source.excerptStartSeconds}`;
    if (!source.available || !source.url) { this.stop(); this.status = "unavailable"; return; }
    if (this.audio && this.sourceKey === key) return;
    this.stop(); this.sourceKey = key; this.audio = new Audio(source.url); this.audio.preload = "metadata"; this.audio.volume = muted ? 0 : volume; this.audio.muted = muted; this.audio.currentTime = source.excerptStartSeconds; this.stopAt = source.excerptStartSeconds + source.excerptDurationSeconds; this.status = "loading";
    this.audio.addEventListener("canplay", () => { this.status = "ready"; });
    this.audio.addEventListener("timeupdate", () => { if (this.audio && this.audio.currentTime >= this.stopAt) this.pause(); });
    this.audio.addEventListener("error", () => { this.status = "error"; this.error = "Audio failed to load."; });
  }
  async play() { if (!this.audio) return; try { await this.audio.play(); this.status = "playing"; } catch (e) { this.status = "error"; this.error = "Browser blocked audio playback. Use Enable Audio or try again."; throw e; } }
  pause() { if (this.audio) this.audio.pause(); if (this.status === "playing") this.status = "paused"; }
  stop() { if (this.audio) { this.audio.pause(); this.audio.removeAttribute("src"); this.audio.load(); } this.audio = null; this.sourceKey = ""; this.status = "idle"; }
  currentTime() { return this.audio?.currentTime ?? 0; }
  setVolume(volume: number, muted: boolean) { if (this.audio) { this.audio.volume = muted ? 0 : Math.max(0, Math.min(1, volume)); this.audio.muted = muted; } }
  seek(seconds: number) { if (this.audio) this.audio.currentTime = seconds; }
}
