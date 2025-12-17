import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

interface GenerationLimitData {
  can_generate: boolean;
  is_admin: boolean;
  used: number;
  limit: number;
  remaining: number;
}

export function useSongGenerationLimits() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["song-generation-limits", user?.id],
    queryFn: async (): Promise<GenerationLimitData | null> => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .rpc('check_song_generation_limit', { p_user_id: user.id });

      if (error) {
        console.error('Error checking generation limits:', error);
        throw error;
      }

      return data as unknown as GenerationLimitData;
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000, // 1 minute
  });
}
