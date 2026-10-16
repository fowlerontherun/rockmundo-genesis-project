import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// The real head-bone mesh is regression-tested on both body frames in
// player-model/accessories.test.ts. These cross-surface contract checks prevent
// fitting rooms/stages from accidentally choosing missing curated .glb files.
const root = path.resolve(__dirname, '../../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const fitting = read('src/features/clothing-preview/RichClothingPreview.tsx');
const stage = read('src/features/gig-demo-3d/performers.ts');
const turntable = read('src/features/clothing-preview/browserPreviewRenderer.ts');
const save = read('src/hooks/useSkinStore.ts');
const editor = read('src/features/player-model/OwnedAccessories.tsx');
const preflight = read('supabase/migrations/20261016134500_halloween_preflight_requires_published_pumpkin_hat.sql');

describe('Halloween Pumpkin Hat Avatar V1 preview and wardrobe contract', () => {
  it('assembles procedural headwear into the real avatar instead of demanding a garment GLB', () => {
    expect(fitting).toContain('const proceduralHead = isAvatarV1HeadAccessory(currentPreview.item)');
    expect(fitting).toContain('donor || proceduralHead ? [{ item: currentPreview.item, variant: currentPreview.variant }] : []');
    expect(fitting).toContain('if (donor || proceduralHead)');
    expect(stage).toContain('if (isAvatarV1HeadAccessory(resolved.item)) continue;');
    expect(turntable).toContain('donor || ownedHeadAccessory ? [{ item, variant }] : []');
    expect(turntable).toContain('if (!donor && !ownedHeadAccessory)');
  });

  it('never falsely acknowledges an equip without a saved database ownership row', () => {
    expect(save).toContain("if (!persisted || typeof persisted !== 'object' || !('ownership_id' in persisted))");
    expect(save).toContain('persisted.is_equipped !== equipped');
    expect(save).toContain("queryClient.invalidateQueries({ queryKey: ['equipped-rich-clothing', savedProfileId] })");
    expect(editor).toContain('Owned, not equipped');
    expect(editor).toContain('Wearing on your avatar');
    expect(editor).toContain('save.error?.message');
  });

  it('the production preflight must still require genuine hat publication/QA', () => {
    expect(preflight).toContain("curated_asset_status='published'");
    expect(preflight).toContain('v_database AND v_hats AND v_hat_published AND v_gifts');
    expect(preflight).toContain("'pumpkin_hat_published',v_hat_published");
    expect(preflight).not.toContain("UPDATE public.avatar_clothing_items");
  });
});
