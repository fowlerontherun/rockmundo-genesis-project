import * as T from 'three';
import { avatarQualityProfile, type AvatarVisualQuality } from './avatarVisualQuality';

export type CuratedFinish =
  | 'cotton'
  | 'vintage-cotton'
  | 'denim'
  | 'tartan'
  | 'leather'
  | 'canvas'
  | 'polished-leather';

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function noise(x: number, y: number, seed: number) {
  let n = Math.imul(x + seed, 374761393) ^ Math.imul(y + seed * 3, 668265263);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) & 255) / 255;
}

function dataTexture(name: string, pixels: Uint8Array, size: number) {
  const texture = new T.DataTexture(pixels, size, size, T.RGBAFormat);
  texture.name = name;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function rgba(size: number, sample: (x: number, y: number) => number) {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const value = Math.max(0, Math.min(255, Math.round(sample(x, y))));
      const offset = (y * size + x) * 4;
      pixels[offset] = value;
      pixels[offset + 1] = value;
      pixels[offset + 2] = value;
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

/**
 * Fine surface height information for curated donor clothing. This keeps the
 * proven skinned silhouette while adding fabric grain, leather pores, seams and
 * wear that react to stage lighting.
 */
export function curatedReliefTexture(assetKey: string, finish: CuratedFinish) {
  const size = 256;
  const seed = hash(assetKey);
  const pixels = rgba(size, (x, y) => {
    const n = noise(x, y, seed);
    const bikerPanels = assetKey.includes('biker-jacket')
      ? ((Math.abs(((x + y) % 128) - 64) < 2 ? 20 : 0) + (x % 112 < 2 ? 12 : 0))
      : 0;
    const jeanWhiskers = assetKey.includes('jeans')
      ? (Math.abs(((y + Math.floor(x * .28)) % 96) - 48) < 2 ? 7 : 0)
      : 0;
    const bootSeams = assetKey.includes('boots')
      ? ((y % 92 < 2 ? 13 : 0) + (Math.abs(((x + y) % 144) - 72) < 2 ? 7 : 0))
      : 0;
    if (finish === 'cotton') {
      const weave = ((x % 6) < 2 ? 8 : 0) + ((y % 6) < 2 ? 8 : 0);
      return 126 + weave + (n - .5) * 8;
    }
    if (finish === 'vintage-cotton') {
      const weave = ((x % 7) < 2 ? 7 : 0) + ((y % 7) < 2 ? 7 : 0);
      const worn = noise(Math.floor(x / 12), Math.floor(y / 12), seed + 17) * 12;
      return 124 + weave + (n - .5) * 10 - worn;
    }
    if (finish === 'denim') {
      const twill = ((x + y + (seed % 7)) % 10) < 3 ? 18 : 0;
      const cross = ((x - y + size) % 29) < 2 ? 6 : 0;
      const seam = (x % 96 < 2 || y % 112 < 2) ? 20 : 0;
      return 118 + twill + cross + seam + jeanWhiskers + (n - .5) * 8;
    }
    if (finish === 'tartan') {
      const broad = (x % 72 < 18 || y % 72 < 18) ? 12 : 0;
      const fine = (x % 18 < 2 || y % 18 < 2) ? 10 : 0;
      return 122 + broad + fine + (n - .5) * 6;
    }
    if (finish === 'canvas') {
      const warp = x % 5 < 2 ? 14 : 0;
      const weft = y % 5 < 2 ? 14 : 0;
      const seam = y % 84 < 2 ? 16 : 0;
      return 116 + warp + weft + seam + (n - .5) * 6;
    }
    if (finish === 'leather' || finish === 'polished-leather') {
      const pore = noise(Math.floor(x / 2), Math.floor(y / 2), seed + 31);
      const creaseA = Math.abs(((x + y + (seed % 37)) % 83) - 41) < 2 ? 15 : 0;
      const creaseB = Math.abs(((x - y + size + (seed % 53)) % 117) - 58) < 2 ? 10 : 0;
      const strength = finish === 'polished-leather' ? .62 : 1;
      return 124 + (pore - .5) * 18 * strength + (creaseA + creaseB + bikerPanels + bootSeams) * strength;
    }
    return 128;
  });
  return dataTexture(`curated-relief-${assetKey}`, pixels, size);
}

/**
 * Roughness variation gives cotton, denim and leather a less flat/plastic read.
 * MeshStandardMaterial samples the green channel, so the greyscale texture is
 * intentionally authored around the base roughness chosen by the finish.
 */
export function curatedRoughnessTexture(assetKey: string, finish: CuratedFinish) {
  const size = 128;
  const seed = hash(assetKey) + 101;
  const pixels = rgba(size, (x, y) => {
    const n = noise(x, y, seed);
    if (finish === 'polished-leather') return 155 + n * 35;
    if (finish === 'leather') return 185 + n * 35;
    if (finish === 'denim') return 222 + n * 26;
    if (finish === 'tartan') return 215 + n * 28;
    if (finish === 'canvas') return 226 + n * 24;
    if (finish === 'vintage-cotton') return 230 + n * 22;
    return 220 + n * 24;
  });
  return dataTexture(`curated-roughness-${assetKey}`, pixels, size);
}

export function curatedBumpScale(finish: CuratedFinish) {
  if (finish === 'polished-leather') return .006;
  if (finish === 'leather') return .012;
  if (finish === 'denim') return .018;
  if (finish === 'tartan') return .011;
  if (finish === 'canvas') return .02;
  if (finish === 'vintage-cotton') return .012;
  return .009;
}


/**
 * Greyscale colour modulation used by curated skins. Material colour still
 * defines the selected variant; this map adds visible stitching, panel breaks,
 * faded wear and weave contrast so the item reads at normal gameplay distance.
 */
export function curatedAlbedoTexture(assetKey: string, finish: CuratedFinish) {
  const size = 256;
  const seed = hash(assetKey) + 211;
  const pixels = rgba(size, (x, y) => {
    const n = noise(x, y, seed);
    let value = 238 + (n - .5) * 8;

    if (finish === 'cotton' || finish === 'vintage-cotton') {
      const knit = ((x % 8) < 2 ? -5 : 2) + ((y % 8) < 2 ? -4 : 1);
      const collarBand = y % 126 < 4 ? -14 : 0;
      value += knit + collarBand;
      if (finish === 'vintage-cotton') {
        value -= noise(Math.floor(x / 20), Math.floor(y / 20), seed + 9) * 22;
      }
    }

    if (finish === 'denim') {
      value = 214 + (((x + y) % 12) < 4 ? 18 : -4) + (n - .5) * 10;
      if (x % 96 < 3 || y % 118 < 3) value -= 25;
      if (assetKey.includes('jeans') && Math.abs(((y + Math.floor(x * .25)) % 90) - 45) < 3) value += 18;
    }

    if (finish === 'tartan') {
      value = 225;
      if (x % 72 < 20) value -= 44;
      if (y % 72 < 20) value -= 34;
      if (x % 18 < 3 || y % 18 < 3) value -= 24;
      if (x % 36 >= 18 && y % 36 >= 18) value += 10;
    }

    if (finish === 'canvas') {
      value = 228 + ((x % 6) < 2 ? 10 : -2) + ((y % 6) < 2 ? 8 : -2);
      if (y % 92 < 3) value -= 18;
    }

    if (finish === 'leather' || finish === 'polished-leather') {
      value = finish === 'polished-leather' ? 246 : 232;
      value += (n - .5) * (finish === 'polished-leather' ? 6 : 12);
      if (assetKey.includes('biker-jacket')) {
        if (Math.abs(((x + y) % 128) - 64) < 3) value -= 34;
        if (x % 112 < 3) value -= 22;
        if (Math.abs(x - size / 2) < 3) value += 20;
      }
      if (assetKey.includes('boots')) {
        if (y % 92 < 3) value -= 24;
        if (Math.abs(((x + y) % 144) - 72) < 3) value -= 16;
        if (x > 96 && x < 160 && y > 80 && y < 176 && x % 14 < 3) value += 14;
      }
    }

    return value;
  });
  const texture = dataTexture(`curated-albedo-${assetKey}`, pixels, size);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}


export function curatedNormalTexture(assetKey: string, finish: CuratedFinish) {
  const relief = curatedReliefTexture(assetKey, finish);
  const source = relief.image.data as Uint8Array;
  const size = relief.image.width as number;
  const pixels = new Uint8Array(size * size * 4);
  const strength = finish === 'canvas' || finish === 'denim'
    ? 2.2
    : finish === 'leather'
      ? 1.55
      : finish === 'polished-leather'
        ? .9
        : 1.3;

  const height = (x: number, y: number) => {
    const wrappedX = (x + size) % size;
    const wrappedY = (y + size) % size;
    return source[(wrappedY * size + wrappedX) * 4] / 255;
  };

  const normal = new T.Vector3();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (height(x + 1, y) - height(x - 1, y)) * strength;
      const dy = (height(x, y + 1) - height(x, y - 1)) * strength;
      normal.set(-dx, -dy, 1).normalize();
      const offset = (y * size + x) * 4;
      pixels[offset] = Math.round((normal.x * .5 + .5) * 255);
      pixels[offset + 1] = Math.round((normal.y * .5 + .5) * 255);
      pixels[offset + 2] = Math.round((normal.z * .5 + .5) * 255);
      pixels[offset + 3] = 255;
    }
  }

  relief.dispose();
  const texture = dataTexture(`curated-normal-${assetKey}`, pixels, size);
  texture.colorSpace = T.NoColorSpace;
  return texture;
}


