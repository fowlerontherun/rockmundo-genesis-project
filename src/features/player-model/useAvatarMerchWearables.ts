import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePrimaryBand } from '@/hooks/usePrimaryBand';
import { merchWearableKind, type MerchWearableDesign } from './merchWearables';

export const merchWearablesKey = (profileId: string | null | undefined) => ['avatar-merch-wearables', profileId] as const;

export function useAvatarMerchWearables(profileId: string | null | undefined) {
  const band = usePrimaryBand();
  const client = useQueryClient();
  const bandId = band.data?.band_id ?? null;

  const query = useQuery({
    queryKey: [...merchWearablesKey(profileId), bandId],
    enabled: !!profileId && !!bandId,
    queryFn: async () => {
      const [designResult, equippedResult] = await Promise.all([
        supabase.from('tshirt_designs').select('id,band_id,design_name,product_type,artwork_url,background_color,design_data').eq('band_id', bandId!).order('created_at', { ascending: false }),
        (supabase as any).from('player_merch_wearables').select('design_id').eq('profile_id', profileId!).maybeSingle(),
      ]);
      if (designResult.error) throw designResult.error;
      if (equippedResult.error) throw equippedResult.error;
      const designs = ((designResult.data ?? []) as unknown as MerchWearableDesign[]).filter(design => !!merchWearableKind(design.product_type));
      return { designs, equippedDesignId: equippedResult.data?.design_id as string | undefined };
    },
  });

  const equip = useMutation({
    mutationFn: async (designId: string | null) => {
      if (!profileId) throw new Error('Select a character before equipping band merch.');
      if (!designId) {
        const { error } = await (supabase as any).from('player_merch_wearables').delete().eq('profile_id', profileId);
        if (error) throw error;
        return null;
      }
      const { error } = await (supabase as any).from('player_merch_wearables').upsert({ profile_id: profileId, design_id: designId, equipped_at: new Date().toISOString() }, { onConflict: 'profile_id' });
      if (error) throw error;
      return designId;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: merchWearablesKey(profileId) });
      void client.invalidateQueries({ queryKey: ['gig-player-appearances'] });
    },
  });

  return { band, query, equip };
}
