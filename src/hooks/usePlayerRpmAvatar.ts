import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

export const usePlayerRpmAvatar = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: rpmAvatarUrl, isLoading } = useQuery({
    queryKey: ['player-rpm-avatar', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('rpm_avatar_url')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        console.error('[usePlayerRpmAvatar] Error fetching avatar:', error);
        return null;
      }
      
      return data?.rpm_avatar_url || null;
    },
    enabled: !!user?.id,
  });

  const updateAvatarMutation = useMutation({
    mutationFn: async (newUrl: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('profiles')
        .update({ rpm_avatar_url: newUrl })
        .eq('user_id', user.id);
      
      if (error) throw error;
      return newUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player-rpm-avatar', user?.id] });
    },
  });

  return {
    rpmAvatarUrl,
    isLoading,
    updateAvatar: updateAvatarMutation.mutate,
    isUpdating: updateAvatarMutation.isPending,
  };
};
