import { supabase } from "@/integrations/supabase/client";

export type SearchProfilesRow = {
  profile_id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  level: number | null;
  fame: number | null;
};

const PROFILE_SELECTION = "id, user_id, username, display_name, avatar_url, bio, level, fame";
const MAX_RESULTS = 20;

const toSearchRow = (row: Record<string, any>): SearchProfilesRow => ({
  profile_id: String(row.profile_id ?? row.id ?? ""),
  user_id: String(row.user_id ?? ""),
  username: String(row.username ?? ""),
  display_name: row.display_name ?? null,
  avatar_url: row.avatar_url ?? null,
  bio: row.bio ?? null,
  level: typeof row.level === "number" ? row.level : row.level ? Number(row.level) : null,
  fame: typeof row.fame === "number" ? row.fame : row.fame ? Number(row.fame) : null,
});

const escapeSearchTerm = (term: string) => term.replace(/[\%_]/g, match => `\\${match}`);

const performRpcSearch = async (query: string) => {
  try {
    const { data, error } = await supabase.rpc("search_profiles", { search_term: query });

    if (error) {
      throw error;
    }

    if (!Array.isArray(data)) {
      return null;
    }

    return data as Record<string, any>[];
  } catch (rpcError) {
    console.warn("Falling back to direct profile search", rpcError);
    return null;
  }
};

const performDirectSearch = async (query: string) => {
  const escaped = escapeSearchTerm(query);
  const filter = `username.ilike.%${escaped}%,display_name.ilike.%${escaped}%`;

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECTION)
    .or(filter)
    .order("username", { ascending: true })
    .limit(MAX_RESULTS);

  if (error) {
    throw error;
  }

  return (data as Record<string, any>[]) ?? [];
};

const normalizeResults = (rows: Record<string, any>[]) =>
  rows
    .map(toSearchRow)
    .filter(row => row.profile_id && row.user_id && row.username.trim().length > 0);

export const searchProfiles = async (query: string): Promise<SearchProfilesRow[]> => {
  const trimmed = query.trim();

  if (trimmed.length === 0) {
    return [];
  }

  const rpcResults = await performRpcSearch(trimmed);

  if (rpcResults) {
    return normalizeResults(rpcResults);
  }

  const fallbackResults = await performDirectSearch(trimmed);
  return normalizeResults(fallbackResults);
};

export const searchPublicProfiles = async (query: string): Promise<SearchProfilesRow[]> => {
  return searchProfiles(query);
};
