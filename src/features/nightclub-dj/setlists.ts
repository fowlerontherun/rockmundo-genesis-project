import type { DjAudioTrack } from "./library";

export type DjSetlistItem = { source: "game" | "admin"; id: string };

export type DjSavedSet = {
  id: string;
  name: string;
  user_id: string;
  profile_id: string;
  items: DjSetlistItem[];
  version: number;
  created_at: string;
  updated_at: string;
};

export const DJ_SETLIST_MAX_TRACKS = 30;

export function toDjSetlistItem(track: DjAudioTrack): DjSetlistItem {
  return { source: track.source, id: track.sourceId };
}

export function djSetlistTrackKey(item: DjSetlistItem): string {
  return `${item.source}:${item.id}`;
}

export function djSetlistSummary(items: DjSetlistItem[], tracks: DjAudioTrack[]) {
  const catalog = new Map(tracks.map((track) => [track.id, track]));
  let durationSeconds = 0;
  let unknownDuration = 0;
  let missing = 0;
  for (const item of items) {
    const track = catalog.get(djSetlistTrackKey(item));
    if (!track) {
      missing++;
    } else if (track.durationSeconds === null || track.durationSeconds <= 0) {
      unknownDuration++;
    } else {
      durationSeconds += track.durationSeconds;
    }
  }
  return { durationSeconds, missing, unknownDuration, count: items.length };
}

export function djSetlistIsValid(items: DjSetlistItem[], tracks: DjAudioTrack[]): boolean {
  if (items.length < 1 || items.length > DJ_SETLIST_MAX_TRACKS) return false;
  return djSetlistSummary(items, tracks).missing === 0;
}

export function moveDjSetlistItem(items: DjSetlistItem[], from: number, to: number): DjSetlistItem[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length || from === to) return [...items];
  const copy = [...items];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}
