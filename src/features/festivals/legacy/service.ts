import { supabase } from "@/integrations/supabase/client";
import type { FestivalAward, FestivalLegacyFilter, FestivalRecord, FestivalResult, FestivalStatistics } from "./types";

const call = async <T>(name: string, args: Record<string, unknown> = {}) => {
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw error;
  return data as T;
};

const filterArgs = (filter: FestivalLegacyFilter) => ({
  p_year: filter.year ?? null, p_country: filter.country ?? null, p_city: filter.city ?? null,
  p_festival_type: filter.festivalType ?? null, p_genre: filter.genre ?? null,
});

export const festivalLegacyService = {
  results: (filter: FestivalLegacyFilter) => call<FestivalResult[]>("get_festival_results", filterArgs(filter)),
  history: (filter: FestivalLegacyFilter) => call<FestivalResult[]>("get_festival_history", filterArgs(filter)),
  awards: (year?: number) => call<FestivalAward[]>("get_festival_awards", { p_year: year ?? null }),
  records: () => call<FestivalRecord[]>("get_festival_records"),
  statistics: (filter: FestivalLegacyFilter) => call<FestivalStatistics>("get_festival_statistics", filterArgs(filter)),
  hallOfFame: () => call<Array<FestivalResult | FestivalAward>>("get_festival_hall_of_fame"),
};
