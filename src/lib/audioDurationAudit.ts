import { readBoundedGeneratedAudio } from "../../supabase/functions/_shared/boundedAudioDownload";
import { getMp3DurationSeconds, MIN_GENERATED_MP3_SECONDS } from "../../supabase/functions/_shared/mp3Duration";

/** Verify complete stored MP3 frames using the same parser as the webhook. */
export async function readAudioDuration(
  url: string, timeoutMs = 12000, signal?: AbortSignal,
): Promise<number | null> {
  if (signal?.aborted) return null;
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: "omit" });
    const bytes = await readBoundedGeneratedAudio(response);
    return controller.signal.aborted ? null : getMp3DurationSeconds(bytes);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

export function audioGenerationMinimumStatus(
  actualSeconds: number | null,
): "UNVERIFIABLE" | "BELOW_MINIMUM" | "MEETS_MINIMUM" {
  if (actualSeconds === null || !Number.isFinite(actualSeconds) || actualSeconds <= 0) return "UNVERIFIABLE";
  return actualSeconds < MIN_GENERATED_MP3_SECONDS ? "BELOW_MINIMUM" : "MEETS_MINIMUM";
}

export function isGeneratedAudioShort(actualSeconds: number, expectedSeconds: number | null): boolean {
  return Number.isFinite(actualSeconds) && actualSeconds >= 0 &&
    expectedSeconds !== null && Number.isFinite(expectedSeconds) && expectedSeconds > 0 &&
    actualSeconds < Math.max(30, expectedSeconds * 0.8);
}

/** Distinguish a known healthy recording from an unverified planned length.
 * Missing duration metadata must never be exported as "within tolerance". */
export function audioDurationReviewStatus(
  actualSeconds: number | null,
  expectedSeconds: number | null,
): "UNVERIFIABLE" | "LENGTH_UNKNOWN" | "SHORT_REVIEW" | "WITHIN_TOLERANCE" {
  if (actualSeconds === null || !Number.isFinite(actualSeconds) || actualSeconds < 0) return "UNVERIFIABLE";
  if (expectedSeconds === null || !Number.isFinite(expectedSeconds) || expectedSeconds <= 0) return "LENGTH_UNKNOWN";
  return isGeneratedAudioShort(actualSeconds, expectedSeconds) ? "SHORT_REVIEW" : "WITHIN_TOLERANCE";
}

export function formatAudioDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "Unknown";
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}


/**
 * Produce a review-only report from verified MP3 frame durations, never from
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
  const lines = [["song_id","title","planned_seconds","mp3_frame_seconds","planned_length_status","generation_minimum_status"].map(cell).join(",")];
  for (const song of songs) {
    if (!Object.prototype.hasOwnProperty.call(audited, song.id)) continue;
    const actual = audited[song.id];
    const status = audioDurationReviewStatus(actual ?? null, song.duration_seconds);
    lines.push([song.id,song.title,song.duration_seconds,actual,status,audioGenerationMinimumStatus(actual ?? null)].map(cell).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
