import * as T from 'three';
import type { ClothingPattern } from './appearance';

/** Two explicit sRGB dyes; material tint must stay white to preserve both. */
export function clothingPatternTexture(pattern: ClothingPattern, primary: string, secondary: string) {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  const rgb = (hex: string) => [1,3,5].map(start => parseInt(hex.slice(start, start + 2), 16));
  const a = rgb(primary), b = rgb(secondary);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const accent = pattern === 'stripes' ? y % 32 < 12
      : pattern === 'checks' ? (Math.floor(x / 32) + Math.floor(y / 32)) % 2 === 1
      : pattern === 'dots' ? Math.hypot(x % 32 - 16, y % 32 - 16) < 7
      : pattern === 'two-tone' ? y >= size / 2 : false;
    const colour = accent ? b : a, offset = (y * size + x) * 4;
    pixels.set([...colour, 255], offset);
  }
  const texture = new T.DataTexture(pixels, size, size, T.RGBAFormat);
  texture.name = `clothing-pattern-${pattern}-${primary}-${secondary}`;
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.magFilter = T.LinearFilter; texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}

/** One colour split over the full garment height, independent of donor units. */
export function twoToneUVs(geometry: T.BufferGeometry, frame: T.Matrix4, footwear: boolean, range?: { low: number; high: number }) {
  const positions = geometry.getAttribute('position');
  const values: number[] = [], point = new T.Vector3();
  let low = range?.low ?? Infinity, high = range?.high ?? -Infinity;
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i).applyMatrix4(frame);
    const value = footwear ? point.z : point.y;
    values.push(value);
    if (!range) { low = Math.min(low, value); high = Math.max(high, value); }
  }
  const uv = new Float32Array(positions.count * 2);
  values.forEach((value, i) => { uv[i * 2] = .5; uv[i * 2 + 1] = .999 - .998 * T.MathUtils.clamp((value - low) / Math.max(.001, high - low), 0, 1); });
  geometry.setAttribute('uv', new T.BufferAttribute(uv, 2));
}
