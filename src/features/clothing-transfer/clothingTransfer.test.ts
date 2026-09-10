import { describe, expect, it } from 'vitest';
import { parsePortableBundle, toPortableBundle, validatePortableItem } from './clothingTransfer';

const item = {
  id: 'item-1',
  external_key: 'rockmundo.test-jacket.12345678',
  name: 'Test Jacket',
  description: 'A test garment',
  category: 'jacket',
  wearable_slot: 'outerwear',
  price: 500,
  rarity: 'rare',
  is_premium: false,
  color_variants: ['#111111'],
  garment_config: { silhouette: 'biker' },
  material_config: { fabric: 'leather', primaryColor: '#111111' },
  detail_layers: [{ id: 'd1', type: 'studs', name: 'Studs', zone: 'lapel', color: '#ffffff' }],
  customization_zones: [],
  variant_matrix: [],
};

describe('clothing transfer format', () => {
  it('round trips a versioned collection bundle', () => {
    const bundle = toPortableBundle([item as any], { id: 'collection-1', name: 'Test Pack' });
    const parsed = parsePortableBundle(JSON.stringify(bundle));
    expect(parsed.schema).toBe('rockmundo.clothing.bundle');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].externalKey).toBe(item.external_key);
    expect(parsed.items[0].item.garment_config).toEqual({ silhouette: 'biker' });
  });

  it('rejects files that are not RockMundo clothing exports', () => {
    expect(() => parsePortableBundle(JSON.stringify({ hello: 'world' }))).toThrow(/not a RockMundo clothing export/i);
  });

  it('rejects oversized rich customization arrays', () => {
    const entry = toPortableBundle([item as any]).items[0];
    entry.item.detail_layers = Array.from({ length: 25 }, (_, index) => ({ id: String(index) }));
    expect(validatePortableItem(entry)).toContain('More than 24 detail layers');
  });
});
