import { describe, expect, it } from 'vitest';
import type { ClothingItem } from '@/hooks/useSkinStore';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import { normalizeTattooVisual, visibleTattoosForClothing, type ResolvedTattooVisual } from './tattoos';

const tattoos: ResolvedTattooVisual[] = [
  { id: 'arm', profile_id: 'profile', body_slot: 'left_forearm', ink_color: '#18202b', quality_score: 90, is_infected: false, category: 'musical' },
  { id: 'chest', profile_id: 'profile', body_slot: 'chest', ink_color: '#18202b', quality_score: 80, is_infected: false, category: 'geometric' },
  { id: 'neck', profile_id: 'profile', body_slot: 'neck', ink_color: '#18202b', quality_score: 70, is_infected: false, category: 'text' },
];

function clothing(garment_config: Record<string, unknown> | null): ResolvedEquippedClothing {
  return {
    item: {
      id: 'garment',
      name: 'Test garment',
      description: null,
      category: 'jacket',
      wearable_slot: 'outerwear',
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
      garment_config,
    } as ClothingItem,
  };
}

describe('tattoo clothing occlusion', () => {
  it('hides only explicitly configured tattoo body slots', () => {
    const visible = visibleTattoosForClothing(tattoos, [clothing({ tattooCoverageSlots: ['left_forearm', 'chest'] })]);
    expect(visible.map(tattoo => tattoo.id)).toEqual(['neck']);
  });

  it('supports snake-case coverage metadata and ignores unknown slots', () => {
    const visible = visibleTattoosForClothing(tattoos, [clothing({ tattoo_coverage_slots: ['neck', 'face', 'not-a-slot'] })]);
    expect(visible.map(tattoo => tattoo.id)).toEqual(['arm', 'chest']);
  });

  it('does not guess coverage when a garment has no coverage metadata', () => {
    expect(visibleTattoosForClothing(tattoos, [clothing({ silhouette: 'long-sleeve-jacket' })])).toEqual(tattoos);
    expect(visibleTattoosForClothing(tattoos, [])).toEqual(tattoos);
  });

  it('combines coverage from multiple equipped garments', () => {
    const visible = visibleTattoosForClothing(tattoos, [
      clothing({ tattooCoverageSlots: ['left_forearm'] }),
      clothing({ tattooCoverageSlots: ['neck'] }),
    ]);
    expect(visible.map(tattoo => tattoo.id)).toEqual(['chest']);
  });
});


describe('tattoo catalogue compatibility', () => {
  it('keeps newer catalogue body slots and categories intact', () => {
    expect(normalizeTattooVisual({
      id: 'leg-tattoo', profile_id: 'profile', body_slot: 'right_thigh',
      ink_color: '#101010', quality_score: 92, is_infected: false, category: 'blackwork',
    })).toMatchObject({ body_slot: 'right_thigh', category: 'blackwork' });
    expect(normalizeTattooVisual({
      id: 'stomach-tattoo', profile_id: 'profile', body_slot: 'stomach',
      ink_color: '#222222', quality_score: 80, is_infected: false, category: 'traditional',
    })).toMatchObject({ body_slot: 'stomach', category: 'traditional' });
  });

  it('still sanitizes unknown catalogue values', () => {
    expect(normalizeTattooVisual({
      id: 'unknown-category', profile_id: 'profile', body_slot: 'left_calf',
      ink_color: '#ABCDEF', quality_score: 120, is_infected: false, category: 'future-style',
    })).toMatchObject({ body_slot: 'left_calf', category: 'custom', ink_color: '#abcdef', quality_score: 100 });
    expect(normalizeTattooVisual({
      id: 'bad-slot', profile_id: 'profile', body_slot: 'face',
      ink_color: '#111111', quality_score: 80, is_infected: false, category: 'blackwork',
    })).toBeNull();
  });
});
