/** Browser-reported duration of an existing audio recording. Never mutates files. */
export async function readAudioDuration(url: string, timeoutMs = 12000): Promise<number | null> {
  return new Promise(resolve => {
    const audio = new Audio();
    audio.preload = "metadata";
    let settled = false;
    const finish = (duration: number | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      audio.removeEventListener("loadedmetadata", loaded);
      audio.removeEventListener("error", failed);
      audio.removeAttribute("src");
      audio.load();
      resolve(duration);
    };
    const loaded = () => finish(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null);
    const failed = () => finish(null);
    const timer = window.setTimeout(failed, timeoutMs);
    audio.addEventListener("loadedmetadata", loaded);
    audio.addEventListener("error", failed);
    audio.src = url;
    audio.load();
  });
}

export function isGeneratedAudioShort(actualSeconds: number, expectedSeconds: number | null): boolean {
  return expectedSeconds !== null && Number.isFinite(expectedSeconds) && expectedSeconds > 0 &&
    actualSeconds < Math.max(30, expectedSeconds * 0.8);
}

export function formatAudioDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "Unknown";
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}


/**
 * Produce a review-only report from *decoded browser durations*, never from
 * estimated MP3 filesize. Keep song IDs for targeted operator review.
 * No audio is modified and this does not start paid regeneration.
 */
export function buildAudioDurationReviewCsv(
  songs: readonly { id: string; title: string; duration_seconds: number | null }[],
  audited: Readonly<Record<string, number | null>>,
): string {
  // A downloaded CSV may be opened in a spreadsheet. Escape all formulas and
  // embedded delimiters so song titles cannot execute as spreadsheet formulas.
  const cell = (value: string | number | null) => {
    const plain = value === null ? "" : String(value);
    const safe = /^[=+@\-\t\r]/.test(plain.trimStart()) ? "'" + plain : plain;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  const lines = [["song_id","title","planned_seconds","decoded_audio_seconds","status"].map(cell).join(",")];
  for (const song of songs) {
    if (!Object.prototype.hasOwnProperty.call(audited, song.id)) continue;
    const actual = audited[song.id];
    const status = actual == null ? "UNVERIFIABLE"
      : isGeneratedAudioShort(actual, song.duration_seconds) ? "SHORT_REVIEW" : "WITHIN_TOLERANCE";
    lines.push([song.id,song.title,song.duration_seconds,actual,status].map(cell).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
