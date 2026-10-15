/**
 * Browser decoded duration of an existing MP3, not a filesize/bitrate guess.
 * VBR or streaming media can report Infinity at loadedmetadata and only
 * settle on a later durationchange. Never classify that as a short recording.
 * Audits are abortable when the admin changes song pages or leaves the view.
 */
export async function readAudioDuration(
  url: string, timeoutMs = 12000, signal?: AbortSignal,
): Promise<number | null> {
  if (signal?.aborted) return null;
  return new Promise(resolve => {
    const audio = new Audio();
    audio.preload = "metadata";
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const loaded = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) finish(audio.duration);
    };
    const failed = () => finish(null);
    const finish = (duration: number | null) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      audio.removeEventListener("loadedmetadata", loaded);
      audio.removeEventListener("durationchange", loaded);
      audio.removeEventListener("loadeddata", loaded);
      audio.removeEventListener("error", failed);
      signal?.removeEventListener("abort", failed);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      resolve(duration);
    };
    audio.addEventListener("loadedmetadata", loaded);
    audio.addEventListener("durationchange", loaded);
    audio.addEventListener("loadeddata", loaded);
    audio.addEventListener("error", failed);
    signal?.addEventListener("abort", failed, { once: true });
    timer = setTimeout(failed, timeoutMs);
    if (signal?.aborted) { failed(); return; }
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
