import type { GigViewerEvent, GigViewerReplay } from "../../events/types";

export type PlaybackSpeed = 1 | 2 | 4;
export interface DerivedPlaybackState { positionMs: number; durationMs: number; isPlaying: boolean; isComplete: boolean; activeEvent: GigViewerEvent | null; nextEvent: GigViewerEvent | null; completedEventIds: Set<string>; activePhase: string; currentSongTitle: string | null; currentSongId: string | null; crowdEnergy: number | null; performerFocusId: string | null; activeIndex: number }

export function derivePlaybackState(replay: GigViewerReplay, positionMs: number, isPlaying = false): DerivedPlaybackState {
  const events = sanitizedEvents(replay.events);
  const durationMs = Math.max(0, replay.durationMs || events.at(-1)?.scheduledOffsetMs || 0);
  const pos = Math.max(0, Math.min(positionMs, durationMs));
  let activeIndex = -1;
  events.forEach((event, index) => { if (event.scheduledOffsetMs <= pos) activeIndex = index; });
  const activeEvent = activeIndex >= 0 ? events[activeIndex] : null;
  const nextEvent = events.find((e) => e.scheduledOffsetMs > pos) ?? null;
  let currentSongTitle: string | null = null;
  let currentSongId: string | null = null;
  let crowdEnergy: number | null = null;
  let performerFocusId: string | null = null;
  events.slice(0, activeIndex + 1).forEach((event) => {
    if (event.visualPayload.type === "song_start") { currentSongTitle = event.visualPayload.title; currentSongId = event.visualPayload.songId; }
    if (typeof event.crowdEnergyAfter === "number") crowdEnergy = event.crowdEnergyAfter;
    if (event.performerProfileId) performerFocusId = event.performerProfileId;
  });
  return { positionMs: pos, durationMs, isPlaying, isComplete: pos >= durationMs || activeEvent?.eventType === "replay_completed", activeEvent, nextEvent, completedEventIds: new Set(events.filter((e) => e.scheduledOffsetMs < pos).map((e) => e.id)), activePhase: activeEvent?.phase ?? "venue_opening", currentSongTitle, currentSongId, crowdEnergy, performerFocusId, activeIndex };
}

export function sanitizedEvents(events: GigViewerEvent[] | undefined): GigViewerEvent[] { return [...(events ?? [])].filter((event) => event && Number.isFinite(event.scheduledOffsetMs)).sort((a, b) => a.scheduledOffsetMs - b.scheduledOffsetMs || a.sequence - b.sequence); }

export class ReplayClock {
  private basePosition = 0; private baseNow = 0; private playing = false; private speed: PlaybackSpeed = 1;
  constructor(private durationMs: number, private now: () => number = () => performance.now()) {}
  play() { if (!this.playing) { this.baseNow = this.now(); this.playing = true; } }
  pause() { this.basePosition = this.position(); this.playing = false; }
  seek(ms: number) { this.basePosition = Math.max(0, Math.min(this.durationMs, ms)); this.baseNow = this.now(); }
  setSpeed(speed: PlaybackSpeed) { this.basePosition = this.position(); this.baseNow = this.now(); this.speed = speed; }
  restart() { this.basePosition = 0; this.baseNow = this.now(); }
  position() { if (!this.playing) return this.basePosition; const elapsed = Math.max(0, Math.min(60_000, this.now() - this.baseNow)); return Math.max(0, Math.min(this.durationMs, this.basePosition + elapsed * this.speed)); }
  isPlaying() { return this.playing && this.position() < this.durationMs; }
  getSpeed() { return this.speed; }
}
