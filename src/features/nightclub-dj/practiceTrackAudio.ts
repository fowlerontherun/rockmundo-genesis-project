/** Browser-side validation for legacy stage-practice audio.
 * This improves admin feedback, but Storage policy and RLS remain the security boundary.
 */
export const PRACTICE_AUDIO_MAX_BYTES = 50 * 1024 * 1024;
const supportedMimeTypes: Record<string, readonly string[]> = {
  mp3: ["audio/mpeg", "audio/mp3", "audio/x-mpeg"],
  m4a: ["audio/mp4", "audio/x-m4a", "audio/m4a"],
  ogg: ["audio/ogg", "application/ogg"],
  wav: ["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"],
  webm: ["audio/webm"],
};

export function validatePracticeAudioFile(file: Pick<File, "name" | "size" | "type">) {
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > PRACTICE_AUDIO_MAX_BYTES) {
    throw new Error("Practice audio must be non-empty and no larger than 50 MiB.");
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowed = supportedMimeTypes[ext];
  if (!allowed) throw new Error("Use an MP3, M4A, OGG, WAV or WebM file.");
  const mime = file.type.trim().toLowerCase();
  if (mime && !allowed.includes(mime)) {
    throw new Error("The file type does not match its audio extension.");
  }
  return { ext, contentType: allowed[0] };
}

/** Never remove a file outside the exact track's known public Storage key.
 * Older records with an unrelated URL can still be removed from the table.
 */
export function practiceTrackStorageKey(trackId: string, audioUrl: string | null | undefined): string | null {
  if (!audioUrl || !/^[a-z0-9_-]+$/i.test(trackId)) return null;
  try {
    const path = new URL(audioUrl).pathname;
    const prefix = "/storage/v1/object/public/practice-tracks/";
    const index = path.indexOf(prefix);
    if (index < 0) return null;
    const key = decodeURIComponent(path.slice(index + prefix.length));
    const separator = key.lastIndexOf(".");
    if (separator < 0 || key.slice(0, separator) !== trackId) return null;
    return Object.hasOwn(supportedMimeTypes, key.slice(separator + 1).toLowerCase()) ? key : null;
  } catch {
    return null;
  }
}
