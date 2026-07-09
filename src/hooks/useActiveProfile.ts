import { useQuery } from "@tanstack/react-query";
import { getActiveProfile } from "@/services/profileService";
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

      return getActiveProfile(user.id);
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000, // 1 minute
  });

  return {
    profile,
    profileId: profile?.id ?? null,
    /** The auth-level user ID — use for tables where user_id stores auth.users.id */
    userId: user?.id ?? null,
    isLoading,
  };
}
