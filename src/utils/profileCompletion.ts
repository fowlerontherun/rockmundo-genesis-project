import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

const SKILL_KEYS = [
  "guitar",
  "vocals",
  "drums",
  "bass",
  "performance",
  "songwriting",
  "composition",
] as const;

type SkillKey = (typeof SKILL_KEYS)[number];

export interface ProfileCompletionResult {
  isComplete: boolean;
  profile: Pick<
    Tables<"profiles">,
    "id" | "username" | "display_name" | "avatar_url" | "bio"
  > | null;
  skills: Pick<Tables<"player_skills">, "id" | SkillKey> | null;
}

export async function checkProfileCompletion(userId: string): Promise<ProfileCompletionResult> {
  const [profileResponse, skillsResponse] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("player_skills")
      .select("id, guitar, vocals, drums, bass, performance, songwriting, composition")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (profileResponse.error) {
    throw profileResponse.error;
  }

  if (skillsResponse.error) {
    throw skillsResponse.error;
  }

  const profile = profileResponse.data;
  const skills = skillsResponse.data;

  const trimmedDisplayName = profile?.display_name?.trim() ?? "";
  const hasCustomDisplayName =
    trimmedDisplayName.length > 0 && trimmedDisplayName.toLowerCase() !== "new player";

  const normalizedUsername = profile?.username?.trim().toLowerCase() ?? "";
  const normalizedUserId = userId.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const defaultUsernameSuffix = normalizedUserId.slice(0, 8);
  const defaultUsername = defaultUsernameSuffix ? `player${defaultUsernameSuffix}` : null;
  const hasCustomUsername =
    normalizedUsername.length > 0 && (!defaultUsername || normalizedUsername !== defaultUsername);

  const hasAvatar =
    typeof profile?.avatar_url === "string" && profile.avatar_url.trim().length > 0;
  const hasBio = typeof profile?.bio === "string" && profile.bio.trim().length > 0;

  const skillValues = SKILL_KEYS.map((key) => {
    const value = skills?.[key];
    return typeof value === "number" ? value : null;
  }).filter((value): value is number => value !== null);

  const hasAllSkillValues =
    Boolean(skills) &&
    SKILL_KEYS.every((key) => {
      const value = skills?.[key];
      return typeof value === "number" && value > 0;
    });

  const areSkillsUniform =
    skillValues.length > 0 && skillValues.every((value) => value === skillValues[0]);

  const hasCustomSkills = hasAllSkillValues && !areSkillsUniform;

  const profileComplete =
    Boolean(profile) && hasCustomDisplayName && hasCustomUsername && hasAvatar && hasBio;

  return {
    isComplete: profileComplete && hasCustomSkills,
    profile,
    skills,
  };
}
