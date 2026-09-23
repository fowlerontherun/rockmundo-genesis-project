import * as T from 'three';
import type { PlayerAppearance } from './appearance';
import type { AvatarVisualQuality } from './avatarVisualQuality';
import type { CuratedFinish } from './curatedSurfaceMaps';
import type { CuratedMaterialProfile } from './curatedMaterialProfile';

function qualityWeight(quality: AvatarVisualQuality) {
  if (quality === 'cinematic') return 1;
  if (quality === 'ultra') return .86;
  if (quality === 'high') return .68;
  if (quality === 'balanced') return .42;
  return 0;
}

function copyStandardSurface(source: T.MeshStandardMaterial, target: T.MeshPhysicalMaterial) {
  target.name = source.name;
  target.color.copy(source.color);
  target.map = source.map;
  target.lightMap = source.lightMap;
  target.lightMapIntensity = source.lightMapIntensity;
  target.aoMap = source.aoMap;
  target.aoMapIntensity = source.aoMapIntensity;
  target.emissive.copy(source.emissive);
  target.emissiveIntensity = source.emissiveIntensity;
  target.emissiveMap = source.emissiveMap;
  target.bumpMap = source.bumpMap;
  target.bumpScale = source.bumpScale;
  target.normalMap = source.normalMap;
  target.normalMapType = source.normalMapType;
  target.normalScale.copy(source.normalScale);
  target.displacementMap = source.displacementMap;
  target.displacementScale = source.displacementScale;
  target.displacementBias = source.displacementBias;
  target.roughness = source.roughness;
  target.roughnessMap = source.roughnessMap;
  target.metalness = source.metalness;
  target.metalnessMap = source.metalnessMap;
  target.alphaMap = source.alphaMap;
  target.envMap = source.envMap;
  target.envMapIntensity = source.envMapIntensity;
  target.wireframe = source.wireframe;
  target.wireframeLinewidth = source.wireframeLinewidth;
  target.vertexColors = source.vertexColors;
  target.fog = source.fog;
  target.flatShading = source.flatShading;

  target.opacity = source.opacity;
  target.transparent = source.transparent;
  target.alphaTest = source.alphaTest;
  target.alphaHash = source.alphaHash;
  target.side = source.side;
  target.shadowSide = source.shadowSide;
  target.depthTest = source.depthTest;
  target.depthWrite = source.depthWrite;
  target.colorWrite = source.colorWrite;
  target.blending = source.blending;
  target.blendSrc = source.blendSrc;
  target.blendDst = source.blendDst;
  target.blendEquation = source.blendEquation;
  target.polygonOffset = source.polygonOffset;
  target.polygonOffsetFactor = source.polygonOffsetFactor;
  target.polygonOffsetUnits = source.polygonOffsetUnits;
  target.dithering = source.dithering;
  target.toneMapped = source.toneMapped;
  target.visible = source.visible;
  target.userData = { ...source.userData };
  return target;
}

export function upgradeSkinMaterial(
  source: T.MeshStandardMaterial,
  appearance: PlayerAppearance,
  quality: AvatarVisualQuality,
): T.MeshStandardMaterial {
  const weight = qualityWeight(quality);
  if (weight < .6) return source;

  const material = copyStandardSurface(source, new T.MeshPhysicalMaterial());
  material.sheen = .12 + weight * .12;
  material.sheenRoughness = .74;
  material.sheenColor.copy(new T.Color(appearance.body.skin).lerp(new T.Color('#fff0e7'), .18));
  material.ior = 1.4;
  material.reflectivity = .28;
  material.clearcoat = .015 + weight * .018;
  material.clearcoatRoughness = .5;
  material.envMapIntensity = Math.max(material.envMapIntensity, .82 + weight * .16);
  material.needsUpdate = true;
  source.dispose();
  return material;
}

export function upgradeCuratedGarmentMaterial(
  source: T.MeshStandardMaterial,
  finish: CuratedFinish,
  profile: CuratedMaterialProfile,
  quality: AvatarVisualQuality,
): T.MeshStandardMaterial {
  const weight = qualityWeight(quality);
  if (weight < .6 || (finish !== 'leather' && finish !== 'polished-leather')) return source;

  const material = copyStandardSurface(source, new T.MeshPhysicalMaterial());
  material.clearcoat = profile.clearcoat * weight;
  material.clearcoatRoughness = profile.clearcoatRoughness;
  material.sheen = profile.sheen * weight;
  material.sheenRoughness = profile.sheenRoughness;
  material.sheenColor.copy(material.color.clone().lerp(new T.Color('#ffffff'), .1));
  material.ior = 1.48;
  material.reflectivity = finish === 'polished-leather' ? .58 : .42;
  material.needsUpdate = true;
  source.dispose();
  return material;
}

function eyeMaterialName(name: string, frame: PlayerAppearance['body']['frame']) {
  const normalized = name.toLowerCase();
  return /iris|pupil|eye|white/.test(normalized) || (frame === 'feminine' && normalized === 'brown');
}

/**
 * Adds a clear, rig-bound optical layer over the existing authored eye groups.
 * It reuses the same skinned geometry/groups, so there are no detached spheres
 * to drift away from the face during singing or performance animation.
 */
export function createCorneaOverlay(
  source: T.SkinnedMesh,
  frame: PlayerAppearance['body']['frame'],
  quality: AvatarVisualQuality,
) {
  const weight = qualityWeight(quality);
  if (weight < .6) return null;

  const sourceMaterials = Array.isArray(source.material) ? source.material : [source.material];
  if (!sourceMaterials.some(material => eyeMaterialName(material.name, frame))) return null;

  const hidden = () => new T.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  });
  const eye = () => new T.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: quality === 'cinematic' ? .015 : quality === 'ultra' ? .022 : .035,
    metalness: 0,
    transparent: true,
    opacity: quality === 'cinematic' ? .24 : quality === 'ultra' ? .2 : .15,
    depthWrite: false,
    depthTest: true,
    clearcoat: 1,
    clearcoatRoughness: quality === 'cinematic' ? .008 : .016,
    ior: 1.376,
    reflectivity: .62,
    envMapIntensity: quality === 'cinematic' ? 2 : quality === 'ultra' ? 1.8 : 1.55,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: T.FrontSide,
  });

  const overlayMaterials = sourceMaterials.map(material => eyeMaterialName(material.name, frame) ? eye() : hidden());
  const overlay = new T.SkinnedMesh(source.geometry.clone(), overlayMaterials.length === 1 ? overlayMaterials[0] : overlayMaterials);
  overlay.name = `${source.name || 'avatar-eye'}-cornea`;
  overlay.position.copy(source.position);
  overlay.quaternion.copy(source.quaternion);
  overlay.scale.copy(source.scale);
  overlay.matrix.copy(source.matrix);
  overlay.matrixAutoUpdate = source.matrixAutoUpdate;
  overlay.renderOrder = Math.max(source.renderOrder + 2, 4);
  overlay.frustumCulled = source.frustumCulled;
  overlay.castShadow = false;
  overlay.receiveShadow = false;
  overlay.bindMode = source.bindMode;
  overlay.bind(source.skeleton, source.bindMatrix.clone());
  overlay.bindMatrixInverse.copy(source.bindMatrixInverse);
  if (source.morphTargetInfluences) overlay.morphTargetInfluences = [...source.morphTargetInfluences];
  if (source.morphTargetDictionary) overlay.morphTargetDictionary = { ...source.morphTargetDictionary };
  return overlay;
}
