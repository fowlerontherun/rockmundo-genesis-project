import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProfile } from '@/hooks/useActiveProfile';
import type { ClothingItem } from '@/hooks/useSkinStore';
import { resolveEquippedClothingVisual, type ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import { appearanceFromLegacy, appearanceSchema, resolveAppearance, type PlayerAppearance } from './appearance';
import { normalizeTattooVisual, type ResolvedTattooVisual, type TattooVisualInput } from './tattoos';
import { resolveStageInstrumentSkin, type EquippedInstrumentSkinRow, type ResolvedInstrumentSkinVisual } from '@/features/instrument-skins/instrumentSkin';

export const playerModelKey = (profileId: string | null) => ['player-stage-appearance', profileId] as const;
export const equippedRichClothingKey = (profileId: string | null) => ['equipped-rich-clothing', profileId] as const;
export const playerStageTattoosKey = (profileId: string | null) => ['player-stage-tattoos', profileId] as const;

export interface GigPlayerModelsData {
  appearances: Record<string, PlayerAppearance>;
  richClothing: Record<string, ResolvedEquippedClothing[]>;
  /** Render-only tattoo projection. Older replay snapshots may omit this field. */
  tattoos?: Record<string, ResolvedTattooVisual[]>;
  /** Optional so replay snapshots captured before instrument skins remain compatible. */
  instrumentSkins?: Record<string, ResolvedInstrumentSkinVisual[]>;
}

interface EquippedClothingRow {
  profile_id: string;
  item_id: string;
  selected_variant_key?: string | null;
  customization_config?: Record<string, string> | null;
}

export interface StageAppearanceRow {
  profile_id: string;
  appearance: unknown;
}

export interface LegacyStageAppearanceRow extends Record<string, unknown> {
  profile_id: string;
  gender?: string | null;
  skin_tone?: string | null;
  hair_color?: string | null;
  height?: number | null;
  shirt_color?: string | null;
  pants_color?: string | null;
  shoes_color?: string | null;
}

export function resolveGigStageAppearances(
  stageRows: StageAppearanceRow[] = [],
  legacyRows: LegacyStageAppearanceRow[] = [],
): Record<string, PlayerAppearance> {
  const appearances: Record<string, PlayerAppearance> = {};
  for (const row of stageRows) {
    if (!row?.profile_id) continue;
    appearances[row.profile_id] = resolveAppearance(row.appearance, row.profile_id);
  }
  for (const row of legacyRows) {
    if (!row?.profile_id || appearances[row.profile_id]) continue;
    appearances[row.profile_id] = appearanceFromLegacy(row, row.profile_id);
  }
  return appearances;
}

type StageRpcName = 'get_stage_tattoo_visuals' | 'get_equipped_stage_clothing' | 'get_equipped_stage_instrument_skins';
type StageRpcArgs = { p_profile_ids: string[] };
type StageRpcResult = { data: unknown; error: { message?: string } | null };

async function callStageRpc(name: StageRpcName, args: StageRpcArgs): Promise<StageRpcResult> {
  const rpc = supabase.rpc as unknown as (
    functionName: StageRpcName,
    functionArgs: StageRpcArgs,
  ) => Promise<StageRpcResult>;
  return rpc(name, args);
}

function resolveInstrumentSkinRows(rows: EquippedInstrumentSkinRow[]) {
  const result: Record<string, ResolvedInstrumentSkinVisual[]> = {};
  for (const row of rows) {
    if (!row?.profile_id || !row?.item_id || !row?.instrument_id) continue;
    (result[row.profile_id] ??= []).push(resolveStageInstrumentSkin(row));
  }
  return result;
}

function resolveTattooRows(rows: TattooVisualInput[]) {
  const result: Record<string, ResolvedTattooVisual[]> = {};
  for (const row of rows) {
    const tattoo = normalizeTattooVisual(row);
    if (!tattoo) continue;
    (result[tattoo.profile_id] ??= []).push(tattoo);
  }
  return result;
}

async function resolveRichClothingRows(rows: EquippedClothingRow[]) {
  const itemIds = [...new Set(rows.map(row => row.item_id).filter(Boolean))];
  if (!itemIds.length) return {} as Record<string, ResolvedEquippedClothing[]>;
  const { data, error } = await supabase.from('avatar_clothing_items').select('*').in('id', itemIds);
  if (error) throw error;
  const items = (data || []) as unknown as ClothingItem[];
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

export function usePlayerStageTattoos(profileId: string | null | undefined) {
  return useQuery({
    queryKey: playerStageTattoosKey(profileId ?? null),
    enabled: !!profileId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await callStageRpc('get_stage_tattoo_visuals', { p_profile_ids: [profileId!] });
      if (error) throw error;
      return resolveTattooRows((data || []) as TattooVisualInput[])[profileId!] ?? [];
    },
  });
}

export function useEquippedRichClothing(profileId: string | null | undefined) {
  return useQuery({
    queryKey: equippedRichClothingKey(profileId ?? null),
    enabled: !!profileId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await callStageRpc('get_equipped_stage_clothing', { p_profile_ids: [profileId!] });
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
      const [appearanceSettled, legacySettled, clothingSettled, tattooSettled, instrumentSettled] = await Promise.allSettled([
        supabase.from('player_stage_appearances').select('profile_id,appearance').in('profile_id', ids),
        supabase.from('player_avatar_config').select('profile_id,gender,skin_tone,hair_color,height,shirt_color,pants_color,shoes_color').in('profile_id', ids),
        callStageRpc('get_equipped_stage_clothing', { p_profile_ids: ids }),
        callStageRpc('get_stage_tattoo_visuals', { p_profile_ids: ids }),
        callStageRpc('get_equipped_stage_instrument_skins', { p_profile_ids: ids }),
      ]);

      if (appearanceSettled.status === 'rejected') throw appearanceSettled.reason;
      const appearanceResult = appearanceSettled.value;
      if (appearanceResult.error) throw appearanceResult.error;

      const optionalStageResult = (label: string, settled: PromiseSettledResult<StageRpcResult>): StageRpcResult => {
        if (settled.status === 'rejected') {
          console.warn(`[gig-player-models] ${label} request could not load`, settled.reason);
          return { data: [], error: { message: settled.reason instanceof Error ? settled.reason.message : String(settled.reason) } };
        }
        if (settled.value.error) console.warn(`[gig-player-models] ${label} could not load`, settled.value.error);
        return settled.value;
      };

      const clothingResult = optionalStageResult('equipped rich clothing', clothingSettled);
      const tattooResult = optionalStageResult('tattoo visuals', tattooSettled);
      const instrumentResult = optionalStageResult('instrument skins', instrumentSettled);

      let legacyRows: LegacyStageAppearanceRow[] = [];
      if (legacySettled.status === 'fulfilled' && !legacySettled.value.error) {
        legacyRows = (legacySettled.value.data || []) as LegacyStageAppearanceRow[];
      } else {
        const reason = legacySettled.status === 'rejected' ? legacySettled.reason : legacySettled.value.error;
        console.warn('[gig-player-models] legacy avatar fallback could not load', reason);
      }

      const appearances = resolveGigStageAppearances(
        (appearanceResult.data || []) as StageAppearanceRow[],
        legacyRows,
      );

      let richClothing: Record<string, ResolvedEquippedClothing[]> = {};
      if (!clothingResult.error) {
        try {
          richClothing = await resolveRichClothingRows((clothingResult.data || []) as EquippedClothingRow[]);
        } catch (error) {
          console.warn('[gig-player-models] rich clothing catalogue could not load', error);
        }
      }

      const tattoos = tattooResult.error ? {} : resolveTattooRows((tattooResult.data || []) as TattooVisualInput[]);
      const instrumentSkins = instrumentResult.error ? {} : resolveInstrumentSkinRows((instrumentResult.data || []) as EquippedInstrumentSkinRow[]);
      return { appearances, richClothing, tattoos, instrumentSkins };
    },
  });
}