export function curatedTartanTexture(assetKey: string, primary: string, secondary = '#171717') {
  const size = 256;
  const seed = hash(assetKey) + 313;
  const base = new T.Color(primary);
  const accent = new T.Color(secondary);
  const light = new T.Color('#e7dfcf');
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const broadX = x % 72 < 18;
      const broadY = y % 72 < 18;
      const fineX = x % 18 < 3;
      const fineY = y % 18 < 3;
      const cross = broadX && broadY;
      const thread = ((x + y + (seed % 11)) % 9) < 3;
      const colour = base.clone();

      if (broadX || broadY) colour.lerp(accent, cross ? .78 : .58);
      if (fineX || fineY) colour.lerp(accent, .72);
      if ((x % 36 < 2 || y % 36 < 2) && !cross) colour.lerp(light, .18);
      colour.multiplyScalar(thread ? 1.055 : .96);

      const offset = (y * size + x) * 4;
      pixels[offset] = Math.round(T.MathUtils.clamp(colour.r, 0, 1) * 255);
      pixels[offset + 1] = Math.round(T.MathUtils.clamp(colour.g, 0, 1) * 255);
      pixels[offset + 2] = Math.round(T.MathUtils.clamp(colour.b, 0, 1) * 255);
      pixels[offset + 3] = 255;
    }
  }

  const texture = dataTexture(`curated-tartan-${assetKey}`, pixels, size);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}


