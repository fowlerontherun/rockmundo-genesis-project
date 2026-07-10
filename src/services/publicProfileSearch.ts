import { supabase } from "@/integrations/supabase/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 80;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export interface PublicProfileSearchBand {
  name: string;
  genre: string | null;
}

export interface PublicProfileSearchResult {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  fame: number;
  fans: number;
  level: number;
  city_name: string | null;
  bands: PublicProfileSearchBand[];
}

interface SearchPublicProfilesRpcRow {
  profile_id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  fame: number | null;
  fans: number | null;
  level: number | null;
  city_name: string | null;
  bands: PublicProfileSearchBand[] | null;
}

export function validatePublicProfileSearchInput(searchTerm: string, viewerProfileId?: string | null, resultLimit = DEFAULT_LIMIT) {
  const normalizedTerm = searchTerm.trim().replace(/\s+/g, " ");

  if (normalizedTerm.length < MIN_QUERY_LENGTH) {
    throw new Error("Enter at least 2 characters to search for musicians.");
  }

  if (normalizedTerm.length > MAX_QUERY_LENGTH) {
    throw new Error("Search terms must be 80 characters or fewer.");
  }

  const normalizedViewerProfileId = viewerProfileId?.trim() || null;
  if (normalizedViewerProfileId && !UUID_RE.test(normalizedViewerProfileId)) {
    throw new Error("Sign in with a valid player profile before searching musicians.");
  }

  return {
    search_term: normalizedTerm,
    viewer_profile_id: normalizedViewerProfileId,
    result_limit: Math.min(Math.max(Math.trunc(resultLimit) || DEFAULT_LIMIT, 1), MAX_LIMIT),
  };
}

export function friendlyPublicProfileSearchError(message?: string) {
  if (!message) return "Player search is unavailable right now. Please try again.";
  if (/authentication|sign in|active player/i.test(message)) return "Sign in with an active player profile to search musicians.";
  if (/blocked|not available|permission|42501/i.test(message)) return "Those player profiles are not available to this account.";
  return message;
}

function mapSearchRow(row: SearchPublicProfilesRpcRow): PublicProfileSearchResult {
  return {
    id: row.profile_id,
    user_id: row.user_id,
    username: row.username,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    bio: row.bio,
    fame: row.fame ?? 0,
    fans: row.fans ?? 0,
    level: row.level ?? 1,
    city_name: row.city_name,
    bands: Array.isArray(row.bands) ? row.bands : [],
  };
}

export async function searchPublicProfiles(searchTerm: string, viewerProfileId?: string | null, resultLimit = DEFAULT_LIMIT) {
  const input = validatePublicProfileSearchInput(searchTerm, viewerProfileId, resultLimit);
  const { data, error } = await supabase.rpc("search_public_profiles" as any, input);

  if (error) throw new Error(friendlyPublicProfileSearchError(error.message));

  return ((data ?? []) as SearchPublicProfilesRpcRow[]).map(mapSearchRow);
}

export const __publicProfileSearchTestUtils = {
  validatePublicProfileSearchInput,
  friendlyPublicProfileSearchError,
};
