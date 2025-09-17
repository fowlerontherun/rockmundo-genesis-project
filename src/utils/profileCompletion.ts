import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export interface ProfileCompletionResult {
  isComplete: boolean;
  profile: Pick<Tables<"profiles">, "id" | "username" | "display_name"> | null;
  skills: Pick<Tables<"player_skills">, "id"> | null;
}

export async function checkProfileCompletion(userId: string): Promise<ProfileCompletionResult> {
  const [profileResponse, skillsResponse] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("player_skills").select("id").eq("user_id", userId).maybeSingle(),
  ]);

  if (profileResponse.error) {
    throw profileResponse.error;
  }

  if (skillsResponse.error) {
    throw skillsResponse.error;
  }

  const profileComplete = Boolean(
    profileResponse.data?.username && profileResponse.data?.display_name
  );

  const skillsComplete = Boolean(skillsResponse.data);

  return {
    isComplete: profileComplete && skillsComplete,
    profile: profileResponse.data,
    skills: skillsResponse.data,
  };
}
