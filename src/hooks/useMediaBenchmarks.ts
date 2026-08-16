import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SubmissionFactor {
  label: string;
  detail: string;
  delta: number;
  status: "good" | "warn" | "bad";
}

export interface MediaBenchmarks {
  active_characters: number;
  active_bands: number;
  rated_songs: number;
  avg_song_quality: number;
  median_song_quality: number;
  p75_song_quality: number;
  p90_song_quality: number;
  competition_pressure: number;
  quality_bars: Record<string, number>;
}

export interface SubmissionEvaluation {
  error?: string;
  score: number;
  chance: number;
  verdict: string;
  quality_bar: number;
  genre_match: boolean;
  factors: SubmissionFactor[];
  benchmarks: MediaBenchmarks;
  // radio only
  station_name?: string;
  station_tier?: number;
  song_quality?: number;
  projected_weekly_plays?: number;
  projected_weekly_reach?: number;
  // media only
  outlet_name?: string;
  outlet_tier?: number;
  reach?: number;
  band_avg_quality?: number;
  required_fame?: number;
}

/** Live market standards, scaled by world size and recorded song quality. */
export function useMediaBenchmarks() {
  return useQuery({
    queryKey: ["media-market-benchmarks"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_media_market_benchmarks");
      if (error) throw error;
      return data as MediaBenchmarks;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Detailed scoring preview for a radio submission (same maths as the reviewer). */
export function useRadioSubmissionEvaluation(
  songId?: string | null,
  stationId?: string | null,
  bandId?: string | null,
) {
  return useQuery({
    queryKey: ["radio-submission-evaluation", songId, stationId, bandId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("evaluate_radio_submission", {
        p_song_id: songId,
        p_station_id: stationId,
        p_band_id: bandId ?? null,
      });
      if (error) throw error;
      return data as SubmissionEvaluation;
    },
    enabled: !!songId && !!stationId,
    staleTime: 60 * 1000,
  });
}

/** Detailed scoring preview for a press, magazine, podcast or website pitch. */
export function useMediaSubmissionEvaluation(
  mediaType?: "newspaper" | "magazine" | "podcast" | "website",
  mediaId?: string | null,
  bandId?: string | null,
) {
  return useQuery({
    queryKey: ["media-submission-evaluation", mediaType, mediaId, bandId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("evaluate_media_submission", {
        p_media_type: mediaType,
        p_media_id: mediaId,
        p_band_id: bandId,
      });
      if (error) throw error;
      return data as SubmissionEvaluation;
    },
    enabled: !!mediaType && !!mediaId && !!bandId,
    staleTime: 60 * 1000,
  });
}
