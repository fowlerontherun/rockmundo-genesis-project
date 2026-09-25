import * as T from 'three';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import { richGarmentSlot } from '@/features/clothing-preview/richGarmentVisuals';
import type { PlayerAppearance } from '../appearance';
import { addAccessories } from '../accessories';
import type { HeadAccessoryFit } from '../accessoryGeometry';
import { createAvatarHairTextureCache } from '../avatarMaterialQuality';
import { addFaceDetails } from '../faceDetails';
import type { AvatarVisualQuality } from '../avatarVisualQuality';
import { addHair } from '../hair';
import { addTattoos, type ResolvedTattooVisual } from '../tattoos';
import { avatarV2MaterialRole } from './avatarV2Materials';

const clean = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();

export function avatarV2BoneMap(root: T.Object3D) {
  const bones = new Map<string, T.Bone>();
  root.traverse(node => {
    if (node instanceof T.Bone) bones.set(node.name, node);
  });
  return bones;
}

function findBone(bones: Map<string, T.Bone>, names: string[]) {
  for (const bone of bones.values()) {
    const name = clean(bone.name);
    if (names.some(candidate => clean(candidate) === name)) return bone;
  }
}

function hasHeadCompatibility(
  appearance: PlayerAppearance,
  clothing: ResolvedEquippedClothing[],
) {
  const cut = appearance.head.hairStyle ?? 'original';
  const facial = appearance.head.facialHair ?? 'none';
  const accessories = appearance.accessories;
  const starterAccessory =
    (accessories?.hat ?? 'none') !== 'none' ||
    (accessories?.glasses ?? 'none') !== 'none' ||
    (accessories?.leftEarring ?? accessories?.earrings ?? 'none') !== 'none' ||
    (accessories?.rightEarring ?? accessories?.earrings ?? 'none') !== 'none';
  const authoredHeadwear = clothing.some(row =>
    ['headwear', 'eyewear'].includes(richGarmentSlot(row.item)),
  );
  return cut !== 'original' || facial !== 'none' || starterAccessory || authoredHeadwear;
}

export function avatarV2CompatibilityHairQuality(
  quality: AvatarVisualQuality,
): AvatarVisualQuality {
  if (quality === 'high') return 'ultra';
  if (quality === 'ultra') return 'cinematic';
  return quality;
}

export function avatarV2HeadAccessoryFit(root: T.Object3D): HeadAccessoryFit {
  root.updateMatrixWorld(true);
  const point = (name: string) => {
    const bone = root.getObjectByName(name);
    return bone instanceof T.Bone ? bone.getWorldPosition(new T.Vector3()) : null;
  };
  return {
    leftEye: point('Eye.L'),
    rightEye: point('Eye.R'),
    leftEar: point('EarAnchor.L'),
    rightEar: point('EarAnchor.R'),
  };
}

function suppressAuthoredHair(root: T.Object3D, appearance: PlayerAppearance) {
  const cut = appearance.head.hairStyle ?? 'original';
  if (cut === 'original') return;
  root.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (!materials.length) return;
    const names = materials.map(material => material.name.toLowerCase());
    const hairOnly = names.every(name => /hair/.test(name) && !/brow|eyebrow/.test(name));
    if (hairOnly) {
      node.visible = false;
      node.userData.rockmundoV2SuppressedAuthoredHair = true;
    }
  });
}

function suppressAuthoredEyebrows(root: T.Object3D, appearance: PlayerAppearance) {
  if ((appearance.head.eyebrowStyle ?? 'natural') === 'natural') return;
  root.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    let hidden = 0;
    for (const material of materials) {
      if (avatarV2MaterialRole(material.name) !== 'eyebrows') continue;
      material.visible = false;
      hidden += 1;
    }
    if (hidden) node.userData.rockmundoV2SuppressedAuthoredEyebrows = hidden;
  });
}

function hasFaceDetailCompatibility(appearance: PlayerAppearance) {
  return (appearance.head.eyebrowStyle ?? 'natural') !== 'natural'
    || (appearance.head.skinDetail ?? 'smooth') !== 'smooth';
}

/**
 * Applies the shared RockMundo appearance systems after a V2 body and its
 * authored garments have been assembled. Everything is rig-bound to the
 * normalized V2 skeleton, so V2 can retain the existing saved hairstyle,
 * starter accessories and Tattoo Parlour visuals without reintroducing V1 body
 * geometry.
 */
export function applyAvatarV2Compatibility(
  root: T.Object3D,
  appearance: PlayerAppearance,
  tattoos: ResolvedTattooVisual[] = [],
  clothing: ResolvedEquippedClothing[] = [],
  quality: AvatarVisualQuality = 'balanced',
) {
  const bones = avatarV2BoneMap(root);
  const head = findBone(bones, ['Head']);
  const faceDetails = hasFaceDetailCompatibility(appearance);

  if (faceDetails) {
    if (!head) throw new Error('Avatar V2 is missing its normalized Head bone for face detail compatibility.');
    suppressAuthoredEyebrows(root, appearance);
    addFaceDetails(root, appearance, head, quality, { applyFaceShape: false });
  }

  if (hasHeadCompatibility(appearance, clothing)) {
    if (!head) throw new Error('Avatar V2 is missing its normalized Head bone for hair/accessories.');
    suppressAuthoredHair(root, appearance);
    const hairQuality = avatarV2CompatibilityHairQuality(quality);
    addHair(root, appearance, head, hairQuality, createAvatarHairTextureCache(hairQuality));
    addAccessories(root, appearance, head, clothing, quality, avatarV2HeadAccessoryFit(root));
  }

  addTattoos(root, tattoos, bones);
  root.userData.rockmundoAvatarV2Compatibility = {
    hairAndAccessories: hasHeadCompatibility(appearance, clothing),
    accessoryAnchors: hasHeadCompatibility(appearance, clothing)
      ? ['Eye.L', 'Eye.R', 'EarAnchor.L', 'EarAnchor.R']
      : [],
    hairQuality: hasHeadCompatibility(appearance, clothing)
      ? avatarV2CompatibilityHairQuality(quality)
      : null,
    faceDetails,
    eyebrowStyle: appearance.head.eyebrowStyle ?? 'natural',
    skinDetail: appearance.head.skinDetail ?? 'smooth',
    tattoos: tattoos.length,
    clothing: clothing.length,
  };
  root.updateMatrixWorld(true);
}
