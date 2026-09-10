import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProfile } from '@/hooks/useActiveProfile';
import type { ClothingItem } from '@/hooks/useSkinStore';
import { resolveEquippedClothingVisual, type ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import { appearanceFromLegacy, appearanceSchema, resolveAppearance, type PlayerAppearance } from './appearance';

export const playerModelKey = (profileId: string | null) => ['player-stage-appearance', profileId] as const;
export const equippedRichClothingKey = (profileId: string | null) => ['equipped-rich-clothing', profileId] as const;

export interface GigPlayerModelsData {
  appearances: Record<string, PlayerAppearance>;
  richClothing: Record<string, ResolvedEquippedClothing[]>;
}

interface EquippedClothingRow {
  profile_id: string;
  item_id: string;
  selected_variant_key?: string | null;
  customization_config?: Record<string, string> | null;
}

async function resolveRichClothingRows(rows: EquippedClothingRow[]) {
  const itemIds = [...new Set(rows.map(row => row.item_id).filter(Boolean))];
  if (!itemIds.length) return {} as Record<string, ResolvedEquippedClothing[]>;
  const { data, error } = await (supabase.from('avatar_clothing_items') as any).select('*').in('id', itemIds);
  if (error) throw error;
  const items = (data || []) as ClothingItem[];
  const itemById = new Map(items.map(item => [item.id, item]));
  const result: Record<string, ResolvedEquippedClothing[]> = {};
  for (const row of rows) {
    const item = itemById.get(row.item_id);
    if (!item) continue;
    (result[row.profile_id] ??= []).push(
      resolveEquippedClothingVisual(item, row.selected_variant_key, row.customization_config),
    );
  }
  return result;
}

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

export function useEquippedRichClothing(profileId: string | null | undefined) {
  return useQuery({
    queryKey: equippedRichClothingKey(profileId ?? null),
    enabled: !!profileId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_equipped_stage_clothing' as any, { p_profile_ids: [profileId] } as any);
      if (error) throw error;
      const map = await resolveRichClothingRows((data || []) as EquippedClothingRow[]);
      return map[profileId!] ?? [];
    },
  });
}

/** Cosmetic data only; lineup appearance and equipped rich clothing are loaded in
 * batches when the stage is built, never during animation frames. */
export function useGigPlayerModels(profileIds: string[]) {
  const ids = [...new Set(profileIds.filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))].sort();
  return useQuery({
    queryKey: ['gig-player-appearances', ...ids],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<GigPlayerModelsData> => {
      const [appearanceResult, clothingResult] = await Promise.all([
        supabase.from('player_stage_appearances').select('profile_id,appearance').in('profile_id', ids),
        supabase.rpc('get_equipped_stage_clothing' as any, { p_profile_ids: ids } as any),
      ]);

      if (appearanceResult.error) throw appearanceResult.error;
      if (clothingResult.error) console.warn('[gig-player-models] equipped rich clothing could not load', clothingResult.error);

      const appearances = Object.fromEntries(
        (appearanceResult.data || []).map(row => [row.profile_id, resolveAppearance(row.appearance, row.profile_id)]),
      ) as Record<string, PlayerAppearance>;

      let richClothing: Record<string, ResolvedEquippedClothing[]> = {};
      if (!clothingResult.error) {
        try {
          richClothing = await resolveRichClothingRows((clothingResult.data || []) as EquippedClothingRow[]);
        } catch (error) {
          console.warn('[gig-player-models] rich clothing catalogue could not load', error);
        }
      }

      return { appearances, richClothing };
    },
  });
}
