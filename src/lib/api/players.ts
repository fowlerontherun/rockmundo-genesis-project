import { supabase } from "@/lib/supabase-client";
import type { Tables } from "@/lib/supabase-types";
import type { User } from "@supabase/supabase-js";

type ProfileRecord = Tables<"profiles">;

export type PlayerProfile = ProfileRecord;

const PROFILE_COLUMNS = "id, user_id, username, display_name, avatar_url, bio";

export interface OnboardingProfileInput {
  displayName?: string;
  avatarUrl?: string | null;
  bio?: string | null;
}

export const getPlayerProfileForUser = async (
  userId: string
): Promise<PlayerProfile | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  return (data as PlayerProfile) ?? null;
};

const normalizeUsername = (input: string): string => {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
};

const deriveFallbackNames = (user: User): { username: string; displayName: string } => {
  const metadataName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
  const rawName = metadataName || user.email || user.phone || `player-${user.id.slice(0, 8)}`;
  const trimmed = rawName.trim();
  const fallbackUsername = normalizeUsername(trimmed.length > 0 ? trimmed : `player-${user.id.slice(0, 8)}`);
  const displayName = trimmed.length > 0 ? trimmed : `Player ${user.id.slice(0, 4).toUpperCase()}`;
  return {
    username: fallbackUsername.length > 0 ? fallbackUsername : `player-${user.id.slice(0, 8)}`,
    displayName,
  };
};

export const ensurePlayerProfile = async (user: User): Promise<PlayerProfile> => {
  const existing = await getPlayerProfileForUser(user.id);
  if (existing) {
    return existing;
  }

  const { username, displayName } = deriveFallbackNames(user);
  const avatarUrl = typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null;

  const { data, error } = await supabase
    .from("profiles")
    .insert([
      {
        user_id: user.id,
        username,
        display_name: displayName,
        avatar_url: avatarUrl,
        bio: null,
      },
    ])
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return data as PlayerProfile;
};

export const updatePlayerOnboarding = async (
  profileId: string,
  updates: OnboardingProfileInput
): Promise<PlayerProfile> => {
  const payload: Partial<ProfileRecord> = {};

  if (typeof updates.displayName === "string") {
    payload.display_name = updates.displayName.trim().length > 0 ? updates.displayName.trim() : null;
  }

  if ("avatarUrl" in updates) {
    const nextAvatar = updates.avatarUrl ?? null;
    payload.avatar_url = nextAvatar && nextAvatar.trim().length > 0 ? nextAvatar.trim() : null;
  }

  if (typeof updates.bio === "string") {
    const trimmedBio = updates.bio.trim();
    payload.bio = trimmedBio.length > 0 ? trimmedBio : null;
  }

  if (Object.keys(payload).length === 0) {
    const profile = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", profileId)
      .single();

    if (profile.error) {
      throw profile.error;
    }

    return profile.data as PlayerProfile;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", profileId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return data as PlayerProfile;
};

export const updatePlayerAvatar = async (
  profileId: string,
  avatarUrl: string | null
): Promise<PlayerProfile> => {
  return updatePlayerOnboarding(profileId, { avatarUrl });
};

export const updatePlayerBiography = async (
  profileId: string,
  bio: string | null
): Promise<PlayerProfile> => {
  return updatePlayerOnboarding(profileId, { bio: bio ?? "" });
};

export const updatePlayerDisplayName = async (
  profileId: string,
  displayName: string
): Promise<PlayerProfile> => {
  return updatePlayerOnboarding(profileId, { displayName });
};
