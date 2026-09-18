import { describe, expect, it } from 'vitest';
import type { ClothingItem } from '@/hooks/useSkinStore';
import { buildProceduralGarment, disposeProceduralGarment } from './proceduralGarmentRenderer';

function item(category: string, wearableSlot: string, garment: Record<string, unknown> = {}): ClothingItem {
  return {
    id: `${wearableSlot}-item`,
    name: 'Rig test garment',
    description: null,
    category,
    wearable_slot: wearableSlot,
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
    garment_config: garment,
    material_config: { fabric: 'cotton', primaryColor: '#20232b', secondaryColor: '#d8ad49' },
    pattern_config: { type: 'solid' },
    detail_layers: [],
  } as ClothingItem;
}

function anchors(clothing: ClothingItem) {
  const garment = buildProceduralGarment(clothing);
  const result: string[] = [];
  garment.traverse(object => {
    if ((object as any).isMesh) result.push(String(object.userData.rigAnchor || ''));
  });
  disposeProceduralGarment(garment);
  return result;
}

describe('procedural garment stage rig anchors', () => {
  it('builds top garments from an extruded clothing panel rather than a primitive capsule or cylinder', () => {
    const garment = buildProceduralGarment(item('t-shirt', 'top', { sleeve: 'short', silhouette: 'classic', collar: 'crew' }));
    const torso = garment.children.find(child => child.userData.rigAnchor === 'Torso') as any;
    expect(torso?.geometry?.type).toBe('ExtrudeGeometry');
    torso.geometry.computeBoundingBox();
    const box = torso.geometry.boundingBox;
    expect(box.max.x - box.min.x).toBeGreaterThan(box.max.z - box.min.z);
    expect(box.max.y - box.min.y).toBeGreaterThan(.5);
    disposeProceduralGarment(garment);
  });

  it('creates a real neckline notch in the top panel', () => {
    const crew = buildProceduralGarment(item('t-shirt', 'top', { sleeve: 'none', collar: 'crew' }));
    const vneck = buildProceduralGarment(item('t-shirt', 'top', { sleeve: 'none', collar: 'v-neck' }));
    const crewTorso = crew.children.find(child => child.userData.rigAnchor === 'Torso') as any;
    const vTorso = vneck.children.find(child => child.userData.rigAnchor === 'Torso') as any;
    expect(crewTorso.geometry.attributes.position.count).toBeGreaterThan(20);
    expect(vTorso.geometry.attributes.position.count).toBeGreaterThan(20);
    expect(vTorso.geometry.attributes.position.count).not.toBe(crewTorso.geometry.attributes.position.count);
    disposeProceduralGarment(crew);
    disposeProceduralGarment(vneck);
  });

  it('lays sleeves along the avatar arms instead of vertically', () => {
    const garment = buildProceduralGarment(item('shirt', 'top', { sleeve: 'elbow' }));
    const sleeves = garment.children.filter(child => String(child.userData.rigAnchor).startsWith('UpperArm')) as any[];
    expect(sleeves).toHaveLength(2);
    expect(Math.abs(sleeves[0].rotation.z)).toBeCloseTo(Math.PI / 2);
    disposeProceduralGarment(garment);
  });

  it('anchors top bodies and sleeves to torso and both upper arms', () => {
    const result = anchors(item('shirt', 'top', { sleeve: 'long' }));
    expect(result).toContain('Torso');
    expect(result).toContain('UpperArm.L');
    expect(result).toContain('UpperArm.R');
  });

  it('anchors trouser legs independently to both upper legs', () => {
    expect(anchors(item('pants', 'bottom'))).toEqual(expect.arrayContaining(['UpperLeg.L', 'UpperLeg.R']));
  });

  it('anchors footwear independently to both feet', () => {
    expect(anchors(item('shoes', 'footwear'))).toEqual(expect.arrayContaining(['Foot.L', 'Foot.R']));
  });

  it('anchors headwear to the head', () => {
    const result = anchors(item('hat', 'headwear'));
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(anchor => anchor === 'Head')).toBe(true);
  });
});
