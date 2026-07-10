import { supabase } from "@/integrations/supabase/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

export interface PublicProfileDetailBand {
  id: string;
  name: string;
  genre: string | null;
  fame: number;
  chemistry_level: number;
  role: string | null;
  instrument_role: string | null;
  vocal_role: string | null;
  joined_at: string | null;
}

export interface PublicProfileDetail {
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
  created_at: string | null;
  bands: PublicProfileDetailBand[];
}

interface PublicProfileDetailRpcRow {
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
  created_at: string | null;
  bands: PublicProfileDetailBand[] | null;
}

export function validatePublicProfileDetailInput(targetProfileId?: string | null, viewerProfileId?: string | null) {
  const normalizedTargetProfileId = targetProfileId?.trim() || "";
  if (!normalizedTargetProfileId || !UUID_RE.test(normalizedTargetProfileId)) {
    throw new Error("Open a valid player profile link to view this musician.");
  }

  const normalizedViewerProfileId = viewerProfileId?.trim() || null;
  if (normalizedViewerProfileId && !UUID_RE.test(normalizedViewerProfileId)) {
    throw new Error("Sign in with a valid player profile before viewing musicians.");
  }

  return {
    target_profile_id: normalizedTargetProfileId,
    viewer_profile_id: normalizedViewerProfileId,
  };
}

export function friendlyPublicProfileDetailError(message?: string) {
  if (!message) return "This player profile is unavailable right now. Please try again.";
  if (/authentication|sign in|active player/i.test(message)) return "Sign in with an active player profile to view player profiles.";
  if (/not available|blocked|permission|42501|private/i.test(message)) return "This player profile is not available to this account.";
  if (/not found|PGRST116/i.test(message)) return "Player profile not found.";
  return message;
}

function mapDetailRow(row: PublicProfileDetailRpcRow): PublicProfileDetail {
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
    created_at: row.created_at,
    bands: Array.isArray(row.bands) ? row.bands : [],
  };
}

export async function getPublicProfileDetail(targetProfileId?: string | null, viewerProfileId?: string | null) {
  const input = validatePublicProfileDetailInput(targetProfileId, viewerProfileId);
  const { data, error } = await supabase.rpc("get_public_profile_detail" as any, input).maybeSingle();

  if (error) throw new Error(friendlyPublicProfileDetailError(error.message));
  if (!data) throw new Error("Player profile not found.");

  return mapDetailRow(data as PublicProfileDetailRpcRow);
}

export const __publicProfileDetailTestUtils = {
  validatePublicProfileDetailInput,
  friendlyPublicProfileDetailError,
};
