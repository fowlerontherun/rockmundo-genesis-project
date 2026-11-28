// The songwriting editor requires 2,000 progress points for each of music and
// lyrics (twice the maximum song rating). Booking and dashboard summaries must
// use the same scale, rather than treating raw progress points as percentages.
export const SONGWRITING_PROGRESS_TARGET = 2_000;

export const OPEN_SONGWRITING_PROJECT_STATUSES = ["draft", "writing", "arranging"] as const;

export interface SongwritingProgressSnapshot {
  music_progress?: number | null;
  lyrics_progress?: number | null;
}

export function getSongwritingProgressPercent(project: SongwritingProgressSnapshot): number {
  const clamp = (value: number | null | undefined) =>
    Math.min(SONGWRITING_PROGRESS_TARGET, Math.max(0, Number(value) || 0));

  return Math.round(
    ((clamp(project.music_progress) + clamp(project.lyrics_progress)) /
      (2 * SONGWRITING_PROGRESS_TARGET)) * 100,
  );
}
