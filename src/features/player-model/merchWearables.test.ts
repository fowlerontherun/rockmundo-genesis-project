import { describe, expect, it } from 'vitest';
import { crowdMerchChance, fanWearsBandMerch, merchGarmentColor, merchWearableDonorItem, merchWearableKind } from './merchWearables';

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

  it('assigns crowd merch deterministically for replay stability', () => {
    const first = Array.from({ length: 20 }, (_, index) => fanWearsBandMerch('gig-123', index, .35));
    const second = Array.from({ length: 20 }, (_, index) => fanWearsBandMerch('gig-123', index, .35));
    expect(second).toEqual(first);
  });
});
