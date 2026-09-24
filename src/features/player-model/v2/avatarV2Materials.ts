import * as T from 'three';
import type { PlayerAppearance } from '../appearance';
import {
  applyAvatarEyeQuality,
  applyAvatarHairQuality,
  applyAvatarSkinQuality,
  createAvatarHairTextureCache,
  createAvatarSkinTextureCache,
} from '../avatarMaterialQuality';
import type { AvatarVisualQuality } from '../avatarVisualQuality';

export type AvatarV2MaterialRole =
  | 'skin'
  | 'hair'
  | 'iris'
  | 'sclera'
  | 'cornea'
  | 'teeth'
  | 'tongue'
  | 'mouthInterior'
  | 'other';

export function avatarV2MaterialRole(name: string): AvatarV2MaterialRole {
  const value = name.toLowerCase();
  if (/cornea|eye[_-]?(shell|surface)|ocular[_-]?shell/.test(value)) return 'cornea';
  if (/iris/.test(value)) return 'iris';
  if (/teeth|tooth/.test(value)) return 'teeth';
  if (/tongue/.test(value)) return 'tongue';
  if (/mouth[_-]?(interior|cavity)|oral[_-]?cavity|inner[_-]?mouth|gum/.test(value)) return 'mouthInterior';
  if (/sclera|rmv2[_-]?eyes|(^|[_-])(eye|eyes)($|[_-])/.test(value)) return 'sclera';
  if (/hair|brow/.test(value)) return 'hair';
  if (/skin|body|face/.test(value)) return 'skin';
  return 'other';
}

function promotePhysical(source: T.MeshStandardMaterial, transparent = source.transparent) {
  if (source instanceof T.MeshPhysicalMaterial) return source;
  const result = new T.MeshPhysicalMaterial({
    color: source.color.clone(),
    map: source.map,
    normalMap: source.normalMap,
    normalScale: source.normalScale.clone(),
    roughness: source.roughness,
    roughnessMap: source.roughnessMap,
    metalness: source.metalness,
    metalnessMap: source.metalnessMap,
    aoMap: source.aoMap,
    aoMapIntensity: source.aoMapIntensity,
    bumpMap: source.bumpMap,
    bumpScale: source.bumpScale,
    displacementMap: source.displacementMap,
    displacementScale: source.displacementScale,
    displacementBias: source.displacementBias,
    alphaMap: source.alphaMap,
    emissive: source.emissive.clone(),
    emissiveMap: source.emissiveMap,
    emissiveIntensity: source.emissiveIntensity,
    envMap: source.envMap,
    envMapIntensity: source.envMapIntensity,
    transparent,
    opacity: source.opacity,
    alphaTest: source.alphaTest,
    side: source.side,
    vertexColors: source.vertexColors,
    depthTest: source.depthTest,
    depthWrite: source.depthWrite,
    flatShading: source.flatShading,
    wireframe: source.wireframe,
  });
  result.name = source.name;
  result.userData = { ...source.userData };
  source.dispose();
  return result;
}

const usesCloseUpPhysicalShading = (quality: AvatarVisualQuality) =>
  quality === 'high' || quality === 'ultra' || quality === 'cinematic';

export function avatarV2TextureDetailQuality(quality: AvatarVisualQuality): AvatarVisualQuality {
  if (quality === 'high') return 'ultra';
  if (quality === 'ultra') return 'cinematic';
  return quality;
}

function tuneEyeSurface(
  material: T.MeshStandardMaterial,
  role: 'iris' | 'sclera' | 'cornea',
  appearance: PlayerAppearance,
  quality: AvatarVisualQuality,
) {
  applyAvatarEyeQuality(material, quality);
  if (role === 'iris') {
    material.color.set(appearance.head.eyeColor ?? '#65442d');
    material.roughness = quality === 'cinematic' ? .12 : quality === 'ultra' ? .14 : .18;
    material.envMapIntensity = quality === 'cinematic' ? 1.78 : quality === 'ultra' ? 1.6 : 1.35;
  } else if (role === 'sclera') {
    // Slightly warm white avoids the flat, emissive-white look under stage lights.
    material.color.set('#f2eee8');
    material.roughness = quality === 'cinematic' ? .24 : quality === 'ultra' ? .28 : .34;
    material.envMapIntensity = quality === 'cinematic' ? 1.45 : quality === 'ultra' ? 1.3 : 1.12;
  } else {
    material.color.set('#ffffff');
    material.roughness = quality === 'cinematic' ? .035 : quality === 'ultra' ? .05 : .08;
    material.envMapIntensity = quality === 'cinematic' ? 2.1 : quality === 'ultra' ? 1.9 : 1.55;
    if (material instanceof T.MeshPhysicalMaterial) {
      material.clearcoat = 1;
      material.clearcoatRoughness = quality === 'cinematic' ? .012 : quality === 'ultra' ? .018 : .028;
      material.ior = 1.376;
      material.transmission = quality === 'crowd' ? 0 : quality === 'balanced' ? .04 : .08;
      material.thickness = quality === 'cinematic' ? .012 : .008;
    }
  }
  material.metalness = 0;
  material.needsUpdate = true;
}

