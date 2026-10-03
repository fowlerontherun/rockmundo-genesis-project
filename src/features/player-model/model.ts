import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { demoAssetUrl } from '@/features/gig-demo-3d/assets';
import { headModelStyle, equipmentItem, equipmentStyle, modelFile, visualEquipmentItem, type PlayerAppearance } from './appearance';

import { addHair, isScalpHair } from './hair';
import { addAccessories } from './accessories';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import { richGarmentSlot } from '@/features/clothing-preview/richGarmentVisuals';
import { curatedDonorForSlot } from '@/features/clothing-preview/curatedDonorGarments';
import { addCuratedSkinDetails } from '@/features/clothing-preview/curatedSkinDetails';
import { addFaceDetails, skinRoughness } from './faceDetails';
import { addTattoos, type ResolvedTattooVisual } from './tattoos';
import { fabricNormalTexture, fabricTexture, fabricUVs } from './fabrics';
import { curatedAlbedoTexture, curatedBumpScale, curatedNormalTexture, curatedReliefTexture, curatedRoughnessTexture, curatedTartanTexture, curatedTextureForQuality, type CuratedFinish } from './curatedSurfaceMaps';
import { attachSurfaceGraphic, curvedGraphicGeometry, findFrontSurfaceAttachment } from './curatedSurfaceAttachment';
import { applyCuratedMacroShading } from './curatedMacroShading';
import { curatedMaterialProfile } from './curatedMaterialProfile';
import { applyAvatarEyeQuality, applyAvatarHairQuality, applyAvatarSkinQuality, createAvatarHairTextureCache, createAvatarSkinTextureCache } from './avatarMaterialQuality';
import type { AvatarVisualQuality } from './avatarVisualQuality';
import { applyAvatarSkinMacroShading } from './avatarSkinMacroShading';
import { createCorneaOverlay, upgradeCuratedGarmentMaterial, upgradeSkinMaterial, upgradeStarterFabricMaterial } from './avatarPhysicalMaterials';
import { buildProceduralGarment, type GarmentRigAnchor } from '@/features/clothing-preview/proceduralGarmentRenderer';
import type { ClothingItem } from '@/hooks/useSkinStore';
import { merchElementPrintPosition, merchFrontElements, merchHasRenderableFront, type ResolvedMerchWearable } from './merchWearables';

export type ModelLibrary = Map<string, T.Object3D>;
export type PlayerModelPresentation = 'stage' | 'tattoo';
export function requiredModelFiles(appearances: PlayerAppearance[]) {
  return [...new Set(appearances.flatMap(a => [headModelStyle(a), ...(['top', 'bottom', 'footwear'] as const).map(slot => equipmentStyle(a, slot))].map(style => modelFile(a.body.frame, style))))];
}
export async function loadModelLibrary(files: string[], manager?: T.LoadingManager): Promise<ModelLibrary> {
  const loader = new GLTFLoader(manager), library: ModelLibrary = new Map();
  // Wait for every in-flight asset before releasing on failure.
  const results = await Promise.allSettled([...new Set(files)].map(async file => {
    const url = demoAssetUrl(file);
    const gltf = await loader.loadAsync(url);
    library.set(file, gltf.scene);
  }));
  const failed = results.find(result => result.status === 'rejected');
  if (failed?.status === 'rejected') { library.forEach(disposeModel); throw failed.reason; }
  return library;
}

const cleanBoneName = (value: string) => value.replace(/[_.]/g, '').toLowerCase();
function findPlayerBone(bones: Map<string, T.Bone>, names: string[]) {
  for (const bone of bones.values()) if (names.some(name => cleanBoneName(bone.name) === cleanBoneName(name))) return bone;
}

function applyFeminineBreastSize(mesh: T.SkinnedMesh, size: number) {
  if (!Number.isFinite(size) || Math.abs(size - 1) < .001) return;
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position') as T.BufferAttribute | undefined;
  const skinIndex = geometry.getAttribute('skinIndex') as T.BufferAttribute | undefined;
  const skinWeight = geometry.getAttribute('skinWeight') as T.BufferAttribute | undefined;
  if (!position || !skinIndex || !skinWeight) return;

  // Derive the deformation volume from chest-weighted vertices, not the
  // whole body mesh. The V1 donor includes arms/hands in the same geometry and
  // their Z extents can move the global midpoint in front of the torso. That
  // made the slider save correctly while barely touching the visible chest.
  let chestMinX = Infinity, chestMaxX = -Infinity, chestMinZ = Infinity, chestMaxZ = -Infinity;
  const chestWeights = new Float32Array(position.count);
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    let chestWeight = 0;
    for (let channel = 0; channel < 4; channel += 1) {
      const weight = skinWeight.getComponent(vertex, channel);
      if (weight <= 0) continue;
      const boneName = mesh.skeleton.bones[skinIndex.getComponent(vertex, channel)]?.name ?? '';
      if (/spine2|spine\.002|chest|upperchest/i.test(boneName)) chestWeight += weight;
      else if (/spine1|spine\.001/i.test(boneName)) chestWeight += weight * .35;
    }
    chestWeights[vertex] = chestWeight;
    if (chestWeight < .18) continue;
    const x = position.getX(vertex), z = position.getZ(vertex);
    chestMinX = Math.min(chestMinX, x); chestMaxX = Math.max(chestMaxX, x);
    chestMinZ = Math.min(chestMinZ, z); chestMaxZ = Math.max(chestMaxZ, z);
  }
  if (!Number.isFinite(chestMinZ) || !Number.isFinite(chestMaxZ)) return;

  const centreZ = (chestMinZ + chestMaxZ) * .5;
  const frontDepth = Math.max(.001, chestMaxZ - centreZ);
  const centreX = (chestMinX + chestMaxX) * .5;
  const width = Math.max(.001, chestMaxX - chestMinX);
  const delta = T.MathUtils.clamp(size, .75, 1.35) - 1;
  let affected = 0;

  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const chestWeight = chestWeights[vertex];
    if (chestWeight < .18) continue;

    const x = position.getX(vertex), z = position.getZ(vertex);
    const front = T.MathUtils.clamp((z - centreZ) / frontDepth, 0, 1);
    if (front <= .04) continue;
    const lateral = 1 - T.MathUtils.clamp(Math.abs(x - centreX) / (width * .48), 0, 1);
    const influence = T.MathUtils.clamp(chestWeight, 0, 1) * Math.pow(front, 1.2) * (.48 + .52 * lateral);
    if (influence <= .02) continue;

    // Make the full slider range visually meaningful while retaining the donor
    // rig, skin weights and garment fit. +Z is the established V1 front axis
    // (also used by findFrontSurfaceAttachment).
    position.setZ(vertex, z + frontDepth * delta * 1.15 * influence);
    position.setX(vertex, centreX + (x - centreX) * (1 + delta * .12 * influence));
    affected += 1;
  }

  if (!affected) return;
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.userData.avatarV1BreastSize = size;
  mesh.userData.avatarV1BreastSizeAffectedVertices = affected;
}

const V1_SKINNED_TEE_ITEMS = new Set([
  'starter.top.casual',
  'starter.top.stripe',
  'starter.top.plain-black',
  'starter.top.plain-white',
  'starter.top.vintage-charcoal',
  'starter.top.v-neck',
]);

// Keep unverified V1 silhouettes out of the live renderer. Their saved IDs remain
// valid and resolve through visualEquipmentItem() to a safe donor fallback.
const V1_SKINNED_OUTERWEAR_ITEMS = new Set<string>([
  'starter.top.hoodie',
  'starter.top.zip-hoodie',
]);

const V1_CROPPED_BOTTOM_ITEMS = new Set([
  'starter.bottom.denim-shorts',
  'starter.bottom.boxer-briefs',
  'starter.bottom.briefs',
]);

const V1_SHAPED_TROUSER_ITEMS = new Set([
  'starter.bottom.chinos',
  'starter.bottom.black-jeans',
  'starter.bottom.dark-slim-jeans',
]);

function trimV1TeeToShortSleeves(mesh: T.SkinnedMesh, materials: T.Material[]) {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position') as T.BufferAttribute | undefined;
  const skinIndex = geometry.getAttribute('skinIndex') as T.BufferAttribute | undefined;
  const skinWeight = geometry.getAttribute('skinWeight') as T.BufferAttribute | undefined;
  if (!position || !skinIndex || !skinWeight) return;
  const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count: geometry.index?.count ?? position.count, materialIndex: 0 }];

  const garmentMaterialIndices = new Set<number>();
  materials.forEach((material, index) => {
    if (!/skin|eye|earring|metal|hair/i.test(material.name)) garmentMaterialIndices.add(index);
  });
  if (!garmentMaterialIndices.size) return;

  const boneIndex = (pattern: RegExp) => mesh.skeleton.bones.findIndex(bone => pattern.test(cleanBoneName(bone.name)));
  const bindPosition = (index: number) => {
    if (index < 0 || !mesh.skeleton.boneInverses[index]) return null;
    return new T.Vector3()
      .setFromMatrixPosition(mesh.skeleton.boneInverses[index].clone().invert())
      .applyMatrix4(mesh.bindMatrixInverse);
  };
  const arm = {
    L: {
      upperIndex: boneIndex(/^upperarml$/),
      lowerIndex: boneIndex(/^lowerarml$|^forearml$/),
    },
    R: {
      upperIndex: boneIndex(/^upperarmr$/),
      lowerIndex: boneIndex(/^lowerarmr$|^forearmr$/),
    },
  } as const;

  const segments = {
    L: { shoulder: bindPosition(arm.L.upperIndex), elbow: bindPosition(arm.L.lowerIndex) },
    R: { shoulder: bindPosition(arm.R.upperIndex), elbow: bindPosition(arm.R.lowerIndex) },
  } as const;

  const vertexArm = (vertex: number) => {
    let upperL = 0, lowerL = 0, upperR = 0, lowerR = 0;
    for (let channel = 0; channel < 4; channel += 1) {
      const weight = skinWeight.getComponent(vertex, channel);
      if (weight <= 0) continue;
      const index = skinIndex.getComponent(vertex, channel);
      if (index === arm.L.upperIndex) upperL += weight;
      else if (index === arm.L.lowerIndex) lowerL += weight;
      else if (index === arm.R.upperIndex) upperR += weight;
      else if (index === arm.R.lowerIndex) lowerR += weight;
    }
    const side = upperL + lowerL >= upperR + lowerR ? 'L' : 'R';
    const upper = side === 'L' ? upperL : upperR;
    const lower = side === 'L' ? lowerL : lowerR;
    const segment = segments[side];
    let along = 0;
    if (segment.shoulder && segment.elbow) {
      const axis = segment.elbow.clone().sub(segment.shoulder);
      const lengthSq = axis.lengthSq();
      if (lengthSq > 1e-6) {
        along = T.MathUtils.clamp(
          new T.Vector3(position.getX(vertex), position.getY(vertex), position.getZ(vertex))
            .sub(segment.shoulder)
            .dot(axis) / lengthSq,
          0,
          1.5,
        );
      }
    }
    return { upper, lower, armWeight: upper + lower, along };
  };

  const sourceIndex = geometry.index;
  const indexAt = (offset: number) => sourceIndex ? sourceIndex.getX(offset) : offset;
  const nextIndices: number[] = [];
  const nextGroups: Array<{ start: number; count: number; materialIndex: number }> = [];
  let removed = 0;

  for (const group of groups) {
    const start = nextIndices.length;
    const garment = garmentMaterialIndices.has(group.materialIndex ?? 0);
    for (let i = group.start; i + 2 < group.start + group.count; i += 3) {
      const a = indexAt(i), b = indexAt(i + 1), c = indexAt(i + 2);
      if (garment) {
        const values = [vertexArm(a), vertexArm(b), vertexArm(c)];
        const avgArm = (values[0].armWeight + values[1].armWeight + values[2].armWeight) / 3;
        const avgLower = (values[0].lower + values[1].lower + values[2].lower) / 3;
        const avgAlong = (values[0].along + values[1].along + values[2].along) / 3;
        // Keep the shoulder and first half of the upper-arm garment, but remove
        // anything that belongs to the forearm or extends past a short T-shirt sleeve.
        const beyondShortSleeve = avgLower > .08 || (avgArm > .42 && avgAlong > .56);
        if (beyondShortSleeve) { removed += 1; continue; }
      }
      nextIndices.push(a, b, c);
    }
    const count = nextIndices.length - start;
    if (count) nextGroups.push({ start, count, materialIndex: group.materialIndex ?? 0 });
  }

  if (!removed || !nextIndices.length) return;
  geometry.setIndex(nextIndices);
  geometry.clearGroups();
  nextGroups.forEach(group => geometry.addGroup(group.start, group.count, group.materialIndex));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.userData.avatarV1ShortSleeveTrim = true;
  mesh.userData.avatarV1ShortSleeveRemovedTriangles = removed;
}

