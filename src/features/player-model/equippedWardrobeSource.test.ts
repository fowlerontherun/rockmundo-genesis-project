// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const source = readFileSync('src/features/player-model/usePlayerModel.ts', 'utf8');
const personal = source.slice(source.indexOf('export function useEquippedRichClothing('), source.indexOf('/** Cosmetic data only;'));

it('resolves equipped Avatar V1 hats from the active character inventory rather than a stage-batch RPC', () => {
  expect(personal).toContain("supabase.from('player_owned_skins')");
  expect(personal).toContain(".eq('profile_id', profileId!)");
  expect(personal).toContain(".eq('item_type', 'clothing')");
  expect(personal).toContain(".eq('is_equipped', true)");
  expect(personal).toContain('resolveRichClothingRows');
  expect(personal).not.toContain("get_equipped_stage_clothing");
});

it('keeps stage-batch clothing loading independent for multi-member gig performers', () => {
  expect(source).toContain("callStageRpc('get_equipped_stage_clothing', { p_profile_ids: ids })");
});
