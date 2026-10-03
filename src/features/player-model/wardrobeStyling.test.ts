import { describe, expect, it } from 'vitest';
import { appearanceSchema, defaultAppearance, LIVE_STARTER_ITEM_IDS, SLOTS } from './appearance';
import { applyOutfitLook, OUTFIT_LOOKS } from './wardrobeStyling';

describe('outfit looks', () => {
  it.each(OUTFIT_LOOKS)('saves $name using available starter items without changing the body or accessories', look => {
    const original = defaultAppearance();
    original.body.frame = 'feminine';
    original.body.breastSize = 1.35;
    const before = structuredClone(original);
    const styled = applyOutfitLook(original, look);
    expect(appearanceSchema.parse(styled)).toEqual(styled);
    expect(original).toEqual(before);
    expect(styled.body).toEqual(original.body);
    expect(styled.accessories).toEqual(original.accessories);
    expect(styled.equipment.instrument).toEqual(original.equipment.instrument);
    for (const slot of SLOTS) expect(LIVE_STARTER_ITEM_IDS.has(styled.equipment[slot].itemId)).toBe(true);
  });
});
