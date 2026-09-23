import * as T from 'three';
import type { PlayerAppearance } from './appearance';
import { avatarQualityProfile, type AvatarVisualQuality } from './avatarVisualQuality';

function noise(x: number, y: number, seed: number) {
  let value = Math.imul(x + seed, 374761393) ^ Math.imul(y + seed * 5, 668265263);
  value = (value ^ (value >>> 13)) >>> 0;
  value = Math.imul(value, 1274126177) >>> 0;
  return ((value ^ (value >>> 16)) & 255) / 255;
}

function seedFor(appearance: PlayerAppearance) {
  const skin = appearance.body.skin || '#c58c68';
  let seed = appearance.body.frame === 'feminine' ? 911 : 577;
  for (let i = 0; i < skin.length; i++) seed = Math.imul(seed ^ skin.charCodeAt(i), 16777619);
  return seed >>> 0;
}

function texture(name: string, pixels: Uint8Array, size: number, anisotropy: number) {
  const result = new T.DataTexture(pixels, size, size, T.RGBAFormat);
  result.name = name;
  result.wrapS = result.wrapT = T.RepeatWrapping;
  result.magFilter = T.LinearFilter;
  result.minFilter = T.LinearMipmapLinearFilter;
  result.generateMipmaps = true;
  result.anisotropy = anisotropy;
  result.colorSpace = T.NoColorSpace;
  result.needsUpdate = true;
  return result;
}

function skinHeight(appearance: PlayerAppearance, size: number) {
  const seed = seedFor(appearance);
  const detail = appearance.head.skinDetail ?? 'smooth';
  const amplitude = detail === 'weathered' ? 1 : detail === 'freckles' ? .58 : .42;
  const values = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const pore = noise(Math.floor(x / 2), Math.floor(y / 2), seed);
      const fine = noise(x, y, seed + 71);
      const broad = noise(Math.floor(x / 18), Math.floor(y / 18), seed + 131);
      let value = .5 + (pore - .5) * .12 * amplitude + (fine - .5) * .035 * amplitude;
      if (detail === 'weathered') value += (broad - .5) * .075;
      values[y * size + x] = value;
    }
  }
  return values;
}

export function avatarSkinNormalTexture(appearance: PlayerAppearance, quality: AvatarVisualQuality) {
  const profile = avatarQualityProfile(quality);
  if (!profile.textureSize) return null;
  const size = profile.textureSize;
  const height = skinHeight(appearance, size);
  const pixels = new Uint8Array(size * size * 4);
  const detail = appearance.head.skinDetail ?? 'smooth';
  const strength = detail === 'weathered' ? 1.3 : detail === 'freckles' ? .76 : .62;
  const normal = new T.Vector3();
  const sample = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (sample(x + 1, y) - sample(x - 1, y)) * strength;
      const dy = (sample(x, y + 1) - sample(x, y - 1)) * strength;
      normal.set(-dx, -dy, 1).normalize();
      const offset = (y * size + x) * 4;
      pixels[offset] = Math.round((normal.x * .5 + .5) * 255);
      pixels[offset + 1] = Math.round((normal.y * .5 + .5) * 255);
      pixels[offset + 2] = Math.round((normal.z * .5 + .5) * 255);
      pixels[offset + 3] = 255;
    }
  }

  return texture(`avatar-skin-normal-${quality}`, pixels, size, profile.anisotropy);
}

export function avatarSkinRoughnessTexture(appearance: PlayerAppearance, quality: AvatarVisualQuality) {
  const profile = avatarQualityProfile(quality);
  if (!profile.textureSize) return null;
  const size = Math.max(128, Math.floor(profile.textureSize / 2));
  const seed = seedFor(appearance) + 331;
  const detail = appearance.head.skinDetail ?? 'smooth';
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const pore = noise(x, y, seed);
      const zone = noise(Math.floor(x / 24), Math.floor(y / 24), seed + 19);
      const base = detail === 'weathered' ? 205 : detail === 'smooth' ? 174 : 188;
      const value = T.MathUtils.clamp(base + (pore - .5) * 24 + (zone - .5) * 18, 120, 240);
      const offset = (y * size + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = Math.round(value);
      pixels[offset + 3] = 255;
    }
  }

  return texture(`avatar-skin-roughness-${quality}`, pixels, size, profile.anisotropy);
}

export interface AvatarSkinTextureCache {
  normal: T.DataTexture | null;
  roughness: T.DataTexture | null;
}

