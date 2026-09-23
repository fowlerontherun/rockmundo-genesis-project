import { describe, expect, it } from 'vitest';
import type { ClothingItem } from '@/hooks/useSkinStore';
import { curatedDonorForSlot, curatedDonorSource, requiredCuratedDonorModelFiles } from './curatedDonorGarments';

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

  it('reads curated premium material finishes', () => {
    const jacket = item({
      material_config: { fabric: 'plain', finish: 'leather' },
      render_config: { curatedSource: { kind: 'avatar-part', style: 'punk', part: 'body', color: '#111111', fabric: 'plain' }, curatedFinish: 'leather' },
    });
    expect(curatedDonorSource(jacket)?.finish).toBe('leather');
  });

  it('supports safe textile variants on validated donor geometry', () => {
    const tartan = item({ render_config: { curatedSource: { kind: 'avatar-part', style: 'punk', part: 'legs', color: '#9f2634', fabric: 'plaid' } } });
    const trainers = item({ render_config: { curatedSource: { kind: 'avatar-part', style: 'casual', part: 'feet', color: '#ece9df', fabric: 'canvas' } } });
    expect(curatedDonorSource(tartan)?.fabric).toBe('plaid');
    expect(curatedDonorSource(trainers)?.fabric).toBe('canvas');
  });

  it('rejects unsupported donor definitions', () => {
    expect(curatedDonorSource(item({ render_config: { curatedSource: { kind: 'avatar-part', style: 'unknown', part: 'body' } } }))).toBeNull();
    expect(curatedDonorSource(item({ render_config: { curatedSource: { kind: 'procedural', style: 'casual', part: 'body' } } }))).toBeNull();
  });

  it('applies the selected colour and material variant to donor geometry', () => {
    const top = item();
    const rows = [{
      item: top,
      variant: { id: 'color-1', label: 'Colour 2', color: '#eeeeee', material: 'stripe', pattern: 'solid' },
    }] as any;
    const resolved = curatedDonorForSlot(rows, 'top');
    expect(resolved?.source.color).toBe('#eeeeee');
    expect(resolved?.source.fabric).toBe('stripe');
  });

  it('loads the correct frame-specific donor model for live performance', () => {
    const punkTop = item({ render_config: { curatedSource: { kind: 'avatar-part', style: 'punk', part: 'body', color: '#111111', fabric: 'plain' } } });
    const rows = [{ item: punkTop, variant: undefined }] as any;
    expect(requiredCuratedDonorModelFiles(rows, 'feminine')).toEqual(['female-punk.glb']);
    expect(requiredCuratedDonorModelFiles(rows, 'masculine')).toEqual(['punk.glb']);
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
