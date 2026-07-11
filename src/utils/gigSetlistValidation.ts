export interface GigSetlistValidationSong { songId: string; bandId?: string | null; durationSeconds?: number | null; isEncore?: boolean }
export function validateGigSetlist(songs: GigSetlistValidationSong[], bandId: string, slotDurationSeconds = 7200) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  songs.forEach((song, index) => {
    if (seen.has(song.songId)) errors.push('Duplicate songs are not allowed in the same setlist.');
    seen.add(song.songId);
    if (song.bandId && song.bandId !== bandId) errors.push('Setlist songs must belong to the performing band.');
    if (!song.durationSeconds || song.durationSeconds <= 0) errors.push('Every setlist song needs an estimated duration.');
    if (!song.isEncore && songs.slice(0, index).some((s) => s.isEncore)) errors.push('Encore songs must appear after the normal set.');
  });
  if (songs.length === 0) errors.push('Setlist must contain at least one song.');
  const totalDurationSeconds = songs.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
  if (songs.length && totalDurationSeconds < slotDurationSeconds * 0.85) warnings.push('Set duration is shorter than the booked performance slot.');
  if (totalDurationSeconds > slotDurationSeconds * 1.08) warnings.push('Set duration is longer than the booked performance slot.');
  return { valid: errors.length === 0, errors: Array.from(new Set(errors)), warnings, totalDurationSeconds };
}
