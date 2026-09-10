import { describe, expect, it } from 'vitest';
import { buildRichGarmentVisualSpec, richGarmentSlot } from '../richGarmentVisuals';
import type { ClothingItem } from '@/hooks/useSkinStore';

const item = (overrides: Partial<ClothingItem> = {}): ClothingItem => ({
  id: 'item-1',
  name: 'Test garment',
  description: null,
  category: 'jacket',
  wearable_slot: 'outerwear',
  price: 100,
  is_premium: false,
  rarity: 'rare',
  color_variants: ['#111111'],
  collection_id: 'collection-1',
  release_date: null,
  expiry_date: null,
  is_limited_edition: false,
  featured: false,
  rpm_asset_id: null,
  garment_config: {},
  material_config: {},
  pattern_config: {},
  fit_config: {},
  wear_config: {},
  detail_layers: [],
  customization_zones: [],
  render_config: {},
  variant_matrix: [],
  ...overrides,
});

describe('richGarmentVisuals', () => {
  it('maps expanded clothing slots into renderable garment families', () => {
    expect(richGarmentSlot(item({ wearable_slot: 'outerwear' }))).toBe('top');
    expect(richGarmentSlot(item({ wearable_slot: 'dress' }))).toBe('top');
    expect(richGarmentSlot(item({ wearable_slot: 'bottom' }))).toBe('bottom');
    expect(richGarmentSlot(item({ wearable_slot: 'footwear' }))).toBe('footwear');
    expect(richGarmentSlot(item({ wearable_slot: 'headwear' }))).toBe('headwear');
    expect(richGarmentSlot(item({ wearable_slot: 'eyewear' }))).toBe('eyewear');
  });

  it('uses material-specific physical defaults when explicit values are absent', () => {
    const leather = buildRichGarmentVisualSpec(item({ material_config: { fabric: 'leather', primaryColor: '#222222' } }));
    const suede = buildRichGarmentVisualSpec(item({ material_config: { fabric: 'suede', primaryColor: '#553322' } }));
    expect(leather.roughness).toBeLessThan(suede.roughness);
    expect(leather.sheen).toBeGreaterThan(suede.sheen);
  });

  it('lets named variants override base colour, material and pattern', () => {
    const spec = buildRichGarmentVisualSpec(
      item({ material_config: { fabric: 'cotton', primaryColor: '#000000' }, pattern_config: { type: 'solid' } }),
      { id: 'red', label: 'Red vinyl tartan', color: '#cc2233', material: 'vinyl', pattern: 'tartan' },
    );
    expect(spec.primaryColor).toBe('#cc2233');
    expect(spec.material).toBe('vinyl');
    expect(spec.pattern).toBe('tartan');
  });

  it('makes oversized garments visibly larger than skinny garments', () => {
    const oversized = buildRichGarmentVisualSpec(item({ fit_config: { fit: 'oversized' } }));
    const skinny = buildRichGarmentVisualSpec(item({ fit_config: { fit: 'skinny' } }));
    expect(oversized.scaleX).toBeGreaterThan(skinny.scaleX);
    expect(oversized.scaleZ).toBeGreaterThan(skinny.scaleZ);
  });

  it('carries pattern controls, distress and detail count into the render spec', () => {
    const spec = buildRichGarmentVisualSpec(item({
      pattern_config: { type: 'stripes', scale: 2.5, rotation: 35, opacity: .7 },
      wear_config: { condition: 'heavily-distressed', distressIntensity: .8 },
      detail_layers: Array.from({ length: 8 }, (_, i) => ({ id: String(i), type: 'patch', name: `Patch ${i}`, zone: 'front', color: '#ffffff' })),
    }));
    expect(spec.patternScale).toBe(2.5);
    expect(spec.patternRotation).toBe(35);
    expect(spec.distress).toBe(.8);
    expect(spec.detailCount).toBe(8);
  });

  it('clamps unsafe imported render values', () => {
    const spec = buildRichGarmentVisualSpec(item({
      material_config: { roughness: 99, metallic: -8 },
      pattern_config: { scale: 99, rotation: 999 },
      render_config: { scale: 1000, offsetY: 50, depthOffset: -50 },
    }));
    expect(spec.roughness).toBe(1);
    expect(spec.metalness).toBe(0);
    expect(spec.patternScale).toBe(4);
    expect(spec.patternRotation).toBe(360);
    expect(spec.y).toBeLessThanOrEqual(1.5);
    expect(spec.z).toBe(-.2);
  });
});
