import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

export interface PlayerProducerProfile {
  id: string;
  user_id: string;
  display_name: string;
  cost_per_hour: number;
  specialty_genre: string;
  bio: string | null;
  is_available: boolean;
  city_id: string | null;
  quality_bonus: number;
  mixing_skill: number;
  arrangement_skill: number;
  total_sessions: number;
  total_earnings: number;
  xp_earned: number;
  rating: number;
  created_at: string;
  updated_at: string;
}

export const useProducerProfile = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['producer-profile', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('player_producer_profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as PlayerProducerProfile | null;
    },
  });
};

export const useCreateProducerProfile = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { profileId } = useActiveProfile();

  return useMutation({
    mutationFn: async (input: {
      display_name: string;
      cost_per_hour: number;
      specialty_genre: string;
      bio?: string;
      quality_bonus: number;
      mixing_skill: number;
      arrangement_skill: number;
    }) => {
      // Get player's current city from active profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('current_city_id')
        .eq('id', profileId)
        .single();

      const { data, error } = await (supabase as any)
        .from('player_producer_profiles')
        .insert({
          user_id: user!.id,
          display_name: input.display_name,
          cost_per_hour: Math.max(10, input.cost_per_hour),
          specialty_genre: input.specialty_genre,
          bio: input.bio || null,
          city_id: profile?.current_city_id || null,
          quality_bonus: input.quality_bonus,
          mixing_skill: input.mixing_skill,
          arrangement_skill: input.arrangement_skill,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-profile'] });
      toast.success('Producer profile created!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUpdateProducerProfile = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: Partial<{
      display_name: string;
      cost_per_hour: number;
      specialty_genre: string;
      bio: string | null;
      is_available: boolean;
      quality_bonus: number;
      mixing_skill: number;
      arrangement_skill: number;
    }>) => {
      // Also update city to current location
      const { data: profile } = await supabase
        .from('profiles')
        .select('current_city_id')
        .eq('user_id', user!.id)
        .single();

      const updateData: any = { ...input };
      if (profile?.current_city_id) {
        updateData.city_id = profile.current_city_id;
      }
      if (input.cost_per_hour != null) {
        updateData.cost_per_hour = Math.max(10, input.cost_per_hour);
      }

      const { error } = await (supabase as any)
        .from('player_producer_profiles')
        .update(updateData)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-profile'] });
      toast.success('Profile updated!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useAvailablePlayerProducers = (cityId?: string, genre?: string) => {
  return useQuery({
    queryKey: ['player-producers', cityId, genre],
    enabled: !!cityId,
    queryFn: async () => {
      let query = (supabase as any)
        .from('player_producer_profiles')
        .select('*, profiles!player_producer_profiles_user_id_fkey(username, display_name, level, current_city_id)')
        .eq('is_available', true);

      if (cityId) query = query.eq('city_id', cityId);
      if (genre) query = query.ilike('specialty_genre', `%${genre}%`);

      const { data, error } = await query.order('rating', { ascending: false });
      if (error) throw error;
      return (data || []) as (PlayerProducerProfile & { profiles?: any })[];
    },
  });
};

export const useProducerSessionHistory = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['producer-session-history', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: profile } = await (supabase as any)
        .from('player_producer_profiles')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (!profile) return [];

      const { data, error } = await (supabase as any)
        .from('recording_sessions')
        .select('*, songs(title, genre)')
        .eq('player_producer_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });
};

export const useSubmitProducerReview = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      session_id: string;
      producer_profile_id: string;
      rating: number;
      comment?: string;
    }) => {
      const { error } = await (supabase as any)
        .from('producer_session_reviews')
        .insert({
          session_id: input.session_id,
          reviewer_user_id: user!.id,
          producer_profile_id: input.producer_profile_id,
          rating: input.rating,
          comment: input.comment || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-profile'] });
      queryClient.invalidateQueries({ queryKey: ['player-producers'] });
      toast.success('Review submitted!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
};
