export const OPEN_MIC_MAX_SIMULATED_SONG_SECONDS = 60;

interface OpenMicSongResultTimestamp {
  position: number;
  created_at: string;
}

export function getOpenMicSongDurationMs(durationSeconds?: number | null): number {
  const safeDuration =
    typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0
      ? durationSeconds
      : 180;

  return Math.min(safeDuration, OPEN_MIC_MAX_SIMULATED_SONG_SECONDS) * 1_000;
}

export function getOpenMicSongStartedAtMs(
  position: number,
  performanceStartedAt: string | null,
  songResults: OpenMicSongResultTimestamp[],
): number | null {
  const timestamp =
    position === 2
      ? songResults.find((result) => result.position === 1)?.created_at ?? performanceStartedAt
      : performanceStartedAt;

  if (!timestamp) return null;

  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getOpenMicSongProgress(
  nowMs: number,
  startedAtMs: number,
  durationMs: number,
): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 100;

  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  return Math.min(100, (elapsedMs / durationMs) * 100);
}

export function getOpenMicSongRemainingMs(
  nowMs: number,
  startedAtMs: number,
  durationMs: number,
): number {
  return Math.max(0, durationMs - Math.max(0, nowMs - startedAtMs));
}
