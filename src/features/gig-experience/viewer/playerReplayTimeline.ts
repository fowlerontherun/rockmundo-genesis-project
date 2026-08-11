import type { GigViewerReplay } from "../events/types";
import type { GigExperienceDTO } from "../types";

const FULL_TRACK_SOURCE_TYPES = new Set(["generated_full", "fixture"]);
const AFTER_SET_PHASES = new Set(["encore_decision", "finale", "band_exit", "result_reveal", "completed"]);

/**
 * Stored replays use a compact presentation timeline. Player stage mode needs
 * each song segment to last for the full playable track, so this creates an
 * in-memory presentation copy with expanded song durations. No canonical
 * replay data is changed or written back.
 */
export function expandReplayToFullSongDurations(
  replay: GigViewerReplay,
  experience: GigExperienceDTO | null,
): GigViewerReplay {
  const durationBySongId = new Map<string, number>();

  for (const song of experience?.songs ?? []) {
    const audio = song.audio;
    const songId = song.songId ?? song.id;
    if (
      audio?.available
      && FULL_TRACK_SOURCE_TYPES.has(audio.sourceType)
      && typeof audio.durationSeconds === "number"
      && Number.isFinite(audio.durationSeconds)
      && audio.durationSeconds > 0
    ) {
      durationBySongId.set(songId, Math.round(audio.durationSeconds * 1000));
    }
  }

  if (durationBySongId.size === 0) return replay;

  const events = [...replay.events]
    .sort((left, right) => left.scheduledOffsetMs - right.scheduledOffsetMs || left.sequence - right.sequence)
    .map((event) => ({ ...event }));
  const songStartIndexes = events
    .map((event, index) => event.visualPayload.type === "song_start" ? index : -1)
    .filter((index) => index >= 0);
  let expanded = false;

  songStartIndexes.forEach((startIndex, songIndex) => {
    const startEvent = events[startIndex];
    if (startEvent.visualPayload.type !== "song_start") return;

    const songId = startEvent.visualPayload.songId ?? startEvent.songId;
    const targetDurationMs = songId ? durationBySongId.get(songId) : undefined;
    if (!targetDurationMs) return;

    const nextSongStart = songStartIndexes[songIndex + 1];
    const afterSetIndex = events.findIndex(
      (event, index) => index > startIndex && AFTER_SET_PHASES.has(event.phase),
    );
    const endIndex = nextSongStart ?? (afterSetIndex >= 0 ? afterSetIndex : events.length);
    const segment = events.slice(startIndex, endIndex);
    const originalDurationMs = segment.reduce((total, event) => total + Math.max(0, event.durationMs), 0);
    if (segment.length === 0 || originalDurationMs <= 0) return;

    let allocatedDurationMs = 0;
    segment.forEach((event, index) => {
      const isLast = index === segment.length - 1;
      const durationMs = isLast
        ? Math.max(1, targetDurationMs - allocatedDurationMs)
        : Math.max(1, Math.round((event.durationMs / originalDurationMs) * targetDurationMs));
      event.durationMs = durationMs;
      allocatedDurationMs += durationMs;
    });
    expanded = true;
  });

  if (!expanded) return replay;

  let offsetMs = 0;
  events.forEach((event, sequence) => {
    event.sequence = sequence;
    event.scheduledOffsetMs = offsetMs;
    offsetMs += event.durationMs;
  });

  return {
    ...replay,
    id: `${replay.id}:player-full-songs`,
    durationMs: offsetMs,
    checksum: null,
    events,
  };
}
