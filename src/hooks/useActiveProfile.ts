import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

/**
 * Returns the active profile (character) for the current authenticated user.
 * Use this hook everywhere you need the current character's profile_id
 * instead of querying profiles by user_id directly.
 */
export function useActiveProfile() {
  const { user } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["active-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .is("died_at", null)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000, // 1 minute
  });

  return {
    profile,
    profileId: profile?.id ?? null,
    isLoading,
  };
}
