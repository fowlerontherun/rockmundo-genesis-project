import { supabase } from "./client";
import type { Database } from "./types";

export type BasicPublicProfile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "user_id" | "display_name" | "username"
>;

const PROFILE_SELECT_FIELDS = "user_id, display_name, username";

const isMissingPublicProfilesView = (errorCode: string | undefined) => errorCode === "PGRST205";

export const fetchPublicProfilesByUserIds = async (
  userIds: string[],
): Promise<Map<string, BasicPublicProfile>> => {
  const profilesById = new Map<string, BasicPublicProfile>();

  if (userIds.length === 0) {
    return profilesById;
  }

  const { data, error } = await supabase
    .from("public_profiles")
    .select(PROFILE_SELECT_FIELDS)
    .in("user_id", userIds);

  if (error) {
    if (isMissingPublicProfilesView(error.code)) {
      console.warn("public_profiles view unavailable, falling back to profiles table", error);

      const { data: fallbackData, error: fallbackError } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT_FIELDS)
        .in("user_id", userIds);

      if (fallbackError) {
        throw fallbackError;
      }

      (fallbackData ?? []).forEach((profile) => {
        if (profile?.user_id) {
          profilesById.set(profile.user_id, {
            user_id: profile.user_id,
            display_name: profile.display_name ?? null,
            username: profile.username ?? null,
          });
        }
      });

      return profilesById;
    }

    throw error;
  }

  (data ?? []).forEach((profile) => {
    if (profile?.user_id) {
      profilesById.set(profile.user_id, {
        user_id: profile.user_id,
        display_name: profile.display_name ?? null,
        username: profile.username ?? null,
      });
    }
  });

  return profilesById;
};
