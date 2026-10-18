/** Pure mixing helpers: no reward calculation or game-state writes. */
export function equalPowerCrossfade(position: number): { a: number; b: number } {
  const normalized = Math.max(0, Math.min(100, Number.isFinite(position) ? position : 0)) / 100;
  // Extra headroom for overlapping mastered songs.
  return { a: Math.cos(normalized * Math.PI / 2) * 0.7, b: Math.sin(normalized * Math.PI / 2) * 0.7 };
}

export function clampDeckRate(rate: number): number {
  return Number.isFinite(rate) ? Math.max(0.85, Math.min(1.15, rate)) : 1;
}

export function syncDeckRate(baseBpm: number | null, targetBpm: number | null): number | null {
  if (!baseBpm || !targetBpm || baseBpm <= 0 || targetBpm <= 0) return null;
  const desired = targetBpm / baseBpm;
  return desired >= 0.85 && desired <= 1.15 ? clampDeckRate(desired) : null;
}

export function formatDjTime(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Fingerprint only the playable media identity, not mutable catalogue metadata
 * (title, genre, BPM, sharing display state). A harmless catalogue refresh
 * must not pause an actively playing deck.
 */
export function deckAudioSourceKey(track: {
  id: string;
  sourceId: string;
  audioUrl: string | null;
  storagePath: string | null;
} | null): string {
  return track
    ? JSON.stringify([track.id, track.sourceId, track.audioUrl, track.storagePath])
    : "unloaded";
}

/** The verified live-mix API takes tempo as a percentage, not a rate. */
export function deckRatePercent(rate: number): number {
  return Math.round(clampDeckRate(rate) * 100);
}