function tuneMouthMaterial(
  material: T.MeshStandardMaterial,
  role: 'teeth' | 'tongue' | 'mouthInterior',
  quality: AvatarVisualQuality,
) {
  material.metalness = 0;
  if (role === 'teeth') {
    material.color.set('#f3eadc');
    material.roughness = quality === 'cinematic' ? .26 : quality === 'ultra' ? .3 : .36;
    material.envMapIntensity = quality === 'cinematic' ? 1.22 : quality === 'ultra' ? 1.12 : .96;
  } else if (role === 'tongue') {
    material.color.set('#9e4f58');
    material.roughness = quality === 'cinematic' ? .46 : quality === 'ultra' ? .5 : .56;
    material.envMapIntensity = quality === 'cinematic' ? .92 : .82;
  } else {
    material.color.set('#35171c');
    material.roughness = .72;
    material.envMapIntensity = .42;
  }
  if (material instanceof T.MeshPhysicalMaterial) {
    material.ior = role === 'teeth' ? 1.52 : 1.4;
    material.specularIntensity = role === 'teeth' ? .52 : role === 'tongue' ? .38 : .18;
    material.clearcoat = role === 'mouthInterior' ? .08 : role === 'tongue' ? .2 : .3;
    material.clearcoatRoughness = role === 'teeth' ? .16 : role === 'tongue' ? .24 : .34;
  }
  material.needsUpdate = true;
}

export interface AvatarV2MaterialTuningReport {
  skin: number;
  hair: number;
  eyes: number;
  mouth: number;
  corneaPromoted: number;
}

export function tuneAvatarV2Materials(
  root: T.Object3D,
  appearance: PlayerAppearance,
  quality: AvatarVisualQuality,
): AvatarV2MaterialTuningReport {
  const report: AvatarV2MaterialTuningReport = {
    skin: 0,
    hair: 0,
    eyes: 0,
    mouth: 0,
    corneaPromoted: 0,
  };
  let skinCache: ReturnType<typeof createAvatarSkinTextureCache> | undefined;
  let hairCache: ReturnType<typeof createAvatarHairTextureCache> | undefined;
  const textureDetailQuality = avatarV2TextureDetailQuality(quality);

  root.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
    let changed = false;

    const tuned = sourceMaterials.map(source => {
      if (!(source instanceof T.MeshStandardMaterial)) return source;
      const role = avatarV2MaterialRole(source.name);
      let material = source;

      if (role === 'cornea') {
        material = promotePhysical(source, true);
        const promoted = material !== source;
        changed = changed || promoted;
        if (promoted) report.corneaPromoted += 1;
      } else if (
        usesCloseUpPhysicalShading(quality)
        && (role === 'skin' || role === 'hair' || role === 'teeth' || role === 'tongue')
      ) {
        material = promotePhysical(source);
        changed = changed || material !== source;
      }

      if (role === 'skin') {
        material.color.set(appearance.body.skin);
        material.roughness = Math.min(.72, material.roughness || .72);
        const authoredNormal = material.normalMap;
        const authoredRoughness = material.roughnessMap;
        if (!authoredNormal || !authoredRoughness) {
          skinCache ??= createAvatarSkinTextureCache(appearance, textureDetailQuality);
          applyAvatarSkinQuality(material, appearance, quality, skinCache);
          if (authoredNormal) material.normalMap = authoredNormal;
          if (authoredRoughness) material.roughnessMap = authoredRoughness;
        } else {
          material.envMapIntensity = quality === 'cinematic' ? .96 : quality === 'ultra' ? .9 : .82;
        }
        if (material instanceof T.MeshPhysicalMaterial) {
          material.ior = 1.4;
          material.specularIntensity = quality === 'cinematic' ? .34 : quality === 'ultra' ? .31 : .27;
          material.specularColor = new T.Color(appearance.body.skin).lerp(new T.Color('#ffffff'), .34);
          material.sheen = quality === 'cinematic' ? .16 : quality === 'ultra' ? .12 : .08;
          material.sheenRoughness = .84;
          material.sheenColor = new T.Color(appearance.body.skin).lerp(new T.Color('#ffffff'), .12);
          material.clearcoat = quality === 'cinematic' ? .035 : quality === 'ultra' ? .025 : .018;
          material.clearcoatRoughness = .68;
        }
        report.skin += 1;
      } else if (role === 'hair') {
        material.color.set(appearance.head.hair);
        hairCache ??= createAvatarHairTextureCache(textureDetailQuality);
        applyAvatarHairQuality(material, quality, hairCache);
        if (material instanceof T.MeshPhysicalMaterial) {
          material.anisotropy = quality === 'cinematic' ? .86 : quality === 'ultra' ? .74 : .56;
          material.anisotropyRotation = 0;
          material.sheen = quality === 'cinematic' ? .28 : quality === 'ultra' ? .22 : .16;
          material.sheenRoughness = .54;
          material.sheenColor = new T.Color(appearance.head.hair).lerp(new T.Color('#ffffff'), .18);
          material.clearcoat = .05;
          material.clearcoatRoughness = .46;
        }
        report.hair += 1;
      } else if (role === 'iris' || role === 'sclera' || role === 'cornea') {
        tuneEyeSurface(material, role, appearance, quality);
        report.eyes += 1;
      } else if (role === 'teeth' || role === 'tongue' || role === 'mouthInterior') {
        tuneMouthMaterial(material, role, quality);
        report.mouth += 1;
      }

      return material;
    });

    if (changed) node.material = Array.isArray(node.material) ? tuned : tuned[0];
  });

  root.userData.rockmundoAvatarV2MaterialQuality = {
    quality,
    ...report,
  };
  return report;
}
