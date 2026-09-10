import { describe, expect, it } from 'vitest';
import type { ClothingItem } from '@/hooks/useSkinStore';
import { clothingPreviewVariants } from './clothingPreview';
import {
  applyClothingZoneColours,
  clothingVariantByKey,
  clothingVariantPersistenceKey,
  playerEditableClothingZones,
  sanitizeClothingZoneColours,
} from './clothingCustomization';

function item(overrides: Partial<ClothingItem> = {}): ClothingItem {
  return {
    id: 'item-1',
    name: 'Test Jacket',
    description: null,
    category: 'jacket',
    wearable_slot: 'outerwear',
    price: 250,
    is_premium: false,
    rarity: 'common',
    color_variants: ['#111111', '#222222'],
    collection_id: null,
    release_date: null,
    expiry_date: null,
    is_limited_edition: false,
    featured: false,
    rpm_asset_id: null,
    material_config: { primaryColor: '#111111', secondaryColor: '#eeeeee' },
    customization_zones: [
      { id: 'main', name: 'Main fabric', color: '#111111', playerEditable: true },
      { id: 'trim', name: 'Locked trim', color: '#eeeeee', playerEditable: false },
      { id: 'patch', name: 'Patch', color: '#ff0000', player_editable: true },
    ],
    detail_layers: [
      { id: 'detail-main', type: 'patch', name: 'Main detail', zone: 'main', color: '#111111' },
      { id: 'detail-trim', type: 'trim', name: 'Locked detail', zone: 'trim', color: '#eeeeee' },
      { id: 'detail-patch', type: 'badge', name: 'Patch detail', zone: 'patch', color: '#ff0000' },
    ],
    ...overrides,
  } as ClothingItem;
}

describe('clothing customisation', () => {
  it('only exposes admin-authorised editable zones', () => {
    expect(playerEditableClothingZones(item()).map(zone => zone.id)).toEqual(['main', 'patch']);
  });

  it('drops locked, unknown and malformed player colours', () => {
    expect(sanitizeClothingZoneColours(item(), {
      main: '#ABCDEF',
      patch: '#00ff00',
      trim: '#123456',
      missing: '#654321',
      bad: 'red',
    })).toEqual({ main: '#abcdef', patch: '#00ff00' });
  });

  it('applies editable colours to material and matching detail layers only', () => {
    const applied = applyClothingZoneColours(item(), { main: '#abcdef', patch: '#00ff00', trim: '#123456' });
    expect((applied.material_config as any).primaryColor).toBe('#abcdef');
    expect(applied.detail_layers?.find(detail => detail.id === 'detail-main')?.color).toBe('#abcdef');
    expect(applied.detail_layers?.find(detail => detail.id === 'detail-patch')?.color).toBe('#00ff00');
    expect(applied.detail_layers?.find(detail => detail.id === 'detail-trim')?.color).toBe('#eeeeee');
  });

  it('persists indexed colour variants with stable color-N keys', () => {
    const clothing = item();
    const variants = clothingPreviewVariants(clothing);
    expect(clothingVariantPersistenceKey(clothing, variants[1])).toBe('color-1');
    expect(clothingVariantByKey(clothing, 'color-1')?.color).toBe('#222222');
  });

  it('uses authored variant identifiers and labels rather than client-only indexes', () => {
    const clothing = item({
      color_variants: [],
      variant_matrix: [
        { id: 'midnight', name: 'Midnight', primaryColor: '#101010' },
        { name: 'Stage Red', primaryColor: '#990000' },
        { name: '', label: 'Label Only', primaryColor: '#005599' } as any,
      ],
    });
    const variants = clothingPreviewVariants(clothing);
    expect(clothingVariantPersistenceKey(clothing, variants[0])).toBe('midnight');
    expect(clothingVariantPersistenceKey(clothing, variants[1])).toBe('Stage Red');
    expect(clothingVariantPersistenceKey(clothing, variants[2])).toBe('Label Only');
  });

  it('stores null for a true single default garment', () => {
    const clothing = item({ color_variants: [], variant_matrix: [] });
    expect(clothingVariantPersistenceKey(clothing, clothingPreviewVariants(clothing)[0])).toBeNull();
  });
});
