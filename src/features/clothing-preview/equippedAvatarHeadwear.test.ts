import { describe, expect, it } from 'vitest';
import type { ClothingItem, OwnedSkin } from '@/hooks/useSkinStore';
import { mergeEquippedAvatarV1Accessories } from './equippedClothing';

const pumpkin = {
  id: 'pumpkin-2026', name: 'Haunted Pumpkin Hat 2026', category: 'hat',
  wearable_slot: 'headwear', curated_asset_status: 'asset_ready',
  curated_asset_key: 'clothing.halloween.2026.pumpkin-hat',
  render_config: { renderFamily: 'avatar-v1-accessory', headwearStyle: 'pumpkin' },
  color_variants: ['#ee781c'], material_config: { primaryColor: '#ee781c' },
} as unknown as ClothingItem;
const tee = { id: 'stage-tee', name: 'Tee', category: 'top' } as ClothingItem;
const owned = (equipped: boolean): OwnedSkin[] => [
  { item_id: pumpkin.id, item_type: 'clothing', is_equipped: equipped,
    selected_variant_key: null, customization_config: {} },
];

describe('equipped Avatar V1 headwear reconciliation', () => {
  it('renders an actual equipped asset_ready Pumpkin Hat even when the stage RPC is empty', () => {
    const visible = mergeEquippedAvatarV1Accessories([], owned(true), [pumpkin]);
    expect(visible).toHaveLength(1);
    expect(visible[0].item.curated_asset_key).toBe('clothing.halloween.2026.pumpkin-hat');
    expect(visible[0].item.render_config?.headwearStyle).toBe('pumpkin');
  });

  it('does not show a gifted but unequipped Pumpkin Hat', () => {
    expect(mergeEquippedAvatarV1Accessories([], owned(false), [pumpkin])).toEqual([]);
  });

  it('clears stale stage headwear on unequip, preserving unrelated clothes', () => {
    const stage = [{ item: tee }, { item: pumpkin }];
    expect(mergeEquippedAvatarV1Accessories(stage, owned(false), [pumpkin]))
      .toEqual([{ item: tee }]);
  });

  it('does not duplicate the hat when stage RPC and inventory both contain it', () => {
    const actual = mergeEquippedAvatarV1Accessories([{ item: pumpkin }],
      owned(true), [pumpkin]);
    expect(actual).toHaveLength(1);
  });

  it('preserves rich stage clothing if ownership lookup is pending or fails', () => {
    const stage = [{ item: pumpkin }, { item: tee }];
    expect(mergeEquippedAvatarV1Accessories(stage, undefined, [pumpkin])).toEqual(stage);
    expect(mergeEquippedAvatarV1Accessories(stage, owned(true), undefined)).toEqual(stage);
  });

  it('does not convert an invalid garment or unowned item into an accessory', () => {
    const fake = { ...pumpkin, id: 'fake-shirt', category: 'top', wearable_slot: 'top' } as ClothingItem;
    const inventory: OwnedSkin[] = [{ item_id: fake.id, item_type: 'clothing', is_equipped: true },
      { item_id: pumpkin.id, item_type: 'instrument', is_equipped: true }];
    expect(mergeEquippedAvatarV1Accessories([], inventory, [fake, pumpkin])).toEqual([]);
  });
});
