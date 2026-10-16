import { describe, expect, it } from 'vitest';
import type { ClothingItem } from '@/hooks/useSkinStore';
import { curatedGarmentFile, isCuratedClothing, isCuratedClothingRenderable, requiredCuratedGarmentFiles, isAvatarV1HeadAccessory } from './curatedGarmentAssets';

function item(overrides: Partial<ClothingItem> = {}): ClothingItem {
  return {
    id: 'skin-1',
    name: 'Curated skin',
    description: null,
    category: 't-shirt',
    wearable_slot: 'top',
    price: 100,
    is_premium: false,
    rarity: 'common',
    color_variants: [],
    collection_id: null,
    release_date: null,
    expiry_date: null,
    is_limited_edition: false,
    featured: false,
    rpm_asset_id: null,
    curated_asset_key: 'clothing.starter.logo-tee',
    curated_asset_status: 'planned',
    ...overrides,
  };
}

describe('curated garment assets', () => {
  it('does not render planned assets', () => {
    const clothing = item();
    expect(isCuratedClothing(clothing)).toBe(true);
    expect(isCuratedClothingRenderable(clothing)).toBe(false);
  });

  it.each(['validated', 'published'] as const)('renders %s assets', status => {
    expect(isCuratedClothingRenderable(item({ curated_asset_status: status }))).toBe(true);
  });

  it('uses a stable frame-specific public asset path', () => {
    expect(curatedGarmentFile(item({ curated_asset_status: 'published' }), 'masculine'))
      .toBe('clothing/masculine/clothing.starter.logo-tee.glb');
    expect(curatedGarmentFile(item({ curated_asset_status: 'published' }), 'feminine'))
      .toBe('clothing/feminine/clothing.starter.logo-tee.glb');
  });

  it('only requests validated/published curated assets and deduplicates files', () => {
    const ready = item({ curated_asset_status: 'validated' });
    const planned = item({ id: 'skin-2', curated_asset_key: 'clothing.punk.biker-jacket', curated_asset_status: 'planned' });
    expect(requiredCuratedGarmentFiles([{ item: ready }, { item: ready }, { item: planned }], 'masculine'))
      .toEqual(['clothing/masculine/clothing.starter.logo-tee.glb']);
  });

  it.each(['asset_ready', 'validated', 'published'] as const)(
    'routes procedural Pumpkin Hat headwear through Avatar V1 instead of phantom GLBs when %s',
    status => {
      const hat = item({
        name: 'Haunted Pumpkin Hat 2026',
        category: 'hat',
        wearable_slot: 'headwear',
        curated_asset_key: 'clothing.halloween.2026.pumpkin-hat',
        curated_asset_status: status,
        render_config: { renderFamily: 'avatar-v1-accessory', headwearStyle: 'pumpkin' },
      });
      expect(isAvatarV1HeadAccessory(hat)).toBe(true);
      expect(curatedGarmentFile(hat, 'masculine')).toBeNull();
      expect(curatedGarmentFile(hat, 'feminine')).toBeNull();
      expect(requiredCuratedGarmentFiles([{ item: hat }], 'masculine')).toEqual([]);
      expect(requiredCuratedGarmentFiles([{ item: hat }], 'feminine')).toEqual([]);
      // Ready-to-preview is NOT a fabricated 'published' catalogue status.
      if (status === 'asset_ready') expect(isCuratedClothingRenderable(hat)).toBe(false);
    },
  );

  it('does not misroute GLB shirts or items spoofing accessory render families', () => {
    const shirt = item({ render_config: { renderFamily: 'avatar-v1-accessory' } });
    expect(isAvatarV1HeadAccessory(shirt)).toBe(false);
    expect(curatedGarmentFile(shirt, 'masculine')).toBe('clothing/masculine/clothing.starter.logo-tee.glb');
  });

  it('keeps legacy items on the legacy renderer path', () => {
    const legacy = item({ curated_asset_key: null, curated_asset_status: 'legacy' });
    expect(isCuratedClothing(legacy)).toBe(false);
    expect(isCuratedClothingRenderable(legacy)).toBe(false);
  });
});
