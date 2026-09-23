import * as T from 'three';
import type { Fabric } from './appearance';
import { avatarQualityProfile, type AvatarVisualQuality } from './avatarVisualQuality';

function textureSize(quality: AvatarVisualQuality) {
  const size = avatarQualityProfile(quality).textureSize;
  return size || 128;
}

function scaleUnit(size: number, value: number) {
  return Math.max(1, Math.round(value * size / 256));
}

function grain(x: number, y: number) {
  return ((x * 17 + y * 31 + x * y * 7) % 13) - 6;
}

function fabricColourValue(fabric: Fabric, x: number, y: number, size: number) {
  const s = (value: number) => scaleUnit(size, value);
  const g = grain(x, y);
  let value = 244 + g;
  if (fabric === 'stripe') value = (y % s(64) < s(24) ? 105 : 247) + g;
  if (fabric === 'plaid') {
    const broad = (x % s(72) < s(20) ? 58 : 0) + (y % s(72) < s(20) ? 58 : 0);
    const fine = (x % s(18) < s(3) ? 24 : 0) + (y % s(18) < s(3) ? 24 : 0);
    value = 246 - broad - fine + g;
  }
  if (fabric === 'pinstripe') value = (x % s(32) < s(3) ? 250 : 155) + g;
  if (fabric === 'denim') {
    const diagonal = ((x + y) % s(10) < s(3) ? 34 : 0);
    const cross = ((x - y + size) % s(22) < s(2) ? 12 : 0);
    value = 178 + diagonal + cross + g;
  }
  if (fabric === 'canvas') {
    const warp = x % s(6) < s(2) ? 18 : 0;
    const weft = y % s(6) < s(2) ? 18 : 0;
    value = 210 + warp + weft + g;
  }
  if (fabric === 'two-tone') value = y < s(64) ? 250 : 95;
  return T.MathUtils.clamp(value, 0, 255);
}

function fabricHeightValue(fabric: Fabric, x: number, y: number, size: number) {
  const s = (value: number) => scaleUnit(size, value);
  const noise = grain(x, y) / 255;
  let height = .5 + noise * .08;

  if (fabric === 'denim') {
    height += ((x + y) % s(10) < s(3) ? .08 : -.025);
    height += ((x - y + size) % s(22) < s(2) ? .035 : 0);
  } else if (fabric === 'canvas') {
    height += (x % s(6) < s(2) ? .065 : -.018);
    height += (y % s(6) < s(2) ? .065 : -.018);
  } else if (fabric === 'plaid') {
    height += (x % s(18) < s(2) || y % s(18) < s(2)) ? .04 : 0;
  } else if (fabric === 'pinstripe') {
    height += x % s(32) < s(2) ? .026 : 0;
  } else {
    height += (x % s(8) < s(2) ? .018 : 0) + (y % s(8) < s(2) ? .018 : 0);
  }

  return T.MathUtils.clamp(height, 0, 1);
}

function buildTexture(name: string, pixels: Uint8Array, size: number, quality: AvatarVisualQuality, colorSpace: T.ColorSpace) {
  const texture = new T.DataTexture(pixels, size, size, T.RGBAFormat);
  texture.name = name;
  texture.colorSpace = colorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = avatarQualityProfile(quality).anisotropy;
  texture.needsUpdate = true;
  return texture;
}

/** Deterministic locally generated textile maps. Resolution follows the avatar
 * quality tier so starter clothes stay sharp beside curated 1K/2K garments. */
export function fabricTexture(fabric: Fabric, quality: AvatarVisualQuality = 'balanced'): T.DataTexture {
  const size = textureSize(quality);
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const value = fabricColourValue(fabric, x, y, size);
    const offset = (y * size + x) * 4;
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = value;
    pixels[offset + 3] = 255;
  }
  return buildTexture(`starter-fabric-${fabric}-${quality}`, pixels, size, quality, T.SRGBColorSpace);
}

export function fabricNormalTexture(fabric: Fabric, quality: AvatarVisualQuality = 'balanced'): T.DataTexture {
  const size = textureSize(quality);
  const pixels = new Uint8Array(size * size * 4);
  const normal = new T.Vector3();
  const sample = (x: number, y: number) => fabricHeightValue(fabric, (x + size) % size, (y + size) % size, size);
  const strength = fabric === 'canvas' ? 2.1 : fabric === 'denim' ? 1.8 : 1.1;

  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (sample(x + 1, y) - sample(x - 1, y)) * strength;
    const dy = (sample(x, y + 1) - sample(x, y - 1)) * strength;
    normal.set(-dx, -dy, 1).normalize();
    const offset = (y * size + x) * 4;
    pixels[offset] = Math.round((normal.x * .5 + .5) * 255);
    pixels[offset + 1] = Math.round((normal.y * .5 + .5) * 255);
    pixels[offset + 2] = Math.round((normal.z * .5 + .5) * 255);
    pixels[offset + 3] = 255;
  }

  return buildTexture(`starter-fabric-normal-${fabric}-${quality}`, pixels, size, quality, T.NoColorSpace);
}

export function fabricUVs(geometry: T.BufferGeometry, footwear: boolean) {
  const position = geometry.attributes.position, uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    uv[i * 2] = (position.getX(i) + position.getZ(i) * .35) * 2;
    uv[i * 2 + 1] = (footwear ? position.getZ(i) : position.getY(i)) * 2;
  }
  geometry.setAttribute('uv', new T.BufferAttribute(uv, 2));
}
