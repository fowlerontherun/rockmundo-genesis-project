import type { BandAvailableSong } from "@/hooks/useBandAvailableSongs";

/**
 * Battle entry RPC currently requires songs.band_id = p_band_id.
 * Open-mic repertoire is deliberately broader (active member's unassigned
 * songs); do not silently broaden Battle of the Bands' server rule.
 */
export function filterBattleOfTheBandsSongs<T extends Pick<BandAvailableSong, "band_id" | "archived">>(
  songs: T[],
  bandId: string,
): T[] {
  return songs.filter((song) => song.band_id === bandId && song.archived !== true);
}