export function createAvatarSkinTextureCache(
  appearance: PlayerAppearance,
  quality: AvatarVisualQuality,
): AvatarSkinTextureCache {
  return {
    normal: avatarSkinNormalTexture(appearance, quality),
    roughness: avatarSkinRoughnessTexture(appearance, quality),
  };
}

export function applyAvatarSkinQuality(
  material: T.MeshStandardMaterial,
  appearance: PlayerAppearance,
  quality: AvatarVisualQuality,
  cache?: AvatarSkinTextureCache,
) {
  if (quality === 'crowd') return;
  const normal = cache?.normal ?? avatarSkinNormalTexture(appearance, quality);
  const roughness = cache?.roughness ?? avatarSkinRoughnessTexture(appearance, quality);
  if (normal) {
    material.normalMap = normal;
    const strength = quality === 'cinematic' ? .38 : quality === 'ultra' ? .34 : quality === 'high' ? .28 : .2;
    material.normalScale.set(strength, strength);
  }
  if (roughness) material.roughnessMap = roughness;
  material.envMapIntensity = quality === 'cinematic' ? .96 : quality === 'ultra' ? .9 : .82;
  material.needsUpdate = true;
}



function hairTextureSize(quality: AvatarVisualQuality) {
  if (quality === 'cinematic') return 1024;
  if (quality === 'ultra') return 512;
  if (quality === 'high') return 256;
  if (quality === 'balanced') return 128;
  return 0;
}

export function avatarHairNormalTexture(quality: AvatarVisualQuality) {
  const size = hairTextureSize(quality);
  if (!size) return null;
  const profile = avatarQualityProfile(quality);
  const pixels = new Uint8Array(size * size * 4);
  const normal = new T.Vector3();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const strand = Math.sin((x / size) * Math.PI * 54) * .035;
      const broken = (noise(x, Math.floor(y / 3), 991) - .5) * .018;
      normal.set(-(strand + broken), 0, 1).normalize();
      const offset = (y * size + x) * 4;
      pixels[offset] = Math.round((normal.x * .5 + .5) * 255);
      pixels[offset + 1] = Math.round((normal.y * .5 + .5) * 255);
      pixels[offset + 2] = Math.round((normal.z * .5 + .5) * 255);
      pixels[offset + 3] = 255;
    }
  }
  return texture(`avatar-hair-normal-${quality}`, pixels, size, profile.anisotropy);
}

export function avatarHairRoughnessTexture(quality: AvatarVisualQuality) {
  const size = hairTextureSize(quality);
  if (!size) return null;
  const profile = avatarQualityProfile(quality);
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const strand = (Math.sin((x / size) * Math.PI * 42) * .5 + .5) * 22;
      const flyaway = noise(x, y, 1771) * 18;
      const value = T.MathUtils.clamp(150 + strand + flyaway, 120, 205);
      const offset = (y * size + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = Math.round(value);
      pixels[offset + 3] = 255;
    }
  }
  return texture(`avatar-hair-roughness-${quality}`, pixels, size, profile.anisotropy);
}

export function applyAvatarEyeQuality(material: T.MeshStandardMaterial, quality: AvatarVisualQuality) {
  if (quality === 'crowd') return;
  material.roughness = quality === 'cinematic' ? .14 : quality === 'ultra' ? .18 : .24;
  material.metalness = 0;
  material.envMapIntensity = quality === 'cinematic' ? 1.62 : quality === 'ultra' ? 1.45 : 1.2;
  material.needsUpdate = true;
}

export function applyAvatarHairQuality(material: T.MeshStandardMaterial, quality: AvatarVisualQuality) {
  if (quality === 'crowd') return;
  material.roughness = quality === 'cinematic' ? .42 : quality === 'ultra' ? .46 : quality === 'high' ? .53 : .62;
  material.metalness = 0;
  material.envMapIntensity = quality === 'cinematic' ? 1.3 : quality === 'ultra' ? 1.22 : quality === 'high' ? 1.08 : 1.0;
  const normal = avatarHairNormalTexture(quality);
  const roughness = avatarHairRoughnessTexture(quality);
  if (normal) {
    material.normalMap = normal;
    const strength = quality === 'cinematic' ? .48 : quality === 'ultra' ? .42 : quality === 'high' ? .34 : .24;
    material.normalScale.set(strength, strength);
  }
  if (roughness) material.roughnessMap = roughness;
  material.needsUpdate = true;
}
