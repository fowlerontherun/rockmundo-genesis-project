import type { BuildGigViewerReplayInput, ReplayPerformerInput, ReplaySongInput } from "../events/generator";
import type { GigExperienceDTO } from "../types";

const safeText = (value: string | null | undefined, fallback: string) => value?.trim() || fallback;
const availableNumber = (metric: { status: string; value?: unknown }) => metric.status === "available" && typeof metric.value === "number" && Number.isFinite(metric.value) ? metric.value : null;

/** Pure, read-only compatibility boundary between authoritative DTOs and presentation events. */
export function buildLocalPresentationInput(gigId: string, experience: GigExperienceDTO): BuildGigViewerReplayInput {
  const songs: ReplaySongInput[] = experience.songs
    .map((song, originalIndex) => ({ song, originalIndex }))
    .sort((a, b) => a.song.position - b.song.position || a.originalIndex - b.originalIndex)
    .map(({ song }, position) => {
      const isItem = song.itemType === "performance_item";
      const identity = isItem
        ? safeText(song.performanceItemId, `presentation-item-${gigId}-${position}`)
        : safeText(song.songId, `presentation-song-${gigId}-${position}`);
      return {
        id: safeText(song.id, `presentation-entry-${gigId}-${position}`),
        songId: isItem ? null : identity,
        title: safeText(song.title, isItem ? "Untitled performance item" : "Untitled song"),
        position,
        performanceScore: availableNumber(song.performanceScore),
        itemType: isItem ? "performance_item" as const : "song" as const,
        performanceItemId: isItem ? identity : null,
        performanceItemCategory: isItem ? song.performanceItemCategory : null,
        performanceItemRequiredSkill: isItem ? song.performanceItemRequiredSkill : null,
      };
    });
  const performers: ReplayPerformerInput[] = experience.performers
    .filter((performer) => performer.profileId.trim().length > 0)
    .map((performer) => ({ profileId: performer.profileId, displayName: safeText(performer.displayName, "Unknown Performer"), roleOrInstrument: performer.roleOrInstrument, lineupStatus: performer.lineupStatus }));
  const resultAvailable = experience.viewer.ready && !!experience.viewer.resultReadyAt;
  return {
    replayId: `local-${gigId}`,
    outcomeId: experience.viewer.outcomeId ?? `presentation-${gigId}`,
    generatedAt: experience.viewer.resultReadyAt ?? experience.gig.startedAt ?? experience.gig.scheduledDate,
    includeResultReveal: resultAvailable,
    gig: { id: gigId, completedAt: resultAvailable ? experience.gig.completedAt : null, resultReadyAt: resultAvailable ? experience.viewer.resultReadyAt : null, actualAttendance: availableNumber(experience.headline.attendance), venueCapacity: experience.gig.venue.capacity, overallRating: availableNumber(experience.headline.overallRating), netProfit: availableNumber(experience.finances.netProfit) },
    songs,
    performers,
  };
}
