import * as T from 'three';
import type { Fabric } from './appearance';

/** Small, deterministic, locally generated textile maps. No network or canvas
 * dependency; rest-space UVs keep the weave attached to animated clothing. */
export function fabricTexture(fabric: Fabric): T.DataTexture {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const grain = ((x * 17 + y * 31 + x * y * 7) % 13) - 6;
    let value = 244 + grain;
    if (fabric === 'stripe') value = (y % 64 < 24 ? 105 : 247) + grain;
    if (fabric === 'plaid') value = 244 - (x % 64 < 22 ? 65 : 0) - (y % 64 < 22 ? 65 : 0) + grain;
    if (fabric === 'pinstripe') value = (x % 32 < 3 ? 250 : 155) + grain;
    if (fabric === 'denim') value = 187 + ((x + y) % 8 < 3 ? 42 : 0) + grain;
    if (fabric === 'canvas') value = 218 + (x % 4 < 2 ? 15 : 0) + (y % 4 < 2 ? 15 : 0);
    if (fabric === 'two-tone') value = y < 64 ? 250 : 95;
    const offset = (y * size + x) * 4;
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = Math.min(255, value); pixels[offset + 3] = 255;
  }
  const texture = new T.DataTexture(pixels, size, size, T.RGBAFormat);
  texture.name = `starter-fabric-${fabric}`; texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.magFilter = T.LinearFilter; texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}

export function fabricUVs(geometry: T.BufferGeometry, footwear: boolean) {
  const position = geometry.attributes.position, uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    uv[i * 2] = (position.getX(i) + position.getZ(i) * .35) * 2;
    uv[i * 2 + 1] = (footwear ? position.getZ(i) : position.getY(i)) * 2;
  }
  geometry.setAttribute('uv', new T.BufferAttribute(uv, 2));
}
