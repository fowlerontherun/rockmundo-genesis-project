import { describe, expect, it } from 'vitest';
import type { ClothingItem } from '@/hooks/useSkinStore';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import { defaultAppearance } from './appearance';
import { coveredTattooSlotsForAppearance, normalizeTattooVisual, visibleTattoosForClothing, visibleTattoosForPresentation, type ResolvedTattooVisual } from './tattoos';

const tattoos: ResolvedTattooVisual[] = [
  { id: 'arm', profile_id: 'profile', body_slot: 'left_forearm', ink_color: '#18202b', quality_score: 90, is_infected: false, category: 'musical' },
  { id: 'wrist', profile_id: 'profile', body_slot: 'left_wrist', ink_color: '#18202b', quality_score: 90, is_infected: false, category: 'fine_line' },
  { id: 'shoulder', profile_id: 'profile', body_slot: 'left_shoulder', ink_color: '#18202b', quality_score: 88, is_infected: false, category: 'blackwork' },
  { id: 'chest', profile_id: 'profile', body_slot: 'chest', ink_color: '#18202b', quality_score: 80, is_infected: false, category: 'geometric' },
  { id: 'stomach', profile_id: 'profile', body_slot: 'stomach', ink_color: '#18202b', quality_score: 80, is_infected: false, category: 'traditional' },
  { id: 'back', profile_id: 'profile', body_slot: 'back', ink_color: '#18202b', quality_score: 80, is_infected: false, category: 'japanese' },
  { id: 'neck', profile_id: 'profile', body_slot: 'neck', ink_color: '#18202b', quality_score: 70, is_infected: false, category: 'text' },
  { id: 'thigh', profile_id: 'profile', body_slot: 'left_thigh', ink_color: '#18202b', quality_score: 86, is_infected: false, category: 'realism' },
  { id: 'calf', profile_id: 'profile', body_slot: 'left_calf', ink_color: '#18202b', quality_score: 84, is_infected: false, category: 'tribal' },
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
    expect(visible.map(tattoo => tattoo.id)).toEqual(['wrist', 'shoulder', 'stomach', 'back', 'neck', 'thigh', 'calf']);
  });

  it('supports snake-case coverage metadata and ignores unknown slots', () => {
    const visible = visibleTattoosForClothing(tattoos, [clothing({ tattoo_coverage_slots: ['neck', 'face', 'not-a-slot'] })]);
    expect(visible.map(tattoo => tattoo.id)).toEqual(['arm', 'wrist', 'shoulder', 'chest', 'stomach', 'back', 'thigh', 'calf']);
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
    expect(visible.map(tattoo => tattoo.id)).toEqual(['wrist', 'shoulder', 'chest', 'stomach', 'back', 'thigh', 'calf']);
  });
});



describe('shared tattoo presentation visibility', () => {
  it('applies starter top and full-length bottom coverage on stage', () => {
    const appearance = defaultAppearance('starter-coverage');
    const covered = coveredTattooSlotsForAppearance({ appearance, presentation: 'stage' });
    expect(covered.has('chest')).toBe(true);
    expect(covered.has('left_shoulder')).toBe(true);
    expect(covered.has('left_thigh')).toBe(true);
    expect(covered.has('left_calf')).toBe(true);
    expect(covered.has('left_forearm')).toBe(false);
    expect(covered.has('left_wrist')).toBe(false);
    expect(covered.has('neck')).toBe(false);

    expect(visibleTattoosForPresentation(tattoos, { appearance, presentation: 'stage' }).map(tattoo => tattoo.id))
      .toEqual(['arm', 'wrist', 'neck']);
  });

  it('treats starter suits as long sleeved while leaving wrists and neck visible', () => {
    const appearance = defaultAppearance('suit-coverage');
    appearance.equipment.top.itemId = 'starter.top.suit';
    expect(visibleTattoosForPresentation(tattoos, { appearance, presentation: 'stage' }).map(tattoo => tattoo.id))
      .toEqual(['wrist', 'neck']);
  });

  it('reveals torso and arm tattoos when topless but keeps trouser-covered legs hidden', () => {
    const appearance = defaultAppearance('topless-coverage');
    appearance.equipment.top.itemId = 'starter.top.topless';
    expect(visibleTattoosForPresentation(tattoos, { appearance, presentation: 'stage' }).map(tattoo => tattoo.id))
      .toEqual(['arm', 'wrist', 'shoulder', 'chest', 'stomach', 'back', 'neck']);
  });

  it('still applies precise rich-garment metadata over a topless starter state', () => {
    const appearance = defaultAppearance('topless-rich-coverage');
    appearance.equipment.top.itemId = 'starter.top.topless';
    const visible = visibleTattoosForPresentation(tattoos, {
      appearance,
      clothing: [clothing({ tattooCoverageSlots: ['left_forearm', 'chest', 'neck'] })],
      presentation: 'stage',
    });
    expect(visible.map(tattoo => tattoo.id)).toEqual(['wrist', 'shoulder', 'stomach', 'back']);
  });


  it('lets rich garment metadata replace starter-slot coverage instead of inheriting it', () => {
    const appearance = defaultAppearance('rich-top-override');
    const richTop = clothing({ tattooCoverageSlots: ['chest'] });
    const visible = visibleTattoosForPresentation(tattoos, {
      appearance,
      clothing: [richTop],
      presentation: 'stage',
    });
    expect(visible.map(tattoo => tattoo.id)).toEqual(['arm', 'wrist', 'shoulder', 'stomach', 'back', 'neck']);
  });

  it('shows every tattoo in Tattoo Parlour regardless of saved clothes or rich coverage', () => {
    const appearance = defaultAppearance('tattoo-parlour-coverage');
    appearance.equipment.top.itemId = 'starter.top.suit';
    const visible = visibleTattoosForPresentation(tattoos, {
      appearance,
      clothing: [clothing({ tattooCoverageSlots: ['left_forearm', 'neck', 'chest'] })],
      presentation: 'tattoo',
    });
    expect(visible).toEqual(tattoos);
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
