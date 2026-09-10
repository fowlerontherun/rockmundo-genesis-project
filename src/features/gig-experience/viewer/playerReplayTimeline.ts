import type { GigViewerReplay } from "../events/types";
import type { GigExperienceDTO } from "../types";

const AFTER_SET_PHASES = new Set(["encore_decision", "finale", "band_exit", "result_reveal", "completed"]);
export const PLAYER_SONG_EXCERPT_DURATION_MS = 45_000;
export const PLAYER_SONG_TRANSITION_DURATION_MS = 4_000;

/**
 * Stored replays can contain shorter or variable song segments. Player stage
 * mode presents up to 45 seconds of each playable song, followed by a short
 * crowd-reaction window before the next song. Known shorter tracks are capped
 * to their real duration. This in-memory copy never changes or writes back the
 * canonical replay.
 */
export function fitReplayToPlayerSongExcerpts(
  replay: GigViewerReplay,
  experience: GigExperienceDTO | null,
): GigViewerReplay {
  const maximumDurationBySongId = new Map<string, number>();

  for (const song of experience?.songs ?? []) {
    const audio = song.audio;
    const songId = song.songId ?? song.id;
    if (
      audio?.available
      && typeof audio.durationSeconds === "number"
      && Number.isFinite(audio.durationSeconds)
      && audio.durationSeconds > 0
    ) {
      maximumDurationBySongId.set(songId, Math.round(audio.durationSeconds * 1000));
    }
  }

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
    // Performance items already have a deliberate replay duration and no song
    // audio excerpt to fit. Preserve their choreography timing.
    if (startEvent.visualPayload.itemType === "performance_item" || startEvent.visualPayload.performanceItemId) return;

    const songId = startEvent.visualPayload.songId ?? startEvent.songId;
    const knownTrackDurationMs = songId ? maximumDurationBySongId.get(songId) : undefined;
    const playableDurationMs = Math.min(
      PLAYER_SONG_EXCERPT_DURATION_MS,
      knownTrackDurationMs ?? PLAYER_SONG_EXCERPT_DURATION_MS,
    );
    const targetDurationMs = playableDurationMs + PLAYER_SONG_TRANSITION_DURATION_MS;

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
    id: `${replay.id}:player-45-second-excerpts-with-transitions`,
    durationMs: offsetMs,
    checksum: null,
    events,
  };
}
