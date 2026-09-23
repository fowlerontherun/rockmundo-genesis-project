import * as T from 'three';
import { describe, expect, it } from 'vitest';
import type { ClothingItem } from '@/hooks/useSkinStore';
import { buildProceduralGarment, disposeProceduralGarment } from './proceduralGarmentRenderer';
import { isCompositeSurfaceLayer } from './garmentSurfaceTextures';

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
    if (object instanceof T.Mesh) result.push(String(object.userData.rigAnchor || ''));
  });
  disposeProceduralGarment(garment);
  return result;
}

describe('procedural garment stage rig anchors', () => {
  it('keeps default tops within avatar-sized bounds instead of spanning the whole scene', () => {
    const garment = buildProceduralGarment(item('t-shirt', 'top', { sleeve: 'short', silhouette: 'classic', collar: 'crew' }));
    const box = new T.Box3().setFromObject(garment);
    expect(box.max.x - box.min.x).toBeLessThan(1.45);
    expect(box.max.y - box.min.y).toBeLessThan(1.65);
    disposeProceduralGarment(garment);
  });

  it('treats editor detail scale 100 as 100 percent, not one hundred world units', () => {
    const clothing = item('t-shirt', 'top', { sleeve: 'none' });
    clothing.detail_layers = [{
      id: 'detail-1',
      type: 'graphic',
      name: 'Chest graphic',
      zone: 'main',
      color: '#ffffff',
      secondaryColor: '#000000',
      scale: 100,
      rotation: 0,
      opacity: 100,
      offsetX: 0,
      offsetY: 0,
    }] as any;
    const garment = buildProceduralGarment(clothing);
    const detail = garment.children[garment.children.length - 1] as T.Mesh;
    detail.geometry.computeBoundingBox();
    const box = detail.geometry.boundingBox;
    if (!box) throw new Error('Expected detail bounds');
    expect(box.max.x - box.min.x).toBeLessThan(.2);
    expect(box.max.y - box.min.y).toBeLessThan(.15);
    disposeProceduralGarment(garment);
  });

  it('classifies printable artwork separately from structural garment details', () => {
    expect(isCompositeSurfaceLayer({ type: 'text' } as any)).toBe(true);
    expect(isCompositeSurfaceLayer({ type: 'graphic' } as any)).toBe(true);
    expect(isCompositeSurfaceLayer({ type: 'badge' } as any)).toBe(true);
    expect(isCompositeSurfaceLayer({ type: 'zip' } as any)).toBe(false);
    expect(isCompositeSurfaceLayer({ type: 'studs' } as any)).toBe(false);
  });

  it('keeps structural details as geometry while compositing flat artwork', () => {
    const clothing = item('jacket', 'top', { sleeve: 'long', closure: 'zip' });
    clothing.detail_layers = [
      { id: 'zip-1', type: 'zip', name: 'Side zip', zone: 'trim', color: '#cccccc', scale: 100, rotation: 0, opacity: 100, offsetX: 20, offsetY: 0, surface: 'front' },
    ] as any;
    const garment = buildProceduralGarment(clothing);
    const structural = garment.children.filter(child => child instanceof T.Mesh && child.userData.rigAnchor === 'Torso');
    expect(structural.length).toBeGreaterThan(1);
    disposeProceduralGarment(garment);
  });

  it('places sleeve details on the matching arm anchor', () => {
    const clothing = item('t-shirt', 'top', { sleeve: 'short' });
    clothing.detail_layers = [{
      id: 'left-sleeve',
      type: 'badge',
      name: 'Sleeve badge',
      zone: 'main',
      color: '#ffffff',
      scale: 100,
      rotation: 0,
      opacity: 100,
      offsetX: 0,
      offsetY: 0,
      surface: 'left-sleeve',
      widthScale: 100,
      heightScale: 100,
    }] as any;
    const garment = buildProceduralGarment(clothing);
    const detail = garment.children[garment.children.length - 1] as T.Mesh;
    expect(detail.userData.rigAnchor).toBe('UpperArm.L');
    expect(Math.abs(detail.rotation.y)).toBeCloseTo(Math.PI / 2);
    disposeProceduralGarment(garment);
  });

  it('places back details behind the garment instead of floating on the chest', () => {
    const clothing = item('t-shirt', 'top', { sleeve: 'none' });
    clothing.detail_layers = [{
      id: 'back-print',
      type: 'graphic',
      name: 'Back print',
      zone: 'main',
      color: '#ffffff',
      scale: 100,
      rotation: 0,
      opacity: 100,
      offsetX: 0,
      offsetY: 0,
      surface: 'back',
      widthScale: 100,
      heightScale: 100,
    }] as any;
    const garment = buildProceduralGarment(clothing);
    const detail = garment.children[garment.children.length - 1] as T.Mesh;
    expect(detail.position.z).toBeLessThan(0);
    expect(Math.abs(detail.rotation.y)).toBeCloseTo(Math.PI);
    disposeProceduralGarment(garment);
  });

  it('renders shorts substantially shorter than full trousers', () => {
    const shorts = buildProceduralGarment(item('shorts', 'bottom'));
    const trousers = buildProceduralGarment(item('pants', 'bottom'));
    const shortBox = new T.Box3().setFromObject(shorts);
    const trouserBox = new T.Box3().setFromObject(trousers);
    expect(shortBox.max.y - shortBox.min.y).toBeLessThan(trouserBox.max.y - trouserBox.min.y);
    disposeProceduralGarment(shorts);
    disposeProceduralGarment(trousers);
  });
  it('builds top garments from an extruded clothing panel rather than a primitive capsule or cylinder', () => {
    const garment = buildProceduralGarment(item('t-shirt', 'top', { sleeve: 'short', silhouette: 'classic', collar: 'crew' }));
    const torso = garment.children.find(
      (child): child is T.Mesh => child instanceof T.Mesh && child.userData.rigAnchor === 'Torso',
    );
    expect(torso?.geometry.type).toBe('ExtrudeGeometry');
    if (!torso) throw new Error('Expected torso mesh');
    torso.geometry.computeBoundingBox();
    const box = torso.geometry.boundingBox;
    if (!box) throw new Error('Expected torso bounds');
    expect(box.max.x - box.min.x).toBeGreaterThan(box.max.z - box.min.z);
    expect(box.max.y - box.min.y).toBeGreaterThan(.5);
    disposeProceduralGarment(garment);
  });

  it('creates a real neckline notch in the top panel', () => {
    const crew = buildProceduralGarment(item('t-shirt', 'top', { sleeve: 'none', collar: 'crew' }));
    const vneck = buildProceduralGarment(item('t-shirt', 'top', { sleeve: 'none', collar: 'v-neck' }));
    const crewTorso = crew.children.find(
      (child): child is T.Mesh => child instanceof T.Mesh && child.userData.rigAnchor === 'Torso',
    );
    const vTorso = vneck.children.find(
      (child): child is T.Mesh => child instanceof T.Mesh && child.userData.rigAnchor === 'Torso',
    );
    if (!crewTorso || !vTorso) throw new Error('Expected neckline torso meshes');
    expect(crewTorso.geometry.attributes.position.count).toBeGreaterThan(20);
    expect(vTorso.geometry.attributes.position.count).toBeGreaterThan(20);
    expect(vTorso.geometry.attributes.position.count).not.toBe(crewTorso.geometry.attributes.position.count);
    disposeProceduralGarment(crew);
    disposeProceduralGarment(vneck);
  });

  it('lays sleeves along the avatar arms instead of vertically', () => {
    const garment = buildProceduralGarment(item('shirt', 'top', { sleeve: 'elbow' }));
    const sleeves = garment.children.filter(
      (child): child is T.Mesh => child instanceof T.Mesh && String(child.userData.rigAnchor).startsWith('UpperArm'),
    );
    expect(sleeves).toHaveLength(2);
    expect(Math.abs(sleeves[0].rotation.z)).toBeCloseTo(Math.PI / 2);
    disposeProceduralGarment(garment);
  });

  it('adds visible construction seams and folds without changing rig ownership', () => {
    const garment = buildProceduralGarment(item('shirt', 'top', { sleeve: 'long', silhouette: 'classic', collar: 'crew' }));
    expect(garment.getObjectByName('garment-shoulder-seam-left')).toBeTruthy();
    expect(garment.getObjectByName('garment-shoulder-seam-right')).toBeTruthy();
    expect(garment.getObjectByName('garment-hem-seam')).toBeTruthy();
    expect(garment.getObjectByName('garment-front-fold-1')).toBeTruthy();
    for (const name of ['garment-shoulder-seam-left', 'garment-shoulder-seam-right', 'garment-hem-seam', 'garment-front-fold-1']) {
      expect(garment.getObjectByName(name)?.userData.rigAnchor).toBe('Torso');
    }
    disposeProceduralGarment(garment);
  });

  it('anchors top bodies and sleeves to torso and both upper arms', () => {
    const result = anchors(item('shirt', 'top', { sleeve: 'long' }));
    expect(result).toContain('Torso');
    expect(result).toContain('UpperArm.L');
    expect(result).toContain('UpperArm.R');
  });

  it('anchors trouser legs and construction creases independently to both upper legs', () => {
    const garment = buildProceduralGarment(item('pants', 'bottom'));
    expect(anchors(item('pants', 'bottom'))).toEqual(expect.arrayContaining(['UpperLeg.L', 'UpperLeg.R']));
    expect(garment.getObjectByName('garment-trouser-crease-left')?.userData.rigAnchor).toBe('UpperLeg.L');
    expect(garment.getObjectByName('garment-trouser-crease-right')?.userData.rigAnchor).toBe('UpperLeg.R');
    disposeProceduralGarment(garment);
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
