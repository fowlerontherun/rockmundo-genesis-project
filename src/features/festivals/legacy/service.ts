import { supabase } from "@/integrations/supabase/client";
import type { FestivalAward, FestivalLegacyFilter, FestivalRecord, FestivalResultDetail, FestivalResultPage, FestivalStatistics } from "./types";

const call = async <T>(name: string, args: Record<string, unknown> = {}) => {
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw error;
  return data as T;
};

const filterArgs = (filter: FestivalLegacyFilter) => ({
  p_year: filter.year ?? null, p_country: filter.country ?? null, p_city: filter.city ?? null,
  p_festival_type: filter.festivalType ?? null, p_genre: filter.genre ?? null,
  p_limit: filter.limit ?? 24, p_offset: filter.offset ?? 0,
});

// Kept explicit so deployment verification cannot omit the trusted worker API.
export const festivalLegacyWorkerRpcs = [
  "generate_festival_result",
  "refresh_festival_world_records",
  "generate_festival_season_awards",
  "process_festival_legacy_publications",
] as const;

export const festivalLegacyService = {
  results: (filter: FestivalLegacyFilter) => call<FestivalResultPage>("get_festival_results", filterArgs(filter)),
  history: (filter: FestivalLegacyFilter) => call<FestivalResultPage>("get_festival_history", filterArgs(filter)),
  detail: (id: string) => call<FestivalResultDetail | null>("get_festival_result_detail", { p_result_id: id }),
  awards: (year?: number) => call<FestivalAward[]>("get_festival_awards", { p_year: year ?? null }),
  records: () => call<FestivalRecord[]>("get_festival_records"),
  statistics: (filter: FestivalLegacyFilter, groupBy = "festival") => call<FestivalStatistics>("get_festival_statistics", {...filterArgs(filter), p_group_by: groupBy}),
  hallOfFame: () => call<Array<FestivalResult | FestivalAward>>("get_festival_hall_of_fame"),
};
