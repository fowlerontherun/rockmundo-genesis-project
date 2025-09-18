import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SearchProfilesRow =
  Database["public"]["Functions"]["search_public_profiles"]["Returns"][number];

export interface SearchProfilesOptions {
  limit?: number;
}

const clampLimit = (value: number | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 20;
  }

  return Math.min(50, Math.max(1, Math.floor(value)));
};

export const searchProfiles = async (
  query: string,
  options?: SearchProfilesOptions,
): Promise<SearchProfilesRow[]> => {
  const normalizedQuery = query?.trim?.() ?? "";
  const limit = clampLimit(options?.limit);

  const { data, error } = await supabase.rpc("search_public_profiles", {
    search_term: normalizedQuery,
    result_limit: limit,
  });

  if (error) {
    throw error;
  }

  return data ?? [];
};