function textureHash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function targetCuratedSize(quality: AvatarVisualQuality, baseSize: number) {
  if (quality === 'crowd') return Math.min(baseSize, 128);
  if (quality === 'balanced') return baseSize;
  if (quality === 'high') return Math.max(baseSize, 512);
  if (quality === 'ultra') return Math.max(baseSize, 1024);
  return Math.max(baseSize, 2048);
}

/**
 * Upscales procedural curated surface maps only for close-up tiers and injects
 * restrained micro-variation so 512/1024/2048 textures carry real extra
 * detail rather than simply stretching the existing 256px map.
 */
export function curatedTextureForQuality(
  source: T.DataTexture,
  quality: AvatarVisualQuality,
  kind: 'color' | 'normal' | 'roughness' | 'height',
) {
  const src = source.image?.data as Uint8Array | undefined;
  const sw = Number(source.image?.width || 0);
  const sh = Number(source.image?.height || 0);
  if (!src || !sw || !sh) return source;

  const target = targetCuratedSize(quality, Math.max(sw, sh));
  if (target === sw && target === sh) {
    source.anisotropy = avatarQualityProfile(quality).anisotropy;
    return source;
  }

  const pixels = new Uint8Array(target * target * 4);
  const seed = textureHash(source.name || 'curated');
  const sample = (channel: number, x: number, y: number) => {
    // Bilinear filtering during generation avoids magnifying the original
    // 128/256px texels into visible square blocks in 1K/2K store artwork.
    const fx = T.MathUtils.clamp(((x + .5) / target) * sw - .5, 0, sw - 1);
    const fy = T.MathUtils.clamp(((y + .5) / target) * sh - .5, 0, sh - 1);
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1);
    const tx = fx - x0, ty = fy - y0;
    const at = (px: number, py: number) => src[(py * sw + px) * 4 + channel];
    const a = T.MathUtils.lerp(at(x0, y0), at(x1, y0), tx);
    const b = T.MathUtils.lerp(at(x0, y1), at(x1, y1), tx);
    return T.MathUtils.lerp(a, b, ty);
  };

  for (let y = 0; y < target; y++) {
    for (let x = 0; x < target; x++) {
      const offset = (y * target + x) * 4;
      const micro = (noise(x, y, seed) - .5);
      if (kind === 'normal') {
        const nx = sample(0, x, y) / 127.5 - 1 + micro * .028;
        const ny = sample(1, x, y) / 127.5 - 1 + (noise(y, x, seed + 31) - .5) * .028;
        const nz = sample(2, x, y) / 127.5 - 1;
        const normal = new T.Vector3(nx, ny, nz).normalize();
        pixels[offset] = Math.round((normal.x * .5 + .5) * 255);
        pixels[offset + 1] = Math.round((normal.y * .5 + .5) * 255);
        pixels[offset + 2] = Math.round((normal.z * .5 + .5) * 255);
      } else {
        const amplitude = kind === 'color' ? 5 : kind === 'height' ? 6 : 8;
        pixels[offset] = T.MathUtils.clamp(sample(0, x, y) + micro * amplitude, 0, 255);
        pixels[offset + 1] = T.MathUtils.clamp(sample(1, x, y) + micro * amplitude, 0, 255);
        pixels[offset + 2] = T.MathUtils.clamp(sample(2, x, y) + micro * amplitude, 0, 255);
      }
      pixels[offset + 3] = 255;
    }
  }

  const result = new T.DataTexture(pixels, target, target, T.RGBAFormat);
  result.name = `${source.name}-${quality}`;
  result.wrapS = source.wrapS;
  result.wrapT = source.wrapT;
  result.magFilter = T.LinearFilter;
  result.minFilter = T.LinearMipmapLinearFilter;
  result.generateMipmaps = true;
  result.anisotropy = avatarQualityProfile(quality).anisotropy;
  result.colorSpace = source.colorSpace;
  result.needsUpdate = true;
  source.dispose();
  return result;
}
