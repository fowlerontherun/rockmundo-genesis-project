import { describe, expect, it } from 'vitest';
import type { ClothingItem } from '@/hooks/useSkinStore';
import { curatedDonorForSlot, curatedDonorSource } from './curatedDonorGarments';

function item(overrides: Partial<ClothingItem> = {}): ClothingItem {
  return {
    id: 'skin',
    name: 'Skin',
    description: null,
    category: 't-shirt',
    wearable_slot: 'top',
    price: 0,
    is_premium: false,
    rarity: 'common',
    color_variants: [],
    collection_id: null,
    release_date: null,
    expiry_date: null,
    is_limited_edition: false,
    featured: false,
    rpm_asset_id: null,
    render_config: {
      curatedSource: { kind: 'avatar-part', style: 'casual', part: 'body', color: '#151515', fabric: 'plain' },
    },
    ...overrides,
  };
}

describe('curated donor garments', () => {
  it('parses a validated avatar-part source', () => {
    expect(curatedDonorSource(item())).toEqual({
      kind: 'avatar-part',
      style: 'casual',
      part: 'body',
      color: '#151515',
      fabric: 'plain',
    });
  });

  it('rejects unsupported donor definitions', () => {
    expect(curatedDonorSource(item({ render_config: { curatedSource: { kind: 'avatar-part', style: 'unknown', part: 'body' } } }))).toBeNull();
    expect(curatedDonorSource(item({ render_config: { curatedSource: { kind: 'procedural', style: 'casual', part: 'body' } } }))).toBeNull();
  });

  it('selects the matching clothing slot and donor body part', () => {
    const top = item();
    const bottom = item({
      id: 'jeans',
      category: 'jeans',
      wearable_slot: 'bottom',
      render_config: { curatedSource: { kind: 'avatar-part', style: 'punk', part: 'legs', color: '#20252d', fabric: 'denim' } },
    });
    const rows = [{ item: top, variant: undefined }, { item: bottom, variant: undefined }] as any;
    expect(curatedDonorForSlot(rows, 'top')?.source.style).toBe('casual');
    expect(curatedDonorForSlot(rows, 'bottom')?.source.part).toBe('legs');
    expect(curatedDonorForSlot(rows, 'footwear')).toBeNull();
  });
});
