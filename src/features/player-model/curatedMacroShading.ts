import * as T from 'three';
import type { CuratedFinish } from './curatedSurfaceMaps';

function smoothBand(value: number, center: number, width: number) {
  const distance = Math.abs(value - center);
  if (distance >= width) return 0;
  const t = 1 - distance / width;
  return t * t * (3 - 2 * t);
}

function normalized(value: number, min: number, max: number) {
  return max - min > 1e-6 ? T.MathUtils.clamp((value - min) / (max - min), 0, 1) : .5;
}

/**
 * Adds large-scale garment shading directly to the fitted mesh vertices.
 * Micro-texture alone disappears at gameplay distance; these restrained
 * gradients make seams, washes and panel construction readable without
 * spawning any floating geometry.
 */
export function applyCuratedMacroShading(
  geometry: T.BufferGeometry,
  assetKey: string,
  finish?: CuratedFinish,
) {
  const position = geometry.attributes.position;
  if (!position) return;

  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds) return;

  const colours = new Float32Array(position.count * 3);
  const centerX = (bounds.min.x + bounds.max.x) * .5;
  const centerZ = (bounds.min.z + bounds.max.z) * .5;

  for (let i = 0; i < position.count; i++) {
    const x = normalized(position.getX(i), bounds.min.x, bounds.max.x);
    const y = normalized(position.getY(i), bounds.min.y, bounds.max.y);
    const z = normalized(position.getZ(i), bounds.min.z, bounds.max.z);
    const signedX = (position.getX(i) - centerX) / Math.max(.001, (bounds.max.x - bounds.min.x) * .5);
    const signedZ = (position.getZ(i) - centerZ) / Math.max(.001, (bounds.max.z - bounds.min.z) * .5);
    const front = T.MathUtils.smoothstep(signedZ, .02, .8);

    let shade = 1;

    // Keep garment edges readable even under flat UI lighting.
    const edge = Math.max(Math.abs(signedX), Math.abs(signedZ));
    shade *= 1 - T.MathUtils.smoothstep(edge, .72, 1) * .055;

    if (assetKey.includes('vintage-charcoal-tee')) {
      const chestFade = smoothBand(y, .58, .35) * front;
      shade *= 1 + chestFade * .035;
      shade *= 1 - smoothBand(y, .08, .12) * .045;
    }

    if (assetKey.includes('logo-tee') || assetKey.includes('plain-black-tee') || assetKey.includes('plain-white-tee')) {
      // A gentle shoulder-to-hem falloff keeps a basic tee from reading as one flat colour.
      shade *= .965 + y * .055;
      shade *= 1 - smoothBand(Math.abs(signedX), .88, .16) * .035;
    }

    if (assetKey.includes('jeans')) {
      const thighWear = smoothBand(y, .66, .16) * front;
      const kneeWear = smoothBand(y, .42, .11) * front;
      const outerSeam = smoothBand(Math.abs(signedX), .94, .055);
      shade *= 1 + thighWear * .055 + kneeWear * .075;
      shade *= 1 - outerSeam * .07;
      if (assetKey.includes('dark-slim')) shade *= .975 + y * .018;
      if (assetKey.includes('black-straight')) shade *= .965 + kneeWear * .02;
    }

    if (assetKey.includes('tartan-trousers')) {
      const crease = smoothBand(Math.abs(signedX), .18, .09) * front;
      const outerSeam = smoothBand(Math.abs(signedX), .94, .05);
      shade *= 1 + crease * .035;
      shade *= 1 - outerSeam * .065;
    }

    if (assetKey.includes('biker-jacket')) {
      // Broad front panels/lapels: deliberately large enough to survive mipmapping.
      const centreZip = smoothBand(Math.abs(signedX), 0, .045) * front;
      const lapelLeft = smoothBand(signedX + (.34 - y * .15), 0, .075) * front * T.MathUtils.smoothstep(y, .42, .92);
      const lapelRight = smoothBand(signedX - (.34 - y * .15), 0, .075) * front * T.MathUtils.smoothstep(y, .42, .92);
      const lowerPanel = smoothBand(y, .24, .06) * front;
      shade *= 1 + (lapelLeft + lapelRight) * .08 + centreZip * .09;
      shade *= 1 - lowerPanel * .045;
    }

    if (assetKey.includes('boots') || assetKey.includes('trainers')) {
      const toe = T.MathUtils.smoothstep(z, .6, .96);
      const heel = 1 - T.MathUtils.smoothstep(z, .08, .3);
      const sole = 1 - T.MathUtils.smoothstep(y, .08, .18);
      shade *= 1 + toe * (finish === 'polished-leather' ? .09 : .045);
      shade *= 1 - heel * .035;
      shade *= 1 - sole * .075;
      if (assetKey.includes('combat-boots')) {
        const upper = T.MathUtils.smoothstep(y, .55, .9);
        shade *= 1 - upper * .035;
      }
    }

    shade = T.MathUtils.clamp(shade, .78, 1.12);
    colours[i * 3] = shade;
    colours[i * 3 + 1] = shade;
    colours[i * 3 + 2] = shade;
  }

  geometry.setAttribute('color', new T.BufferAttribute(colours, 3));
}
