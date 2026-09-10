import { describe, expect, it } from 'vitest';
import { buildClothingPreviewAppearance, clothingPreviewVariants, previewFidelity } from './clothingPreview';

const baseItem: any = {
  id: 'item-1',
  name: 'Leather Jacket',
  description: null,
  category: 'jacket',
  wearable_slot: 'outerwear',
  price: 500,
  is_premium: false,
  rarity: 'rare',
  color_variants: ['#111111', '#aa0000'],
  collection_id: 'collection-1',
  release_date: null,
  expiry_date: null,
  is_limited_edition: false,
  featured: false,
  rpm_asset_id: null,
  material_config: { fabric: 'leather', primaryColor: '#111111' },
  garment_config: { silhouette: 'biker' },
  wear_config: { condition: 'distressed' },
  detail_layers: [{ id: 'studs', type: 'studs', name: 'Studs', zone: 'lapel', color: '#ffffff' }],
};

describe('clothing preview adapter', () => {
  it('creates preview variants from legacy colours', () => {
    const variants = clothingPreviewVariants(baseItem);
    expect(variants).toHaveLength(2);
    expect(variants[1].color).toBe('#aa0000');
  });

  it('uses named variant metadata when present', () => {
    const variants = clothingPreviewVariants({ ...baseItem, variant_matrix: [{ name: 'Red Leather', primaryColor: '#ff0000', material: 'leather' }] });
    expect(variants).toHaveLength(1);
    expect(variants[0]).toMatchObject({ label: 'Red Leather', color: '#ff0000', material: 'leather' });
  });

  it('maps outerwear onto the live player-model top slot for 360 preview', () => {
    const appearance = buildClothingPreviewAppearance(null, baseItem, clothingPreviewVariants(baseItem)[0]);
    expect(appearance.equipment.top.itemId).toContain('starter.top.punk');
    expect(appearance.equipment.top.color).toBe('#111111');
    expect(previewFidelity(baseItem)).toBe('procedural-proxy');
  });
});
