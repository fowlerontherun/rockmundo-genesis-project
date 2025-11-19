export function calculateSetlistDuration(
  songs: Array<{ duration_seconds?: number | null }>
): { totalSeconds: number; displayTime: string } {
  const totalSeconds = songs.reduce((sum, song) => {
    return sum + (song.duration_seconds || 180); // default 3 min if missing
  }, 0);

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const displayTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return { totalSeconds, displayTime };
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function validateSetlistForSlot(
  setlistDurationSeconds: number,
  slotId: string
): { valid: boolean; message?: string } {
  const gracePeriodSeconds = 5 * 60; // Allow 5 minutes over the slot duration
  const slotLimits: Record<string, { max: number; name: string }> = {
    kids: { max: 30 * 60, name: 'Kids Slot (30 min max)' },
    opening: { max: 30 * 60, name: 'Opening Slot (30 min max)' },
    support: { max: 45 * 60, name: 'Support Slot (45 min max)' },
    headline: { max: 75 * 60, name: 'Headline Slot (75 min max)' },
  };

  const limit = slotLimits[slotId];
  if (!limit) return { valid: true };

  const durationMinutes = Math.floor(setlistDurationSeconds / 60);
  const limitWithGrace = limit.max + gracePeriodSeconds;
  const limitMinutes = Math.floor(limitWithGrace / 60);

  if (setlistDurationSeconds > limitWithGrace) {
    return {
      valid: false,
      message: `Setlist is ${durationMinutes} min, but ${limit.name} allows max ${limitMinutes} min (including 5 min grace)`,
    };
  }

  // Warn if setlist is too short (less than 60% of slot)
  if (setlistDurationSeconds < limit.max * 0.6) {
    return {
      valid: true,
      message: `Setlist is only ${durationMinutes} min. Consider adding songs to fill the ${limit.name}.`,
    };
  }

  return { valid: true };
}

export function generateSongDuration(): { 
  durationSeconds: number; 
  durationDisplay: string;
} {
  const minSeconds = 140; // 2:20
  const maxSeconds = 420; // 7:00
  
  const durationSeconds = Math.floor(
    Math.random() * (maxSeconds - minSeconds + 1) + minSeconds
  );
  
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  const durationDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  return { durationSeconds, durationDisplay };
}
