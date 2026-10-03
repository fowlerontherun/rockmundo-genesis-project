import { describe, expect, it } from 'vitest';
import { crowdMerchChance, fanWearsBandMerch, merchElementPrintPosition, merchFrontElements, merchGarmentColor, merchHasRenderableFront, merchWearableDonorItem, merchWearableKind } from './merchWearables';

describe('merch wearables', () => {
  it('maps Merch Studio apparel onto approved V1 donor silhouettes', () => {
    expect(merchWearableKind('Graphic Tee')).toBe('tee');
    expect(merchWearableDonorItem('Graphic Tee')).toBe('starter.top.casual');
    expect(merchWearableDonorItem('Premium Hoodie')).toBe('starter.top.hoodie');
    expect(merchWearableKind('Mug')).toBeNull();
  });

  it('keeps garment colour deterministic and safe', () => {
    expect(merchGarmentColor({ background_color: '#ABCDEF', design_data: null })).toBe('#abcdef');
    expect(merchGarmentColor({ background_color: 'red', design_data: null })).toBe('#171717');
  });

  it('increases crowd adoption from loyalty, fame, popularity and on-sale status', () => {
    const baseline = crowdMerchChance({});
    const engaged = crowdMerchChance({ fanLoyalty: 80, bandFame: 70, merchPopularity: 90, onSale: true });
    expect(engaged).toBeGreaterThan(baseline);
    expect(engaged).toBeLessThanOrEqual(.72);
  });

  it('resolves layered front designs including text-only merch', () => {
    const merch = { artwork_url: null, design_data: { areaElements: { front: [{ type: 'text' as const, text: 'WORLD TOUR', x: 50, y: 44 }] } } };
    expect(merchFrontElements(merch)).toHaveLength(1);
    expect(merchHasRenderableFront(merch)).toBe(true);
    expect(merchHasRenderableFront({ artwork_url: null, design_data: { areaElements: { front: [] } } })).toBe(false);
  });

  it('falls back to legacy artwork when layered design data is absent', () => {
    expect(merchFrontElements({ artwork_url: 'https://example.test/art.png', design_data: null })).toEqual([
      { type: 'image', src: 'https://example.test/art.png', x: 50, y: 50, scale: 1, rotation: 0 },
    ]);
  });

  it('assigns crowd merch deterministically for replay stability', () => {
    const first = Array.from({ length: 20 }, (_, index) => fanWearsBandMerch('gig-123', index, .35));
    const second = Array.from({ length: 20 }, (_, index) => fanWearsBandMerch('gig-123', index, .35));
    expect(second).toEqual(first);
  });

  it('maps Merch Studio full-mockup coordinates into the avatar print panel', () => {
    expect(merchElementPrintPosition({ x: 50, y: 51.5 }, 'Graphic Tee')).toEqual({ x: 0.5, y: 0.5 });
    expect(merchElementPrintPosition({ x: 34, y: 29 }, 'Premium Hoodie')).toEqual({ x: 0, y: 0 });
    expect(merchElementPrintPosition({ x: 66, y: 74 }, 'Football Shirt')).toEqual({ x: 1, y: 1 });
  });
});
