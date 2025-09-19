import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

const PROFILE_COLUMNS = "id, user_id, username, display_name, avatar_url, level, fame";

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "user_id" | "username" | "display_name" | "avatar_url" | "level" | "fame"
>;

export type SearchProfilesRow = {
  profile_id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  level: number | null;
  fame: number | null;
};

const normalizeResult = (row: ProfileRow): SearchProfilesRow => ({
  profile_id: row.id,
  user_id: row.user_id,
  username: row.username,
  display_name: row.display_name ?? null,
  avatar_url: row.avatar_url ?? null,
  level: row.level ?? null,
  fame: row.fame ?? null,
});

const sanitizeQuery = (term: string) => term.trim().replace(/\s+/g, " ");

const buildFilter = (term: string) => {
  const escaped = term.replace(/%/g, "\\%" ).replace(/_/g, "\\_");
  return `username.ilike.%${escaped}%,display_name.ilike.%${escaped}%`;
};

export const searchProfiles = async (query: string): Promise<SearchProfilesRow[]> => {
  const normalized = sanitizeQuery(query);
  if (!normalized) {
    return [];
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .or(buildFilter(normalized))
    .order("username", { ascending: true })
    .limit(20);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => normalizeResult(row as ProfileRow));
};

export const searchPublicProfiles = async (query: string): Promise<SearchProfilesRow[]> => {
  return searchProfiles(query);
};