function polishV1CrewTeeGeometry(
  mesh: T.SkinnedMesh,
  materials: T.Material[],
  itemId: string,
) {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position') as T.BufferAttribute | undefined;
  const skinIndex = geometry.getAttribute('skinIndex') as T.BufferAttribute | undefined;
  const skinWeight = geometry.getAttribute('skinWeight') as T.BufferAttribute | undefined;
  if (!position || !skinIndex || !skinWeight || !materials.length) return;
  const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count: geometry.index?.count ?? position.count, materialIndex: 0 }];

  const garmentMaterialIndices = new Set<number>();
  materials.forEach((material, index) => {
    const name = material.name.toLowerCase();
    if (!/skin|eye|earring|metal|hair/.test(name)) garmentMaterialIndices.add(index);
  });
  if (!garmentMaterialIndices.size) return;

  const garmentVertices = new Set<number>();
  const index = geometry.index;
  for (const group of groups) {
    if (!garmentMaterialIndices.has(group.materialIndex ?? 0)) continue;
    const end = group.start + group.count;
    for (let i = group.start; i < end; i += 1) {
      garmentVertices.add(index ? index.getX(i) : i);
    }
  }
  if (!garmentVertices.size) return;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const vertex of garmentVertices) {
    const x = position.getX(vertex), y = position.getY(vertex), z = position.getZ(vertex);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  const centreX = (minX + maxX) * .5;
  const centreZ = (minZ + maxZ) * .5;
  const height = Math.max(.001, maxY - minY);
  let sleeveVertices = 0;

  for (const vertex of garmentVertices) {
    const y = position.getY(vertex);
    const yNorm = (y - minY) / height;
    let armWeight = 0;
    for (let channel = 0; channel < 4; channel += 1) {
      const weight = skinWeight.getComponent(vertex, channel);
      if (weight <= 0) continue;
      const boneIndex = skinIndex.getComponent(vertex, channel);
      const boneName = mesh.skeleton.bones[boneIndex]?.name ?? '';
      if (/upperarm/i.test(boneName)) armWeight += weight;
    }

    const x = position.getX(vertex);
    const z = position.getZ(vertex);
    // Keep the proven donor skinning but make the casual body read as a fitted
    // short-sleeve crew tee rather than the bulkier source top. These are small
    // bind-space edits only; no bones, weights or inverse binds are replaced.
    const vintage = itemId === 'starter.top.vintage-charcoal';
    const vNeck = itemId === 'starter.top.v-neck';
    const torsoXScale = yNorm < .24 ? (vintage ? .90 : .925) : (vintage ? .935 : .95);
    const topDepthScale = yNorm > .68 ? (vNeck ? .80 : .82) : (vintage ? .87 : .89);
    const xScale = armWeight > .42 ? (vintage ? .76 : .79) : torsoXScale;
    const zScale = armWeight > .42 ? .84 : topDepthScale;
    if (armWeight > .42) sleeveVertices += 1;
    position.setXYZ(
      vertex,
      centreX + (x - centreX) * xScale,
      y,
      centreZ + (z - centreZ) * zScale,
    );
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.userData.avatarV1CrewTeePolished = true;
  mesh.userData.avatarV1CrewTeeVariant = itemId;
  mesh.userData.avatarV1CrewTeeVertexCount = garmentVertices.size;
  mesh.userData.avatarV1CrewTeeSleeveVertexCount = sleeveVertices;
}

function polishV1OuterwearGeometry(
  mesh: T.SkinnedMesh,
  materials: T.Material[],
  itemId: string,
) {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position') as T.BufferAttribute | undefined;
  const skinIndex = geometry.getAttribute('skinIndex') as T.BufferAttribute | undefined;
  const skinWeight = geometry.getAttribute('skinWeight') as T.BufferAttribute | undefined;
  if (!position || !skinIndex || !skinWeight || !geometry.groups.length || !materials.length) return;

  const garmentMaterialIndices = new Set<number>();
  materials.forEach((material, index) => {
    const name = material.name.toLowerCase();
    if (!/skin|eye|earring|metal|hair/.test(name)) garmentMaterialIndices.add(index);
  });
  if (!garmentMaterialIndices.size) return;

  const garmentVertices = new Set<number>();
  const index = geometry.index;
  for (const group of geometry.groups) {
    if (!garmentMaterialIndices.has(group.materialIndex ?? 0)) continue;
    for (let i = group.start; i < group.start + group.count; i += 1) {
      garmentVertices.add(index ? index.getX(i) : i);
    }
  }
  if (!garmentVertices.size) return;

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const vertex of garmentVertices) {
    minX = Math.min(minX, position.getX(vertex));
    maxX = Math.max(maxX, position.getX(vertex));
    minZ = Math.min(minZ, position.getZ(vertex));
    maxZ = Math.max(maxZ, position.getZ(vertex));
  }
  const centreX = (minX + maxX) * .5;
  const centreZ = (minZ + maxZ) * .5;
  const jacket = itemId === 'starter.top.denim-jacket';
  const flannel = itemId === 'starter.top.flannel-shirt';
  const hoodie = itemId === 'starter.top.hoodie' || itemId === 'starter.top.zip-hoodie';
  const longSleeve = itemId === 'starter.top.long-sleeve';
  let armVertices = 0;

  for (const vertex of garmentVertices) {
    let upperArmWeight = 0;
    let lowerArmWeight = 0;
    for (let channel = 0; channel < 4; channel += 1) {
      const weight = skinWeight.getComponent(vertex, channel);
      if (weight <= 0) continue;
      const boneIndex = skinIndex.getComponent(vertex, channel);
      const boneName = mesh.skeleton.bones[boneIndex]?.name ?? '';
      if (/upperarm/i.test(boneName)) upperArmWeight += weight;
      if (/lowerarm|forearm/i.test(boneName)) lowerArmWeight += weight;
    }
    const armWeight = upperArmWeight + lowerArmWeight;
    const x = position.getX(vertex);
    const y = position.getY(vertex);
    const z = position.getZ(vertex);

    let xScale = 1;
    let zScale = 1;
    if (armWeight > .34) {
      armVertices += 1;
      if (longSleeve) { xScale = .92; zScale = .93; }
      else if (hoodie) { xScale = 1.015; zScale = 1.025; }
      else if (jacket) { xScale = 1.025; zScale = 1.035; }
      else if (flannel) { xScale = .985; zScale = .985; }
    } else {
      if (longSleeve) { xScale = .955; zScale = .92; }
      else if (hoodie) { xScale = 1.025; zScale = 1.045; }
      else if (jacket) { xScale = 1.035; zScale = 1.055; }
      else if (flannel) { xScale = .99; zScale = .97; }
    }
    position.setXYZ(
      vertex,
      centreX + (x - centreX) * xScale,
      y,
      centreZ + (z - centreZ) * zScale,
    );
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.userData.avatarV1OuterwearPolished = true;
  mesh.userData.avatarV1OuterwearVariant = itemId;
  mesh.userData.avatarV1OuterwearVertexCount = garmentVertices.size;
  mesh.userData.avatarV1OuterwearArmVertexCount = armVertices;
}

function removeV1TankSleeveTriangles(mesh: T.SkinnedMesh, materials: T.Material[]) {
  const geometry = mesh.geometry;
  const skinIndex = geometry.getAttribute('skinIndex') as T.BufferAttribute | undefined;
  const skinWeight = geometry.getAttribute('skinWeight') as T.BufferAttribute | undefined;
  if (!skinIndex || !skinWeight || !geometry.groups.length) return;

  const garmentMaterialIndices = new Set<number>();
  materials.forEach((material, index) => {
    if (!/skin|eye|earring|metal|hair/i.test(material.name)) garmentMaterialIndices.add(index);
  });
  if (!garmentMaterialIndices.size) return;

  const sourceIndex = geometry.index;
  const indexAt = (offset: number) => sourceIndex ? sourceIndex.getX(offset) : offset;
  const upperArmWeight = (vertex: number) => {
    let total = 0;
    for (let channel = 0; channel < 4; channel += 1) {
      const weight = skinWeight.getComponent(vertex, channel);
      if (weight <= 0) continue;
      const boneName = mesh.skeleton.bones[skinIndex.getComponent(vertex, channel)]?.name ?? '';
      if (/upperarm/i.test(boneName)) total += weight;
    }
    return total;
  };

  const nextIndices: number[] = [];
  const nextGroups: Array<{ start: number; count: number; materialIndex: number }> = [];
  let removed = 0;
  for (const group of geometry.groups) {
    const start = nextIndices.length;
    const garment = garmentMaterialIndices.has(group.materialIndex ?? 0);
    for (let i = group.start; i + 2 < group.start + group.count; i += 3) {
      const a = indexAt(i), b = indexAt(i + 1), c = indexAt(i + 2);
      const sleeveTriangle = garment && Math.max(upperArmWeight(a), upperArmWeight(b), upperArmWeight(c)) > .42;
      if (sleeveTriangle) { removed += 1; continue; }
      nextIndices.push(a, b, c);
    }
    const count = nextIndices.length - start;
    if (count) nextGroups.push({ start, count, materialIndex: group.materialIndex ?? 0 });
  }
  if (!removed || !nextIndices.length) return;
  geometry.setIndex(nextIndices);
  geometry.clearGroups();
  nextGroups.forEach(group => geometry.addGroup(group.start, group.count, group.materialIndex));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.userData.avatarV1TankSleevesRemoved = true;
  mesh.userData.avatarV1TankRemovedTriangleCount = removed;
}

function addV1FittedLongSleeves(mesh: T.SkinnedMesh, materials: T.Material[], itemId: string) {
  const geometry = mesh.geometry;
  const skinIndex = geometry.getAttribute('skinIndex') as T.BufferAttribute | undefined;
  const skinWeight = geometry.getAttribute('skinWeight') as T.BufferAttribute | undefined;
  if (!skinIndex || !skinWeight || !geometry.groups.length) return;

  const skinMaterialIndices = new Set<number>();
  let garmentMaterial: T.MeshStandardMaterial | undefined;
  materials.forEach((material, index) => {
    if (/skin/i.test(material.name)) skinMaterialIndices.add(index);
    else if (!garmentMaterial && (material as T.MeshStandardMaterial).isMeshStandardMaterial && !/eye|earring|metal|hair/i.test(material.name)) {
      garmentMaterial = material as T.MeshStandardMaterial;
    }
  });
  if (!skinMaterialIndices.size || !garmentMaterial) return;

  const sourceIndex = geometry.index;
  const indexAt = (offset: number) => sourceIndex ? sourceIndex.getX(offset) : offset;
  const armWeights = (vertex: number) => {
    let upper = 0, lower = 0, hand = 0;
    for (let channel = 0; channel < 4; channel += 1) {
      const weight = skinWeight.getComponent(vertex, channel);
      if (weight <= 0) continue;
      const boneName = mesh.skeleton.bones[skinIndex.getComponent(vertex, channel)]?.name ?? '';
      if (/upperarm/i.test(boneName)) upper += weight;
      else if (/lowerarm|forearm/i.test(boneName)) lower += weight;
      else if (/hand|wrist/i.test(boneName)) hand += weight;
    }
    return { arm: upper + lower, hand };
  };

  const sleeveIndices: number[] = [];
  for (const group of geometry.groups) {
    if (!skinMaterialIndices.has(group.materialIndex ?? 0)) continue;
    for (let i = group.start; i + 2 < group.start + group.count; i += 3) {
      const a = indexAt(i), b = indexAt(i + 1), c = indexAt(i + 2);
      const weights = [armWeights(a), armWeights(b), armWeights(c)];
      const arm = (weights[0].arm + weights[1].arm + weights[2].arm) / 3;
      const hand = Math.max(weights[0].hand, weights[1].hand, weights[2].hand);
      if (arm > .48 && hand < .28) sleeveIndices.push(a, b, c);
    }
  }
  if (sleeveIndices.length < 12) return;

  const sleeveGeometry = geometry.clone();
  sleeveGeometry.setIndex(sleeveIndices);
  sleeveGeometry.clearGroups();
  sleeveGeometry.addGroup(0, sleeveIndices.length, 0);
  sleeveGeometry.computeVertexNormals();

  const sleevePosition = sleeveGeometry.getAttribute('position') as T.BufferAttribute;
  const sleeveNormal = sleeveGeometry.getAttribute('normal') as T.BufferAttribute | undefined;
  const usedVertices = new Set(sleeveIndices);
  const surfaceOffset = itemId === 'starter.top.hoodie' || itemId === 'starter.top.zip-hoodie' ? .007 : .004;
  if (sleeveNormal) {
    for (const vertex of usedVertices) {
      sleevePosition.setXYZ(
        vertex,
        sleevePosition.getX(vertex) + sleeveNormal.getX(vertex) * surfaceOffset,
        sleevePosition.getY(vertex) + sleeveNormal.getY(vertex) * surfaceOffset,
        sleevePosition.getZ(vertex) + sleeveNormal.getZ(vertex) * surfaceOffset,
      );
    }
    sleevePosition.needsUpdate = true;
    sleeveGeometry.computeVertexNormals();
  }
  sleeveGeometry.computeBoundingBox();
  sleeveGeometry.computeBoundingSphere();

  const sleeveMaterial = garmentMaterial.clone();
  sleeveMaterial.name = itemId === 'starter.top.hoodie' || itemId === 'starter.top.zip-hoodie' ? 'V1FittedHoodieSleeve' : 'V1FittedLongSleeve';
  sleeveMaterial.polygonOffset = true;
  sleeveMaterial.polygonOffsetFactor = -2;
  sleeveMaterial.polygonOffsetUnits = -2;
  sleeveMaterial.roughness = Math.max(.82, sleeveMaterial.roughness);

  const sleeves = new T.SkinnedMesh(sleeveGeometry, sleeveMaterial);
  sleeves.name = itemId === 'starter.top.hoodie'
    ? 'avatar-v1-fitted-hoodie-sleeves'
    : itemId === 'starter.top.zip-hoodie'
      ? 'avatar-v1-fitted-zip-hoodie-sleeves'
      : 'avatar-v1-fitted-long-sleeves';
  sleeves.castShadow = true;
  sleeves.receiveShadow = true;
  sleeves.bind(mesh.skeleton, mesh.bindMatrix.clone());
  sleeves.userData.avatarV1FittedSleeves = true;
  sleeves.userData.avatarV1FittedSleeveVariant = itemId;
  sleeves.userData.avatarV1FittedSleeveTriangleCount = sleeveIndices.length / 3;
  mesh.parent?.add(sleeves);
}

function cropV1BottomGarmentGeometry(mesh: T.SkinnedMesh, materials: T.Material[], itemId: string) {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position') as T.BufferAttribute | undefined;
  if (!position || !geometry.groups.length) return;

  const garmentMaterialIndices = new Set<number>();
  materials.forEach((material, index) => {
    if (!/skin|eye|earring|metal|hair/i.test(material.name)) garmentMaterialIndices.add(index);
  });
  if (!garmentMaterialIndices.size) return;

  const sourceIndex = geometry.index;
  const indexAt = (offset: number) => sourceIndex ? sourceIndex.getX(offset) : offset;
  let minY = Infinity, maxY = -Infinity;
  for (const group of geometry.groups) {
    if (!garmentMaterialIndices.has(group.materialIndex ?? 0)) continue;
    for (let i = group.start; i < group.start + group.count; i += 1) {
      const y = position.getY(indexAt(i));
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  if (!Number.isFinite(minY) || !Number.isFinite(maxY) || maxY <= minY) return;

  const underwear = itemId === 'starter.bottom.boxer-briefs' || itemId === 'starter.bottom.briefs';
  const cropY = minY + (maxY - minY) * (underwear ? .69 : .48);
  const nextIndices: number[] = [];
  const nextGroups: Array<{ start: number; count: number; materialIndex: number }> = [];

  for (const group of geometry.groups) {
    const start = nextIndices.length;
    const garment = garmentMaterialIndices.has(group.materialIndex ?? 0);
    for (let i = group.start; i + 2 < group.start + group.count; i += 3) {
      const a = indexAt(i), b = indexAt(i + 1), c = indexAt(i + 2);
      if (garment) {
        const lowest = Math.min(position.getY(a), position.getY(b), position.getY(c));
        if (lowest < cropY) continue;
      }
      nextIndices.push(a, b, c);
    }
    const count = nextIndices.length - start;
    if (count) nextGroups.push({ start, count, materialIndex: group.materialIndex ?? 0 });
  }

  if (!nextIndices.length) return;
  geometry.setIndex(nextIndices);
  geometry.clearGroups();
  nextGroups.forEach(group => geometry.addGroup(group.start, group.count, group.materialIndex));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.userData.avatarV1CroppedBottom = true;
  mesh.userData.avatarV1CroppedBottomVariant = itemId;
  mesh.userData.avatarV1CroppedBottomCutY = cropY;
  mesh.userData.avatarV1CroppedBottomIndexCount = nextIndices.length;
}

function shapeV1TrouserGeometry(mesh: T.SkinnedMesh, materials: T.Material[], itemId: string) {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position') as T.BufferAttribute | undefined;
  if (!position || !geometry.groups.length) return;
  const garmentMaterialIndices = new Set<number>();
  materials.forEach((material, index) => {
    if (!/skin|eye|earring|metal|hair/i.test(material.name)) garmentMaterialIndices.add(index);
  });
  const vertices = new Set<number>();
  const index = geometry.index;
  for (const group of geometry.groups) {
    if (!garmentMaterialIndices.has(group.materialIndex ?? 0)) continue;
    for (let i = group.start; i < group.start + group.count; i += 1) vertices.add(index ? index.getX(i) : i);
  }
  if (!vertices.size) return;
  let minX = Infinity, maxX = -Infinity;
  for (const vertex of vertices) {
    minX = Math.min(minX, position.getX(vertex));
    maxX = Math.max(maxX, position.getX(vertex));
  }
  const centreX = (minX + maxX) * .5;
  const widthScale =
    itemId === 'starter.bottom.dark-slim-jeans' ? .9 :
    itemId === 'starter.bottom.black-jeans' ? .935 :
    itemId === 'starter.bottom.wide-leg' ? 1.105 :
    .955;
  for (const vertex of vertices) {
    const x = position.getX(vertex);
    position.setX(vertex, centreX + (x - centreX) * widthScale);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.userData.avatarV1TrouserPolished = true;
  mesh.userData.avatarV1TrouserVariant = itemId;
}

function rockmundoWordmarkTexture() {
  const glyphs: Record<string, string[]> = {
    R:['11110','10001','10001','11110','10100','10010','10001'],
    O:['01110','10001','10001','10001','10001','10001','01110'],
    C:['01111','10000','10000','10000','10000','10000','01111'],
    K:['10001','10010','10100','11000','10100','10010','10001'],
    M:['10001','11011','10101','10101','10001','10001','10001'],
    U:['10001','10001','10001','10001','10001','10001','01110'],
    N:['10001','11001','11001','10101','10011','10011','10001'],
    D:['11110','10001','10001','10001','10001','10001','11110'],
  };
  const word='ROCKMUNDO', scale=4, gap=1, glyphW=5, glyphH=7;
  const width=(word.length*(glyphW+gap)-gap)*scale, height=glyphH*scale;
  const data=new Uint8Array(width*height*4);
  for(let i=0;i<word.length;i++) {
    const glyph=glyphs[word[i]];
    for(let y=0;y<glyphH;y++) for(let x=0;x<glyphW;x++) if(glyph[y][x]==='1') {
      for(let sy=0;sy<scale;sy++) for(let sx=0;sx<scale;sx++) {
        const px=(i*(glyphW+gap)+x)*scale+sx, py=(glyphH-1-y)*scale+sy, index=(py*width+px)*4;
        data[index]=244; data[index+1]=239; data[index+2]=226; data[index+3]=255;
      }
    }
  }
  const texture=new T.DataTexture(data,width,height,T.RGBAFormat);
  texture.name='RockmundoWordmarkHD';
  texture.colorSpace=T.SRGBColorSpace;
  texture.magFilter=T.LinearFilter;
  texture.minFilter=T.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;
  texture.needsUpdate=true;
  return texture;
}


const merchTextureCache = new Map<string, T.Texture>();

function merchCompositeTexture(merch: ResolvedMerchWearable): T.Texture | null {
  if (typeof document === 'undefined') return null;
  const elements = merchFrontElements(merch);
  if (!elements.length) return null;
  const key = merch.design_id + ':' + JSON.stringify(elements);
  const cached = merchTextureCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d'); if (!ctx) return null;
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
  texture.name = `BandMerchComposite-${merch.design_id}`; texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
  merchTextureCache.set(key, texture);

  const drawElement = (element: ReturnType<typeof merchFrontElements>[number], image?: HTMLImageElement) => {
    const printPosition = merchElementPrintPosition(element, merch.product_type);
    const x = printPosition.x * 512, y = printPosition.y * 512;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Number(element.rotation ?? 0) * Math.PI / 180);
    ctx.scale(Number(element.scale ?? 1), Number(element.scale ?? 1));
    if (image) {
      const size = 180, ratio = Math.min(size / image.width, size / image.height);
      ctx.drawImage(image, -image.width * ratio / 2, -image.height * ratio / 2, image.width * ratio, image.height * ratio);
    } else {
      const size = Math.max(10, Math.min(72, Number(element.fontSize ?? 24))) * 2;
      ctx.fillStyle = typeof element.color === 'string' ? element.color : '#ffffff';
      ctx.font = `900 ${size}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(element.text ?? '').toUpperCase(), 0, 0, 480);
    }
    ctx.restore();
  };

  const images = new Map<number, HTMLImageElement>();
  const redraw = () => {
    ctx.clearRect(0, 0, 512, 512);
    elements.forEach((element, index) => {
      if (element.type === 'image') {
        const image = images.get(index); if (image) drawElement(element, image);
      } else if (element.type === 'text') drawElement(element);
    });
    texture.needsUpdate = true;
  };
  redraw();
  elements.forEach((element, index) => {
    if (element.type !== 'image' || !element.src) return;
    const image = new Image(); image.crossOrigin = 'anonymous';
    image.onload = () => { images.set(index, image); redraw(); };
    image.onerror = () => redraw();
    image.src = element.src;
  });
  return texture;
}

function addBandMerchGraphic(root: T.Object3D, appearance: PlayerAppearance, bones: Map<string, T.Bone>, merch: ResolvedMerchWearable | null) {
  if (!merch || !merchHasRenderableFront(merch)) return;
  const chest = findPlayerBone(bones, ['Spine2','Spine.002','Chest','UpperChest']) ?? findPlayerBone(bones, ['Spine1','Spine.001']);
  if (!chest) return;
  const attachment = findFrontSurfaceAttachment(root, 'body', chest.getWorldPosition(new T.Vector3()), appearance.body.frame === 'feminine' ? .018 : .025);
  if (!attachment) return;
  const texture = merchCompositeTexture(merch); if (!texture) return;
  const material = new T.MeshStandardMaterial({
    map: texture, transparent: true, alphaTest: .08, roughness: .84, metalness: 0,
    side: T.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  material.name = 'BandMerchPrint';
  const mark = new T.Mesh(curvedGraphicGeometry(appearance.body.frame === 'feminine' ? .28 : .31, .30, .003), material);
  mark.name = `avatar-band-merch-${merch.design_id}`; mark.renderOrder = 4;
  attachSurfaceGraphic(root, chest, mark, attachment, .0005);
}

function addStarterLogoTee(root: T.Object3D, appearance: PlayerAppearance, bones: Map<string, T.Bone>, richClothing: ResolvedEquippedClothing[]) {
  const curatedLogo = richClothing.some(row => row.item.curated_asset_key === 'clothing.starter.logo-tee');
  const hasOtherTop = richClothing.some(row => richGarmentSlot(row.item) === 'top' && row.item.curated_asset_key !== 'clothing.starter.logo-tee');
  if (!curatedLogo && (appearance.equipment.top.itemId !== 'starter.top.casual' || hasOtherTop)) return;

  const chest = findPlayerBone(bones, ['Spine2','Spine.002','Chest','UpperChest'])
    ?? findPlayerBone(bones, ['Spine1','Spine.001']);
  if (!chest) return;

  const attachment = findFrontSurfaceAttachment(
    root,
    'body',
    chest.getWorldPosition(new T.Vector3()),
    appearance.body.frame === 'feminine' ? .018 : .025,
  );
  // Never fall back to an arbitrary forward offset: if the fitted shirt surface
  // cannot be resolved, omitting the print is safer than showing a floating logo.
  if (!attachment) {
    console.warn('[curated-clothing] Rockmundo logo surface could not be resolved');
    return;
  }

  const texture = rockmundoWordmarkTexture();
  const material = new T.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: .12,
    roughness: .86,
    metalness: 0,
    side: T.DoubleSide,
    depthWrite: false,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  material.name = 'RockmundoLogoPrint';

  const mark = new T.Mesh(
    curvedGraphicGeometry(appearance.body.frame === 'feminine' ? .305 : .33, .07, .0025),
    material,
  );
  mark.name = 'avatar-rockmundo-logo';
  mark.renderOrder = 3;
  attachSurfaceGraphic(root, chest, mark, attachment, .00045);
}

function addV1VNeckTrim(root: T.Object3D, appearance: PlayerAppearance, bones: Map<string, T.Bone>) {
  if (appearance.equipment.top.itemId !== 'starter.top.v-neck') return;
  const chest = findPlayerBone(bones, ['Spine2','Spine.002','Chest','UpperChest'])
    ?? findPlayerBone(bones, ['Spine1','Spine.001']);
  if (!chest) return;
  const attachment = findFrontSurfaceAttachment(
    root,
    'body',
    chest.getWorldPosition(new T.Vector3()),
    appearance.body.frame === 'feminine' ? .018 : .025,
  );
  if (!attachment) return;

  const shape = new T.Shape();
  shape.moveTo(-.085, .035);
  shape.lineTo(0, -.045);
  shape.lineTo(.085, .035);
  shape.lineTo(.071, .048);
  shape.lineTo(0, -.022);
  shape.lineTo(-.071, .048);
  shape.closePath();
  const material = new T.MeshStandardMaterial({
    color: new T.Color(appearance.equipment.top.color).offsetHSL(0, 0, -.12),
    roughness: .92,
    metalness: 0,
    side: T.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  material.name = 'V1VNeckTrim';
  const trim = new T.Mesh(new T.ShapeGeometry(shape), material);
  trim.name = 'avatar-v1-v-neck-trim';
  trim.renderOrder = 2;
  attachSurfaceGraphic(root, chest, trim, attachment, .00035);
}

function addV1OuterwearFrontDetail(root: T.Object3D, appearance: PlayerAppearance, bones: Map<string, T.Bone>) {
  const itemId = appearance.equipment.top.itemId;
  // Saved experimental items can resolve to a safe visual fallback. Never layer
  // their old construction details over that fallback, or the supposedly safe
  // outfit still contains misleading/broken geometry.
  if (visualEquipmentItem(appearance, 'top').id !== itemId) return;
  if (!['starter.top.zip-hoodie','starter.top.denim-jacket','starter.top.flannel-shirt'].includes(itemId)) return;
  const chest = findPlayerBone(bones, ['Spine2','Spine.002','Chest','UpperChest'])
    ?? findPlayerBone(bones, ['Spine1','Spine.001']);
  if (!chest) return;
  const attachment = findFrontSurfaceAttachment(
    root,
    'body',
    chest.getWorldPosition(new T.Vector3()),
    appearance.body.frame === 'feminine' ? .018 : .025,
  );
  if (!attachment) return;

  const line = new T.Mesh(
    new T.PlaneGeometry(itemId === 'starter.top.denim-jacket' ? .014 : .01, itemId === 'starter.top.flannel-shirt' ? .34 : .39),
    new T.MeshStandardMaterial({
      color: new T.Color(appearance.equipment.top.color).offsetHSL(0, 0, itemId === 'starter.top.denim-jacket' ? .12 : -.16),
      roughness: itemId === 'starter.top.zip-hoodie' ? .5 : .86,
      metalness: itemId === 'starter.top.zip-hoodie' ? .42 : .04,
      side: T.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  line.name = itemId === 'starter.top.zip-hoodie'
    ? 'avatar-v1-zip-hoodie-zip'
    : itemId === 'starter.top.denim-jacket'
      ? 'avatar-v1-denim-jacket-seam'
      : 'avatar-v1-flannel-placket';
  line.renderOrder = 2;
  attachSurfaceGraphic(root, chest, line, attachment, .0004);
}

function addV1HoodieDetails(root: T.Object3D, appearance: PlayerAppearance, bones: Map<string, T.Bone>) {
  const itemId = appearance.equipment.top.itemId;
  const zip = itemId === 'starter.top.zip-hoodie';
  if (itemId !== 'starter.top.hoodie' && !zip) return;
  if (visualEquipmentItem(appearance, 'top').id !== itemId) return;

  const chest = findPlayerBone(bones, ['Spine2','Spine.002','Chest','UpperChest'])
    ?? findPlayerBone(bones, ['Spine1','Spine.001']);
  const neck = findPlayerBone(bones, ['Neck']);
  if (!chest || !neck) return;

  root.updateMatrixWorld(true);
  const fabric = new T.MeshStandardMaterial({
    color: appearance.equipment.top.color,
    roughness: .94,
    metalness: 0,
    side: T.DoubleSide,
  });
  fabric.name = 'V1HoodieDetail';

  const hood = new T.Mesh(
    new T.TorusGeometry(appearance.body.frame === 'feminine' ? .105 : .115, .027, 10, 32, Math.PI * 1.55),
    fabric.clone(),
  );
  hood.name = zip ? 'avatar-v1-zip-hoodie-hood' : 'avatar-v1-hoodie-hood';
  hood.rotation.x = Math.PI / 2;
  hood.rotation.z = Math.PI * .22;
  hood.position.copy(neck.getWorldPosition(new T.Vector3())).add(new T.Vector3(0, -.025, -.035));
  root.add(hood);
  neck.attach(hood);

  const attachment = findFrontSurfaceAttachment(
    root,
    'body',
    chest.getWorldPosition(new T.Vector3()),
    appearance.body.frame === 'feminine' ? .018 : .025,
  );
  if (!attachment) return;

  if (zip) {
    for (const side of [-1, 1]) {
      const pocketShape = new T.Shape();
      pocketShape.moveTo(side * .012, .045);
      pocketShape.lineTo(side * .11, .04);
      pocketShape.lineTo(side * .115, -.07);
      pocketShape.lineTo(side * .018, -.07);
      pocketShape.closePath();
      const pocket = new T.Mesh(new T.ShapeGeometry(pocketShape), fabric.clone());
      pocket.name = `avatar-v1-zip-hoodie-pocket-${side < 0 ? 'left' : 'right'}`;
      pocket.renderOrder = 2;
      attachSurfaceGraphic(root, chest, pocket, attachment, .00062);
    }
  } else {
    const pocketShape = new T.Shape();
    pocketShape.moveTo(-.105, .045);
    pocketShape.quadraticCurveTo(-.125, .015, -.11, -.065);
    pocketShape.lineTo(.11, -.065);
    pocketShape.quadraticCurveTo(.125, .015, .105, .045);
    pocketShape.lineTo(.06, .06);
    pocketShape.lineTo(-.06, .06);
    pocketShape.closePath();
    const pocket = new T.Mesh(new T.ShapeGeometry(pocketShape), fabric.clone());
    pocket.name = 'avatar-v1-hoodie-kangaroo-pocket';
    pocket.renderOrder = 2;
    attachSurfaceGraphic(root, chest, pocket, attachment, .00065);

    for (const side of [-1, 1]) {
      const drawstring = new T.Mesh(new T.PlaneGeometry(.006, .12), fabric.clone());
      drawstring.name = `avatar-v1-hoodie-drawstring-${side < 0 ? 'left' : 'right'}`;
      drawstring.position.x = side * .026;
      drawstring.position.y = -.045;
      pocket.add(drawstring);
    }
  }
}

function applyV1HandProportionPolish(bones: Map<string, T.Bone>) {
  const joint = (digit: string, index: number, side: 'L' | 'R') =>
    findPlayerBone(bones, [`${digit}${index}.${side}`, `${digit}${index}_${side}`, `${digit}${index}${side}`]);

  // The legacy donor rigs have intentionally chunky stage hands, but the finger
  // chains read too long and spider-like in the fitting-room close-up. Shorten
  // each digit from its base instead of editing vertices, which keeps the
  // existing weights, IK and instrument finger animation fully compatible.
  const baseScale: Record<string, number> = {
    Thumb: .94,
    Index: .955,
    Middle: .95,
    Ring: .925,
    Pinky: .89,
  };
  for (const side of ['L', 'R'] as const) {
    for (const digit of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
      const proximal = joint(digit, 1, side);
      if (!proximal) continue;
      proximal.scale.multiplyScalar(baseScale[digit]);
      proximal.userData.avatarV1FingerScale = baseScale[digit];
    }
  }
}

// Hotfix guard: the procedural starter garment meshes are preview-grade and
// attach too rigidly to the V1 skeleton in the live fitting room (flat torso
// panels / T-pose sleeves). Keep their definitions available for isolated
// development, but ship stable donor-skinned garments until each replacement
// has proper skin weights and visual acceptance coverage.
const USE_PROCEDURAL_STARTER_GARMENTS = false;

const PROCEDURAL_STARTER_TOPS = new Set([
  'starter.top.casual',
  'starter.top.stripe',
  'starter.top.plain-black',
  'starter.top.plain-white',
  'starter.top.vintage-charcoal',
  'starter.top.v-neck',
  'starter.top.long-sleeve',
  'starter.top.tank',
  'starter.top.hoodie',
  'starter.top.zip-hoodie',
  'starter.top.denim-jacket',
  'starter.top.flannel-shirt',
]);

function starterTopVisualItem(appearance: PlayerAppearance): ClothingItem | null {
  const id = appearance.equipment.top.itemId;
  if (!PROCEDURAL_STARTER_TOPS.has(id)) return null;

  const common = {
    id,
    name: equipmentItem(appearance, 'top').label,
    description: 'Built-in Avatar V1 starter garment',
    category: 'top',
    wearable_slot: 'top',
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
    material_config: {
      fabric: id === 'starter.top.denim-jacket' ? 'denim' : 'cotton',
      primaryColor: appearance.equipment.top.color,
      secondaryColor: id === 'starter.top.denim-jacket' ? '#b8b2a5' : '#e9e4db',
      roughness: id === 'starter.top.denim-jacket' ? .86 : .9,
      thickness: id.includes('hoodie') || id.includes('jacket') ? .72 : .46,
    },
    pattern_config: { type: id === 'starter.top.stripe' ? 'stripe' : id === 'starter.top.flannel-shirt' ? 'plaid' : 'solid' },
    fit_config: { fit: id.includes('hoodie') ? 'relaxed' : id === 'starter.top.vintage-charcoal' ? 'slim' : 'regular', drape: .42, taper: .28 },
    wear_config: id === 'starter.top.vintage-charcoal' ? { condition: 'stage-worn', distress: .28 } : {},
    detail_layers: [],
    render_config: {},
    curated_asset_key: null,
    curated_asset_status: 'legacy' as const,
    supported_frames: ['masculine', 'feminine'],
    validation_notes: null,
    bonus_enabled: false,
    bonus_config: null,
    customization_zones: null,
    variant_matrix: null,
    external_key: null,
    schema_version: 1,
    import_source: 'avatar-v1-starter',
    import_batch_id: null,
    preview_status: null,
    preview_manifest: null,
    preview_generated_at: null,
    last_preview_error: null,
    shape_config: null,
  };

  const garment_config: Record<string, unknown> = {
    templateKey: 't-shirt',
    silhouette: 'classic',
    cut: 'regular',
    sleeve: 'short',
    collar: 'crew',
    closure: 'none',
    length: 'standard',
    waistScale: 1,
    sleeveLengthScale: .82,
    sleeveWidthScale: .95,
  };

  if (id === 'starter.top.v-neck') garment_config.collar = 'v-neck';
  if (id === 'starter.top.long-sleeve') {
    garment_config.templateKey = 'long-sleeve';
    garment_config.sleeve = 'long';
    garment_config.sleeveLengthScale = 1.04;
  }
  if (id === 'starter.top.tank') {
    garment_config.templateKey = 'vest';
    garment_config.sleeve = 'none';
    garment_config.cut = 'fitted';
    garment_config.waistScale = .94;
  }
  if (id === 'starter.top.hoodie' || id === 'starter.top.zip-hoodie') {
    garment_config.templateKey = 'hoodie';
    garment_config.sleeve = 'long';
    garment_config.collar = 'hood';
    garment_config.silhouette = 'relaxed';
    garment_config.sleeveLengthScale = 1.08;
    garment_config.sleeveWidthScale = 1.08;
    if (id === 'starter.top.zip-hoodie') garment_config.closure = 'zip';
  }
  if (id === 'starter.top.denim-jacket') {
    garment_config.templateKey = 'jacket';
    garment_config.sleeve = 'long';
    garment_config.collar = 'shirt';
    garment_config.closure = 'button';
    garment_config.cut = 'structured';
    garment_config.sleeveLengthScale = 1.04;
  }
  if (id === 'starter.top.flannel-shirt') {
    garment_config.templateKey = 'shirt';
    garment_config.sleeve = 'long';
    garment_config.collar = 'shirt';
    garment_config.closure = 'button';
    garment_config.sleeveLengthScale = 1.02;
  }

  return { ...common, garment_config } as ClothingItem;
}

const PROCEDURAL_STARTER_BOTTOMS = new Set([
  'starter.bottom.denim-shorts',
  'starter.bottom.cargo-shorts',
  'starter.bottom.athletic-shorts',
  'starter.bottom.boxer-briefs',
  'starter.bottom.briefs',
  'starter.bottom.chinos',
  'starter.bottom.wide-leg',
  'starter.bottom.pleated-skirt',
  'starter.bottom.mini-skirt',
]);

function starterBottomVisualItem(appearance: PlayerAppearance): ClothingItem | null {
  const id = appearance.equipment.bottom.itemId;
  if (!PROCEDURAL_STARTER_BOTTOMS.has(id)) return null;
  const underwear = id === 'starter.bottom.boxer-briefs' || id === 'starter.bottom.briefs';
  const denim = id === 'starter.bottom.denim-shorts';
  const cargo = id === 'starter.bottom.cargo-shorts';
  const athletic = id === 'starter.bottom.athletic-shorts';
  const skirt = id === 'starter.bottom.pleated-skirt' || id === 'starter.bottom.mini-skirt';
  const wideLeg = id === 'starter.bottom.wide-leg';
  const chinos = id === 'starter.bottom.chinos';
  return {
    id,
    name: equipmentItem(appearance, 'bottom').label,
    description: 'Built-in Avatar V1 starter garment',
    category: underwear ? 'underwear' : skirt ? 'skirt' : (id.includes('shorts') ? 'shorts' : 'trousers'),
    wearable_slot: 'bottom',
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
    material_config: {
      fabric: denim ? 'denim' : 'cotton',
      primaryColor: appearance.equipment.bottom.color,
      secondaryColor: underwear ? '#e9e4db' : denim ? '#d6c5a4' : '#b8b2a5',
      roughness: denim ? .86 : .9,
      thickness: underwear ? .28 : skirt ? .4 : wideLeg ? .5 : .48,
    },
    pattern_config: { type: 'solid' },
    fit_config: {
      fit: underwear || athletic ? 'slim' : cargo || wideLeg ? 'relaxed' : 'regular',
      drape: underwear ? .22 : skirt ? .55 : wideLeg ? .62 : .4,
      taper: underwear ? .44 : wideLeg ? .05 : chinos ? .34 : .25,
    },
    wear_config: {},
    garment_config: {
      templateKey: underwear ? 'underwear' : skirt ? 'skirt' : wideLeg ? 'wide-leg' : (id.includes('shorts') ? 'shorts' : 'trousers'),
      silhouette: underwear ? 'fitted' : skirt ? (id === 'starter.bottom.pleated-skirt' ? 'a-line' : 'fitted') : cargo || wideLeg ? 'relaxed' : 'classic',
      cut: underwear ? 'fitted' : cargo || wideLeg ? 'relaxed' : chinos ? 'tapered' : 'regular',
      length: underwear ? 'mini' : id === 'starter.bottom.mini-skirt' ? 'mini' : skirt ? 'short' : id.includes('shorts') ? 'short' : 'standard',
      waistScale: underwear ? .94 : skirt ? .98 : 1,
      construction: denim ? 'denim-shorts' : cargo ? 'cargo-shorts' : athletic ? 'athletic-shorts' : id === 'starter.bottom.pleated-skirt' ? 'pleated-skirt' : id === 'starter.bottom.mini-skirt' ? 'mini-skirt' : chinos ? 'chinos' : wideLeg ? 'wide-leg' : underwear ? 'underwear' : 'plain',
    },
    detail_layers: [],
    render_config: {},
    curated_asset_key: null,
    curated_asset_status: 'legacy',
    supported_frames: ['masculine', 'feminine'],
    validation_notes: null,
    bonus_enabled: false,
    bonus_config: null,
    customization_zones: null,
    variant_matrix: null,
    external_key: null,
    schema_version: 1,
    import_source: 'avatar-v1-starter',
    import_batch_id: null,
    preview_status: null,
    preview_manifest: null,
    preview_generated_at: null,
    last_preview_error: null,
    shape_config: null,
  } as ClothingItem;
}

function starterBottomExposesLegs(item: ClothingItem) {
  const garment = (item.garment_config || {}) as Record<string, unknown>;
  const templateKey = String(garment.templateKey || garment.template_key || '').toLowerCase();
  return templateKey === 'shorts' || templateKey === 'underwear' || templateKey === 'skirt';
}

function addStarterProceduralGarment(
  root: T.Object3D,
  bones: Map<string, T.Bone>,
  item: ClothingItem,
  prefix: 'Body' | 'Legs',
) {
  const garment = buildProceduralGarment(item);
  root.add(garment);
  root.updateMatrixWorld(true);

  const pieces: T.Mesh[] = [];
  garment.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    node.name = `Starter_${prefix}_${node.name || 'garment-piece'}`;
    pieces.push(node);
  });

  for (const piece of pieces) {
    const anchorName = String(piece.userData.rigAnchor || (prefix === 'Body' ? 'Torso' : 'Hips')) as GarmentRigAnchor;
    const anchor = bones.get(anchorName)
      ?? (anchorName === 'Torso' ? findPlayerBone(bones, ['Spine2','Spine.002','Chest','UpperChest','Spine1','Spine.001']) : undefined)
      ?? (anchorName === 'Hips' ? findPlayerBone(bones, ['Hips','Pelvis']) : undefined);
    if (anchor) anchor.attach(piece);
    else root.attach(piece);
  }
  garment.removeFromParent();
}

function addV1BareLegUnderlay(
  root: T.Object3D,
  appearance: PlayerAppearance,
  bones: Map<string, T.Bone>,
  quality: AvatarVisualQuality,
) {
  root.updateMatrixWorld(true);
  const muscle = appearance.body.muscle ?? 'natural';
  const muscleScale = { natural: 1, toned: 1.035, athletic: 1.075, muscular: 1.13, bodybuilder: 1.2 }[muscle];
  const frameScale = appearance.body.frame === 'feminine' ? .92 : 1;
  const material = upgradeSkinMaterial(
    Object.assign(new T.MeshStandardMaterial({
      color: appearance.body.skin,
      roughness: skinRoughness(appearance),
      metalness: 0,
    }), { name: 'Skin_Underlay' }),
    appearance,
    quality,
  );
  material.name = 'Skin_Underlay';

  const bone = (...names: string[]) => findPlayerBone(bones, names);
  const addSegment = (name: string, driver: T.Bone | undefined, from: T.Bone | undefined, to: T.Bone | undefined, radiusX: number, radiusZ: number) => {
    if (!driver || !from || !to) return;
    const start = from.getWorldPosition(new T.Vector3());
    const end = to.getWorldPosition(new T.Vector3());
    const direction = end.clone().sub(start);
    const length = direction.length();
    if (!Number.isFinite(length) || length < .015) return;
    const geometry = new T.SphereGeometry(1, quality === 'cinematic' ? 26 : 18, quality === 'cinematic' ? 18 : 12);
    geometry.applyMatrix4(new T.Matrix4().compose(
      start.clone().add(end).multiplyScalar(.5),
      new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize()),
      new T.Vector3(radiusX, length * .54, radiusZ),
    ));
    const count = geometry.attributes.position.count;
    const weights = new Float32Array(count * 4);
    for (let i = 0; i < count; i += 1) weights[i * 4] = 1;
    geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
    geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
    geometry.computeVertexNormals();
    const mesh = new T.SkinnedMesh(geometry, material);
    mesh.name = `avatar-v1-short-leg-underlay-${name}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    mesh.bind(new T.Skeleton([driver], [driver.matrixWorld.clone().invert()]), new T.Matrix4());
  };

  for (const side of ['L', 'R'] as const) {
    const upperLeg = bone(`UpperLeg.${side}`, `UpperLeg_${side}`, `UpperLeg${side}`);
    const lowerLeg = bone(`LowerLeg.${side}`, `LowerLeg_${side}`, `LowerLeg${side}`);
    const foot = bone(`Foot.${side}`, `Foot_${side}`, `Foot${side}`);
    addSegment(`upper-${side.toLowerCase()}`, upperLeg, upperLeg, lowerLeg, .083 * frameScale * muscleScale, .078 * muscleScale);
    addSegment(`lower-${side.toLowerCase()}`, lowerLeg, lowerLeg, foot, .059 * frameScale * muscleScale, .057 * muscleScale);
  }
}

function addLegacyBareBodyUnderlay(
  root: T.Object3D,
  appearance: PlayerAppearance,
  bones: Map<string, T.Bone>,
  quality: AvatarVisualQuality,
  fullBody: boolean,
  includeTorso = true,
) {
  root.updateMatrixWorld(true);
  const muscle = appearance.body.muscle ?? 'natural';
  const muscleScale = {
    natural: 1,
    toned: 1.035,
    athletic: 1.075,
    muscular: 1.13,
    bodybuilder: 1.2,
  }[muscle];
  const frameScale = appearance.body.frame === 'feminine' ? .92 : 1;
  const skin = upgradeSkinMaterial(
    Object.assign(new T.MeshStandardMaterial({
      color: appearance.body.skin,
      roughness: skinRoughness(appearance),
      metalness: 0,
    }), { name: 'Skin_Underlay' }),
    appearance,
    quality,
  );
  skin.name = 'Skin_Underlay';

  const bone = (...names: string[]) => findPlayerBone(bones, names);
  const addEllipsoid = (
    name: string,
    driver: T.Bone | undefined,
    from: T.Bone | undefined,
    to: T.Bone | undefined,
    radiusX: number,
    radiusZ: number,
    lengthScale = 1.08,
  ) => {
    if (!driver || !from || !to) return;
    const start = from.getWorldPosition(new T.Vector3());
    const end = to.getWorldPosition(new T.Vector3());
    const direction = end.clone().sub(start);
    const length = direction.length();
    if (!Number.isFinite(length) || length < .015) return;
    const rotation = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize());
    const midpoint = start.clone().add(end).multiplyScalar(.5);
    const geometry = new T.SphereGeometry(1, quality === 'cinematic' ? 28 : 20, quality === 'cinematic' ? 20 : 14);
    geometry.applyMatrix4(new T.Matrix4().compose(
      midpoint,
      rotation,
      new T.Vector3(radiusX, Math.max(.025, length * .5 * lengthScale), radiusZ),
    ));
    const count = geometry.attributes.position.count;
    const indices = new Uint16Array(count * 4);
    const weights = new Float32Array(count * 4);
    for (let i = 0; i < count; i += 1) weights[i * 4] = 1;
    geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
    geometry.computeVertexNormals();

    const mesh = new T.SkinnedMesh(geometry, skin);
    mesh.name = `avatar-v1-skin-underlay-${name}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    mesh.bind(new T.Skeleton([driver], [driver.matrixWorld.clone().invert()]), new T.Matrix4());
  };

  const hips = bone('Hips', 'Pelvis');
  const spine1 = bone('Spine1', 'Spine.001', 'Spine');
  const spine2 = bone('Spine2', 'Spine.002', 'Chest', 'UpperChest');
  const neck = bone('Neck');
  const torsoTop = neck ?? spine2;
  const torsoDriver = spine1 ?? spine2 ?? hips;
  if (includeTorso && hips && torsoTop && torsoDriver) {
    const breastScale = appearance.body.frame === 'feminine' ? T.MathUtils.lerp(.9, 1.16, T.MathUtils.inverseLerp(.75, 1.35, appearance.body.breastSize ?? 1)) : 1;
    addEllipsoid('torso', torsoDriver, hips, torsoTop, .185 * frameScale * muscleScale, .112 * (1 + (muscleScale - 1) * .55) * breastScale, 1.02);
  }

  for (const side of ['L', 'R'] as const) {
    const upperArm = bone(`UpperArm.${side}`, `UpperArm_${side}`, `UpperArm${side}`);
    const lowerArm = bone(`LowerArm.${side}`, `LowerArm_${side}`, `LowerArm${side}`);
    const hand = bone(`Hand.${side}`, `Hand_${side}`, `Hand${side}`, `Wrist.${side}`, `Wrist_${side}`, `Wrist${side}`);
    addEllipsoid(`upper-arm-${side.toLowerCase()}`, upperArm, upperArm, lowerArm, .062 * frameScale * muscleScale, .061 * muscleScale);
    // Topless stage avatars hide the donor shirt material, including the sleeve/forearm
    // geometry on some V1 exports. Always rebuild the complete arm so hands never
    // appear detached. Tattoo mode still extends the same underlay to the legs/feet.
    addEllipsoid(
      `lower-arm-${side.toLowerCase()}`,
      lowerArm,
      lowerArm,
      hand,
      .047 * frameScale * (1 + (muscleScale - 1) * .7),
      .046 * (1 + (muscleScale - 1) * .7),
      1.1,
    );

    // A small elbow bridge softens the seam between the two skinned ellipsoids in
    // close-up creator/profile views while remaining driven by the lower-arm bone.
    if (lowerArm) {
      const elbow = lowerArm.getWorldPosition(new T.Vector3());
      const geometry = new T.SphereGeometry(
        .052 * frameScale * (1 + (muscleScale - 1) * .78),
        quality === 'cinematic' ? 24 : 16,
        quality === 'cinematic' ? 16 : 12,
      );
      geometry.translate(elbow.x, elbow.y, elbow.z);
      const count = geometry.attributes.position.count;
      const indices = new Uint16Array(count * 4);
      const weights = new Float32Array(count * 4);
      for (let i = 0; i < count; i += 1) weights[i * 4] = 1;
      geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(indices, 4));
      geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
      geometry.computeVertexNormals();
      const elbowMesh = new T.SkinnedMesh(geometry, skin);
      elbowMesh.name = `avatar-v1-skin-underlay-elbow-${side.toLowerCase()}`;
      elbowMesh.castShadow = true;
      elbowMesh.receiveShadow = true;
      root.add(elbowMesh);
      elbowMesh.bind(new T.Skeleton([lowerArm], [lowerArm.matrixWorld.clone().invert()]), new T.Matrix4());
    }

    if (!fullBody) continue;
    const upperLeg = bone(`UpperLeg.${side}`, `UpperLeg_${side}`, `UpperLeg${side}`);
    const lowerLeg = bone(`LowerLeg.${side}`, `LowerLeg_${side}`, `LowerLeg${side}`);
    const foot = bone(`Foot.${side}`, `Foot_${side}`, `Foot${side}`);
    const toe = bone(`ToeBase.${side}`, `ToeBase_${side}`, `ToeBase${side}`);
    addEllipsoid(`upper-leg-${side.toLowerCase()}`, upperLeg, upperLeg, lowerLeg, .083 * frameScale * muscleScale, .078 * (1 + (muscleScale - 1) * .8));
    addEllipsoid(`lower-leg-${side.toLowerCase()}`, lowerLeg, lowerLeg, foot, .059 * frameScale * (1 + (muscleScale - 1) * .75), .057 * (1 + (muscleScale - 1) * .75));
    addEllipsoid(`foot-${side.toLowerCase()}`, foot, foot, toe, .058 * frameScale, .075 * frameScale, .95);
  }
}

/** Each part keeps its donor inverse binds and local transform. This matters for
 * the small body offset in the original casual/suit assets. Rig families never mix. */
export function assemblePlayerModel(
  library: ModelLibrary,
  appearance: PlayerAppearance,
  tattoos: ResolvedTattooVisual[] = [],
  richClothing: ResolvedEquippedClothing[] = [],
  quality: AvatarVisualQuality = 'balanced',
  presentation: PlayerModelPresentation = 'stage',
  merchWearable: ResolvedMerchWearable | null = null,
): T.Object3D {
  const source = (style: Parameters<typeof modelFile>[1]) => {
    const model = library.get(modelFile(appearance.body.frame, style));
    if (!model) throw new Error('The selected character model could not load.');
    return model;
  };
  const result = clone(source(headModelStyle(appearance)));
  const bones = new Map<string, T.Bone>(), remove: T.Object3D[] = [];
  result.traverse(node => { if (node instanceof T.Bone) bones.set(node.name, node); if (node instanceof T.SkinnedMesh) remove.push(node); });
  remove.forEach(node => { const parent = node.parent; node.removeFromParent(); if (parent && parent.children.length === 0 && /_(body|head|legs|feet)$/i.test(parent.name)) parent.removeFromParent(); });
  // The women's export has independent foot controls. Our shared two-bone leg
  // solver requires a connected FK chain; attach preserves the rest world pose
  // and hence the original inverse binds, including the meshes' foot weights.
  if (appearance.body.frame === 'feminine') {
    result.updateMatrixWorld(true);
    for (const side of ['L', 'R']) {
      const bone = (name: string) => [...bones.values()].find(value => value.name.replace(/[_.]/g, '') === `${name}${side}`);
      const lower = bone('LowerLeg'), foot = bone('Foot');
      if (lower && foot && foot.parent !== lower) lower.attach(foot);
    }
  }
  const skinTextureCache = createAvatarSkinTextureCache(appearance, quality);
  const hairTextureCache = createAvatarHairTextureCache(quality);
  const starterFabricCache = new Map<string, { map: T.DataTexture; normal: T.DataTexture }>();
  const curatedSurfaceCache = new Map<string, {
    map: T.DataTexture;
    normal: T.DataTexture;
    bump: T.DataTexture;
    roughness: T.DataTexture;
  }>();
  const starterFabricMaps = (fabric: Parameters<typeof fabricTexture>[0]) => {
    const key = `${fabric}:${quality}`;
    const cached = starterFabricCache.get(key);
    if (cached) return cached;
    const created = {
      map: fabricTexture(fabric, quality),
      normal: fabricNormalTexture(fabric, quality),
    };
    starterFabricCache.set(key, created);
    return created;
  };
  const curatedSurfaceMaps = (
    assetKey: string,
    finish: CuratedFinish,
    dye: string,
    secondaryColor?: string,
  ) => {
    const key = [assetKey, finish, dye, secondaryColor ?? '', quality].join(':');
    const cached = curatedSurfaceCache.get(key);
    if (cached) return cached;
    const map = finish === 'tartan'
      ? curatedTextureForQuality(curatedTartanTexture(assetKey, dye, secondaryColor || '#171717'), quality, 'color')
      : curatedTextureForQuality(curatedAlbedoTexture(assetKey, finish), quality, 'color');
    const created = {
      map,
      normal: curatedTextureForQuality(curatedNormalTexture(assetKey, finish), quality, 'normal'),
      bump: curatedTextureForQuality(curatedReliefTexture(assetKey, finish), quality, 'height'),
      roughness: curatedTextureForQuality(curatedRoughnessTexture(assetKey, finish), quality, 'roughness'),
    };
    curatedSurfaceCache.set(key, created);
    return created;
  };

  const curatedTop = presentation === 'tattoo' ? undefined : curatedDonorForSlot(richClothing, 'top');
  const merchTopItemId = presentation === 'stage' && merchWearable ? (merchWearable.product_type.toLowerCase().includes('hoodie') ? 'starter.top.hoodie' : merchWearable.product_type.toLowerCase().includes('long sleeve') || merchWearable.product_type.toLowerCase().includes('crewneck') ? 'starter.top.long-sleeve' : 'starter.top.casual') : null;
  const merchTopStyle = merchTopItemId ? equipmentStyle({ ...appearance, equipment: { ...appearance.equipment, top: { ...appearance.equipment.top, itemId: merchTopItemId } } }, 'top') : null;
  const curatedBottom = presentation === 'tattoo' ? undefined : curatedDonorForSlot(richClothing, 'bottom');
  const curatedFootwear = presentation === 'tattoo' ? undefined : curatedDonorForSlot(richClothing, 'footwear');
  const topless = presentation === 'stage' && appearance.equipment.top.itemId === 'starter.top.topless' && !curatedTop;
  const proceduralStarterTop = USE_PROCEDURAL_STARTER_GARMENTS && presentation === 'stage' && !curatedTop
    ? starterTopVisualItem(appearance)
    : null;
  const proceduralStarterBottom = USE_PROCEDURAL_STARTER_GARMENTS && presentation === 'stage' && !curatedBottom
    ? starterBottomVisualItem(appearance)
    : null;
  const choices = [
    { part: 'head', style: headModelStyle(appearance), dye: appearance.head.hair, fabric: 'plain' as const },
    {
      part: 'body',
      style: merchTopStyle ?? curatedTop?.source.style ?? equipmentStyle(appearance, 'top'),
      dye: merchWearable?.garment_color ?? curatedTop?.source.color ?? appearance.equipment.top.color,
      secondaryColor: curatedTop?.source.secondaryColor,
      fabric: curatedTop?.source.fabric ?? visualEquipmentItem(appearance, 'top').fabric,
      finish: curatedTop?.source.finish,
      assetKey: curatedTop?.source.assetKey,
    },
    {
      part: 'legs',
      style: curatedBottom?.source.style ?? equipmentStyle(appearance, 'bottom'),
      dye: curatedBottom?.source.color ?? appearance.equipment.bottom.color,
      secondaryColor: curatedBottom?.source.secondaryColor,
      fabric: curatedBottom?.source.fabric ?? visualEquipmentItem(appearance, 'bottom').fabric,
      finish: curatedBottom?.source.finish,
      assetKey: curatedBottom?.source.assetKey,
    },
    {
      part: 'feet',
      style: curatedFootwear?.source.style ?? equipmentStyle(appearance, 'footwear'),
      dye: curatedFootwear?.source.color ?? appearance.equipment.footwear.color,
      secondaryColor: curatedFootwear?.source.secondaryColor,
      fabric: curatedFootwear?.source.fabric ?? visualEquipmentItem(appearance, 'footwear').fabric,
      finish: curatedFootwear?.source.finish,
      assetKey: curatedFootwear?.source.assetKey,
    },
  ];
  for (const choice of choices) {
    const matches = (node: T.Object3D) => !(node instanceof T.Bone) && new RegExp(`_${choice.part}(?:_|$)`, 'i').test(node.name);
    const containers: T.Object3D[] = [];
    source(choice.style).traverse(node => { if (matches(node) && (!node.parent || !matches(node.parent))) containers.push(node); });
    if (!containers.length) throw new Error(`Missing character part: ${choice.part}`);
    for (const container of containers) {
      const part = container.clone(true), removeHair: T.Object3D[] = [];
      const corneaOverlays: Array<{ parent: T.Object3D; overlay: T.SkinnedMesh }> = [];
      part.traverse(clonedNode => {
        if (!(clonedNode instanceof T.SkinnedMesh)) return;
        const original = (container === clonedNode ? container : container.getObjectByName(clonedNode.name)) as T.SkinnedMesh;
        if (!original?.isSkinnedMesh) throw new Error('Incompatible character geometry');
        clonedNode.geometry = original.geometry.clone();
        if (choice.part === 'body' && appearance.body.frame === 'feminine') {
          applyFeminineBreastSize(clonedNode, appearance.body.breastSize ?? 1);
        }
        if (
          choice.part === 'body' &&
          !choice.assetKey &&
          V1_SKINNED_TEE_ITEMS.has(appearance.equipment.top.itemId)
        ) {
          polishV1CrewTeeGeometry(
            clonedNode,
            Array.isArray(original.material) ? original.material : [original.material],
            appearance.equipment.top.itemId,
          );
          trimV1TeeToShortSleeves(
            clonedNode,
            Array.isArray(original.material) ? original.material : [original.material],
          );
        }
        if (
          choice.part === 'body' &&
          !choice.assetKey &&
          V1_SKINNED_OUTERWEAR_ITEMS.has(appearance.equipment.top.itemId)
        ) {
          polishV1OuterwearGeometry(
            clonedNode,
            Array.isArray(original.material) ? original.material : [original.material],
            appearance.equipment.top.itemId,
          );
        }
        if (
          choice.part === 'body' &&
          !choice.assetKey &&
          appearance.equipment.top.itemId === 'starter.top.tank'
        ) {
          removeV1TankSleeveTriangles(
            clonedNode,
            Array.isArray(original.material) ? original.material : [original.material],
          );
        }
        if (
          choice.part === 'legs' &&
          !choice.assetKey &&
          V1_CROPPED_BOTTOM_ITEMS.has(appearance.equipment.bottom.itemId)
        ) {
          cropV1BottomGarmentGeometry(
            clonedNode,
            Array.isArray(original.material) ? original.material : [original.material],
            appearance.equipment.bottom.itemId,
          );
        }
        if (
          choice.part === 'legs' &&
          !choice.assetKey &&
          V1_SHAPED_TROUSER_ITEMS.has(appearance.equipment.bottom.itemId)
        ) {
          shapeV1TrouserGeometry(
            clonedNode,
            Array.isArray(original.material) ? original.material : [original.material],
            appearance.equipment.bottom.itemId,
          );
        }
        if (choice.fabric !== 'plain' || choice.finish) fabricUVs(clonedNode.geometry, choice.part === 'feet');
        if (choice.assetKey) applyCuratedMacroShading(clonedNode.geometry, choice.assetKey, choice.finish as CuratedFinish | undefined);
        if (choice.part === 'head' || (choice.part === 'body' && !choice.assetKey)) {
          applyAvatarSkinMacroShading(clonedNode.geometry, choice.part, appearance, quality);
        }
        const dyeMaterial = (originalMaterial: T.Material) => {
          const material = originalMaterial.clone() as T.MeshStandardMaterial;
          if (!material.isMeshStandardMaterial) return material;
          const name = material.name.toLowerCase();
          const skinMaterial = /skin/.test(name);
          const hideForTattooView = presentation === 'tattoo' && choice.part !== 'head' && !skinMaterial;
          const hideForTopless = topless && choice.part === 'body' && !skinMaterial;
          const hideForProceduralStarterTop = !!proceduralStarterTop && choice.part === 'body' && !skinMaterial;
          const hideForProceduralStarterBottom = !!proceduralStarterBottom && choice.part === 'legs' && !skinMaterial;
          if (hideForTattooView || hideForTopless || hideForProceduralStarterTop || hideForProceduralStarterBottom) {
            material.visible = false;
            material.transparent = true;
            material.opacity = 0;
            material.depthWrite = false;
            return material;
          }
          material.roughness = skinMaterial ? skinRoughness(appearance) : .84;
          material.metalness = /earring|metal/.test(name) ? .65 : 0;
          if (!/skin|earring|metal/.test(name) && choice.finish) {
            if (choice.finish === 'cotton') material.roughness = .9;
            if (choice.finish === 'vintage-cotton') material.roughness = .97;
            if (choice.finish === 'denim') material.roughness = .96;
            if (choice.finish === 'tartan') material.roughness = .91;
            if (choice.finish === 'canvas') material.roughness = .94;
            if (choice.finish === 'leather') { material.roughness = .38; material.metalness = .03; }
            if (choice.finish === 'polished-leather') { material.roughness = .24; material.metalness = .04; }
          }
          if (/skin/.test(name)) {
            material.color.set(appearance.body.skin);
            if (clonedNode.geometry.getAttribute('color') && (choice.part === 'head' || !choice.assetKey)) material.vertexColors = true;
            applyAvatarSkinQuality(material, appearance, quality, skinTextureCache);
          } else if (choice.part === 'head') {
            // The source rigs use slightly different material names. Keep iris,
            // brows and hair independently tintable while preserving eye whites.
            const isFeminineIris = appearance.body.frame === 'feminine' && name === 'brown';
            if (/iris|pupil/.test(name) || isFeminineIris) {
              material.color.set(appearance.head.eyeColor ?? '#65442d');
              applyAvatarEyeQuality(material, quality);
            } else if (/white|eye/.test(name) && !/eyebrow/.test(name)) {
              applyAvatarEyeQuality(material, quality);
            } else if (/eyebrow|brow|hair_brown/.test(name)) {
              material.color.set(appearance.head.eyebrowColor ?? appearance.head.hair);
              applyAvatarHairQuality(material, quality, hairTextureCache);
            } else if (/hair|pink|red/.test(name)) {
              material.color.set(appearance.head.hair);
              applyAvatarHairQuality(material, quality, hairTextureCache);
            }
          } else if (!/earring|metal/.test(name) && !(name === 'white' && (choice.style !== 'casual' || choice.part === 'feet'))) {
            material.color.set(choice.dye);
            if (choice.fabric !== 'plain' && !choice.assetKey) {
              const fabricMaps = starterFabricMaps(choice.fabric);
              material.map = fabricMaps.map;
              material.normalMap = fabricMaps.normal;
              const starterNormal = choice.fabric === 'canvas' ? .42 : choice.fabric === 'denim' ? .36 : .2;
              material.normalScale.set(starterNormal, starterNormal);
              material.roughness = choice.fabric === 'patent' ? .2 : choice.fabric === 'canvas' || choice.fabric === 'denim' ? .95 : .84;
            }
            if (choice.assetKey) material.vertexColors = true;
            if (choice.assetKey && choice.finish) {
              const finish = choice.finish as CuratedFinish;
              const maps = curatedSurfaceMaps(choice.assetKey, finish, choice.dye, choice.secondaryColor);
              material.map = maps.map;
              if (finish === 'tartan') material.color.set('#ffffff');
              const profile = curatedMaterialProfile(choice.assetKey, finish);
              material.normalMap = maps.normal;
              material.normalScale.set(profile.normalStrength, profile.normalStrength);
              material.bumpMap = maps.bump;
              material.bumpScale = curatedBumpScale(finish) * profile.bumpMultiplier;
              material.roughnessMap = maps.roughness;
              material.roughness = profile.roughness;
              material.metalness = profile.metalness;
              material.envMapIntensity = profile.envMapIntensity;
              material.needsUpdate = true;
            }
          }
          if (/skin/.test(name)) {
            return upgradeSkinMaterial(material, appearance, quality);
          }
          if (!choice.assetKey && choice.fabric !== 'plain' && !/earring|metal/.test(name)) {
            const upgraded = upgradeStarterFabricMaterial(material, choice.fabric, quality);
            if (upgraded !== material) return upgraded;
          }
          if (
            choice.assetKey &&
            choice.finish &&
            (choice.finish === 'leather' || choice.finish === 'polished-leather') &&
            !/earring|metal/.test(name)
          ) {
            return upgradeCuratedGarmentMaterial(
              material,
              choice.finish as CuratedFinish,
              curatedMaterialProfile(choice.assetKey, choice.finish as CuratedFinish),
              quality,
            );
          }
          return material;
        };
        if (choice.part === 'head' && appearance.head.hairStyle && appearance.head.hairStyle !== 'original' && !Array.isArray(original.material) && isScalpHair(original.material, appearance.body.frame)) removeHair.push(clonedNode);
        clonedNode.material = Array.isArray(original.material) ? original.material.map(dyeMaterial) : dyeMaterial(original.material);
        const boundBones = original.skeleton.bones.map(bone => {
          const match = bones.get(bone.name); if (!match) throw new Error(`Incompatible character part: ${bone.name}`); return match;
        });
        clonedNode.bind(new T.Skeleton(boundBones, original.skeleton.boneInverses.map(matrix => matrix.clone())), original.bindMatrix.clone());
        if (
          choice.part === 'body' &&
          !choice.assetKey &&
          (
            appearance.equipment.top.itemId === 'starter.top.long-sleeve' ||
            appearance.equipment.top.itemId === 'starter.top.hoodie' ||
            appearance.equipment.top.itemId === 'starter.top.zip-hoodie'
          )
        ) {
          addV1FittedLongSleeves(
            clonedNode,
            Array.isArray(clonedNode.material) ? clonedNode.material : [clonedNode.material],
            appearance.equipment.top.itemId,
          );
        }
        if (choice.part === 'head' && clonedNode.parent) {
          const overlay = createCorneaOverlay(clonedNode, appearance.body.frame, quality);
          if (overlay) corneaOverlays.push({ parent: clonedNode.parent, overlay });
        }
      });
      corneaOverlays.forEach(({ parent, overlay }) => parent.add(overlay));
      removeHair.forEach(disposeModel);
      const parent = container.parent?.name ? result.getObjectByName(container.parent.name) : result;
      (parent ?? result).add(part);
    }
  }
  if (proceduralStarterTop) {
    addStarterProceduralGarment(result, bones, proceduralStarterTop, 'Body');
  }
  if (proceduralStarterBottom) {
    addStarterProceduralGarment(result, bones, proceduralStarterBottom, 'Legs');
    if (starterBottomExposesLegs(proceduralStarterBottom)) addV1BareLegUnderlay(result, appearance, bones, quality);
  }

  if (topless || presentation === 'tattoo') {
    // The live avatar donor meshes are clothing-first, so this neutral skinned
    // underlay prevents holes for topless and tattoo presentation modes.
    addLegacyBareBodyUnderlay(result, appearance, bones, quality, presentation === 'tattoo');
  }

  // Punk trousers were authored to meet tall boots. A skinned calf beneath
  // them closes the exposed ankle when a player equips low shoes instead.
  if (appearance.body.frame === 'feminine' && equipmentStyle(appearance, 'bottom') === 'punk' && equipmentStyle(appearance, 'footwear') !== 'punk') {
    result.updateMatrixWorld(true);
    for (const side of ['L', 'R']) {
      const bone = (name: string) => [...bones.values()].find(value => value.name.replace(/[_.]/g, '') === `${name}${side}`);
      const lower = bone('LowerLeg'), foot = bone('Foot'); if (!lower || !foot) continue;
      const start = lower.getWorldPosition(new T.Vector3()), end = foot.getWorldPosition(new T.Vector3());
      const geometry = new T.CylinderGeometry(.058, .039, start.distanceTo(end), 12, 3);
      geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), start.clone().sub(end).normalize()));
      geometry.translate(...start.clone().add(end).multiplyScalar(.5).toArray());
      const count = geometry.attributes.position.count, weights = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) weights[i * 4] = 1;
      geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(new Uint16Array(count * 4), 4)); geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
      const material = new T.MeshStandardMaterial({ color: appearance.body.skin, roughness: .69 }); material.name = 'Skin';
      const calf = new T.SkinnedMesh(geometry, material); calf.name = `Punk_Legs_SkinBacking_${side}`;
      result.add(calf); calf.bind(new T.Skeleton([lower], [lower.matrixWorld.clone().invert()]), new T.Matrix4());
    }
  }
  const headBone = bones.get('Head');
  if (headBone) {
    addFaceDetails(result, appearance, headBone, quality);
    addHair(result, appearance, headBone, quality, hairTextureCache);
    addAccessories(result, appearance, headBone, richClothing, quality);
  }
  if (presentation === 'stage') {
    if (!merchWearable) addStarterLogoTee(result, appearance, bones, richClothing);
    addBandMerchGraphic(result, appearance, bones, merchWearable);
    addV1VNeckTrim(result, appearance, bones);
    addV1HoodieDetails(result, appearance, bones);
    addV1OuterwearFrontDetail(result, appearance, bones);
    addCuratedSkinDetails(result, bones, richClothing, quality);
  }
  addTattoos(result, tattoos, bones);
  // V1 donor hands have long, exaggerated fingers and an open/splayed bind pose.
  // Keep the original skin weights and animation chains but improve their
  // proportions and resting silhouette for creator/profile close-ups.
  applyV1HandProportionPolish(bones);
  result.userData.rockmundoAvatarPresentation = presentation;
  result.updateMatrixWorld(true);
  return result;
}

export function disposeModel(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>(), skeletons = new Set<T.Skeleton>();
  root.traverse(node => {
    if (!(node instanceof T.Mesh) && !(node instanceof T.Line)) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(material); Object.values(material).forEach(value => { if (value instanceof T.Texture) textures.add(value); });
    }
    if (node instanceof T.SkinnedMesh) skeletons.add(node.skeleton);
  });
  geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose()); skeletons.forEach(value => value.dispose());
  root.removeFromParent(); root.clear();
}
