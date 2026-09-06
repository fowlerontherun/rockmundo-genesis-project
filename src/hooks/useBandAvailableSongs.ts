import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SONG_FIELDS =
  "id, title, genre, quality_score, duration_seconds, duration_display, status, band_id, profile_id, user_id, version, parent_song_id, archived";

export type BandAvailableSong = {
  id: string;
  title: string;
  genre: string | null;
  quality_score: number | null;
  duration_seconds: number | null;
  duration_display: string | null;
  status: string | null;
  band_id: string | null;
  profile_id: string | null;
  user_id: string | null;
  version: string | null;
  parent_song_id: string | null;
  archived: boolean | null;
};

const addUniqueSongs = (
  target: BandAvailableSong[],
  seen: Set<string>,
  songs: BandAvailableSong[] | null | undefined,
) => {
  for (const song of songs ?? []) {
    if (!seen.has(song.id)) {
      seen.add(song.id);
      target.push(song);
    }
  }
};

export const fetchBandAvailableSongs = async (
  bandId: string,
): Promise<BandAvailableSong[]> => {
  const [bandSongsResult, membershipResult] = await Promise.all([
    supabase
      .from("songs")
      .select(SONG_FIELDS)
      .eq("band_id", bandId)
      .or("archived.is.null,archived.eq.false")
      .order("title"),
    supabase
      .from("band_members")
      .select("profile_id, user_id, member_status, is_touring_member")
      .eq("band_id", bandId)
      .or("member_status.eq.active,member_status.is.null")
      .or("is_touring_member.eq.false,is_touring_member.is.null"),
  ]);

  if (bandSongsResult.error) throw bandSongsResult.error;
  if (membershipResult.error) throw membershipResult.error;

  const songs: BandAvailableSong[] = [];
  const seen = new Set<string>();
  addUniqueSongs(
    songs,
    seen,
    (bandSongsResult.data ?? []) as BandAvailableSong[],
  );

  const memberships = membershipResult.data ?? [];
  const profileIds = Array.from(
    new Set(memberships.map((member) => member.profile_id).filter(Boolean)),
  ) as string[];
  const legacyUserIds = Array.from(
    new Set(
      memberships
        .filter((member) => !member.profile_id && member.user_id)
        .map((member) => member.user_id),
    ),
  ) as string[];

  if (profileIds.length > 0) {
    const { data, error } = await supabase
      .from("songs")
      .select(SONG_FIELDS)
      .in("profile_id", profileIds)
      .is("band_id", null)
      .or("archived.is.null,archived.eq.false")
      .order("title");

    if (error) throw error;
    addUniqueSongs(songs, seen, (data ?? []) as BandAvailableSong[]);
  }

  // Legacy membership rows can pre-date profile_id. Keep this fallback tightly
  // scoped to those rows so songs from another character on the same auth user
  // are never pulled into the band by accident.
  if (legacyUserIds.length > 0) {
    const { data, error } = await supabase
      .from("songs")
      .select(SONG_FIELDS)
      .in("user_id", legacyUserIds)
      .is("band_id", null)
      .or("archived.is.null,archived.eq.false")
      .order("title");

    if (error) throw error;
    addUniqueSongs(songs, seen, (data ?? []) as BandAvailableSong[]);
  }

  return songs.sort((a, b) => a.title.localeCompare(b.title));
};

export const useBandAvailableSongs = (bandId: string | null | undefined) =>
  useQuery({
    queryKey: ["band-available-songs", bandId],
    queryFn: () => fetchBandAvailableSongs(bandId as string),
    enabled: !!bandId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
