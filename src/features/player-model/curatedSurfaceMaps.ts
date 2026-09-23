import * as T from 'three';

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
