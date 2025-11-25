import { supabase } from "@/integrations/supabase/client";

export interface EurovisionYear {
  id: string;
  year: number;
  host_city?: string | null;
  host_country?: string | null;
  winner_country?: string | null;
  winner_song?: string | null;
}

export interface EurovisionEntryResult {
  entryId: string;
  year: number;
  country: string;
  artist: string;
  songTitle: string;
  juryPoints: number;
  televotePoints: number;
  totalPoints: number;
  placement?: number;
  isWinner: boolean;
}

export interface EurovisionYearResults {
  year: number;
  entries: EurovisionEntryResult[];
  winner?: EurovisionEntryResult;
}

interface EurovisionEntryRow {
  id: string;
  year: number;
  country: string;
  artist: string;
  song_title: string;
  placement?: number | null;
  is_winner?: boolean | null;
  total_points?: number | null;
  jury_points?: number | null;
  televote_points?: number | null;
}

interface EurovisionVoteRow {
  entry_id: string;
  jury_points?: number | null;
  televote_points?: number | null;
}

export const fetchEurovisionYears = async (): Promise<EurovisionYear[]> => {
  const { data, error } = await supabase
    .from("eurovision_years")
    .select("id, year, host_city, host_country, winner_country, winner_song")
    .order("year", { ascending: false });

  if (error) throw error;

  return (
    data?.map((year) => ({
      id: year.id,
      year: year.year,
      host_city: year.host_city,
      host_country: year.host_country,
      winner_country: year.winner_country,
      winner_song: year.winner_song,
    })) || []
  );
};

export const fetchEurovisionYearResults = async (
  year: number,
): Promise<EurovisionYearResults> => {
  const { data: entriesData, error: entriesError } = await supabase
    .from("eurovision_entries")
    .select(
      "id, year, country, artist, song_title, placement, is_winner, total_points, jury_points, televote_points",
    )
    .eq("year", year);

  if (entriesError) throw entriesError;

  const entryIds = entriesData?.map((entry) => entry.id) || [];
  const votesMap = new Map<string, { jury: number; televote: number }>();

  if (entryIds.length > 0) {
    const { data: votesData, error: votesError } = await supabase
      .from("eurovision_votes")
      .select("entry_id, jury_points, televote_points")
      .in("entry_id", entryIds);

    if (votesError) throw votesError;

    votesData?.forEach((vote: EurovisionVoteRow) => {
      const current = votesMap.get(vote.entry_id) || { jury: 0, televote: 0 };
      votesMap.set(vote.entry_id, {
        jury: current.jury + (vote.jury_points || 0),
        televote: current.televote + (vote.televote_points || 0),
      });
    });
  }

  const entries: EurovisionEntryResult[] = (entriesData || []).map(
    (entry: EurovisionEntryRow) => {
      const voteTotals = votesMap.get(entry.id) || {
        jury: entry.jury_points || 0,
        televote: entry.televote_points || 0,
      };

      const totalPoints = entry.total_points ?? voteTotals.jury + voteTotals.televote;

      return {
        entryId: entry.id,
        year: entry.year,
        country: entry.country,
        artist: entry.artist,
        songTitle: entry.song_title,
        juryPoints: voteTotals.jury,
        televotePoints: voteTotals.televote,
        totalPoints,
        placement: entry.placement ?? undefined,
        isWinner: Boolean(entry.is_winner),
      };
    },
  );

  const sortedEntries = [...entries].sort((a, b) => b.totalPoints - a.totalPoints);
  const winner =
    sortedEntries.find((entry) => entry.isWinner) ||
    (sortedEntries.length > 0 ? sortedEntries[0] : undefined);

  return {
    year,
    entries: sortedEntries,
    winner,
  };
};
