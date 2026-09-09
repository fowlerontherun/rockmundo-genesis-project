import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProfile } from '@/hooks/useActiveProfile';
import { appearanceFromLegacy, appearanceSchema, resolveAppearance, type PlayerAppearance } from './appearance';

export const playerModelKey = (profileId: string | null) => ['player-stage-appearance', profileId] as const;
export function usePlayerModel() {
  const active = useActiveProfile(), client = useQueryClient();
  const query = useQuery({
    queryKey: playerModelKey(active.profileId), enabled: !!active.profileId,
    queryFn: async () => {
      const { data, error } = await supabase.from('player_stage_appearances').select('appearance,revision').eq('profile_id', active.profileId!).maybeSingle();
      if (error) throw error;
      if (data) return { appearance: resolveAppearance(data.appearance, active.profileId!), revision: data.revision };
      const legacy = await supabase.from('player_avatar_config').select('gender,skin_tone,hair_color,height,shirt_color,pants_color,shoes_color').eq('profile_id', active.profileId!).maybeSingle();
      if (legacy.error) throw legacy.error;
      return { appearance: appearanceFromLegacy(legacy.data, active.profileId!), revision: null as number | null };
    },
  });
  const save = useMutation({
    mutationFn: async ({ profileId, appearance, revision }: { profileId: string; appearance: PlayerAppearance; revision: number | null }) => {
      const validated = appearanceSchema.parse(appearance);
      const result = revision == null
        ? await supabase.from('player_stage_appearances').insert({ profile_id: profileId, appearance: validated }).select('appearance,revision').single()
        : await supabase.from('player_stage_appearances').update({ appearance: validated }).eq('profile_id', profileId).eq('revision', revision).select('appearance,revision').maybeSingle();
      if (result.error?.code === '23505' || (!result.error && !result.data)) throw new Error('This model changed in another window. Reload the saved model before saving again.');
      if (result.error) throw new Error(result.error.message);
      return { appearance: resolveAppearance(result.data!.appearance, profileId), revision: result.data!.revision };
    },
    onSuccess: (data, variables) => {
      client.setQueryData(playerModelKey(variables.profileId), data);
      void client.invalidateQueries({ queryKey: ['gig-player-appearances'] });
    },
  });
  return { ...active, query, save };
}

/** Cosmetic data only; one batched lookup for the whole lineup, never per frame. */
export function useGigPlayerModels(profileIds: string[]) {
  const ids = [...new Set(profileIds.filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))].sort();
  return useQuery({
    queryKey: ['gig-player-appearances', ...ids], enabled: ids.length > 0, staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('player_stage_appearances').select('profile_id,appearance').in('profile_id', ids);
      if (error) throw error;
      return Object.fromEntries(data.map(row => [row.profile_id, resolveAppearance(row.appearance, row.profile_id)]));
    },
  });
}
