import * as T from 'three';
import type { PlayerAppearance } from './appearance';
import type { AvatarVisualQuality } from './avatarVisualQuality';

function band(value: number, center: number, width: number) {
  const d = Math.abs(value - center);
  if (d >= width) return 0;
  const t = 1 - d / width;
  return t * t * (3 - 2 * t);
}

function norm(value: number, min: number, max: number) {
  return max - min > 1e-6 ? T.MathUtils.clamp((value - min) / (max - min), 0, 1) : .5;
}

/**
 * Adds subtle mesh-bound colour variation to exposed skin. This is deliberately
 * conservative: it improves cheeks, ears, nose and hands in close-ups without
 * adding decals or any geometry that could float away from the rig.
 */
export function applyAvatarSkinMacroShading(
  geometry: T.BufferGeometry,
  part: 'head' | 'body' | 'legs' | 'feet',
  appearance: PlayerAppearance,
  quality: AvatarVisualQuality,
) {
  if (quality === 'crowd' || quality === 'balanced') return;

  const position = geometry.getAttribute('position');
  if (!position) return;
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds || bounds.isEmpty()) return;

  const colors = new Float32Array(position.count * 3);
  const highStrength = quality === 'cinematic' ? 1.08 : quality === 'ultra' ? 1 : .72;
  const warm = appearance.body.frame === 'feminine' ? 1.03 : 1.025;

  for (let i = 0; i < position.count; i++) {
    const x = norm(position.getX(i), bounds.min.x, bounds.max.x);
    const y = norm(position.getY(i), bounds.min.y, bounds.max.y);
    const z = norm(position.getZ(i), bounds.min.z, bounds.max.z);
    const sx = x * 2 - 1;
    const front = T.MathUtils.smoothstep(z, .5, .94);

    let r = 1;
    let g = 1;
    let b = 1;

    if (part === 'head') {
      const cheek = (band(sx, -.28, .22) + band(sx, .28, .22)) * band(y, .43, .18) * front;
      const nose = band(sx, 0, .12) * band(y, .50, .28) * front;
      const ear = T.MathUtils.smoothstep(Math.abs(sx), .72, .98) * band(y, .52, .24);
      const lipZone = band(sx, 0, .24) * band(y, .30, .07) * front;
      const underEye = (band(sx, -.22, .15) + band(sx, .22, .15)) * band(y, .59, .055) * front;

      const warmth = (cheek * .035 + nose * .022 + ear * .03 + lipZone * .025) * highStrength;
      r *= 1 + warmth * warm;
      g *= 1 - warmth * .36;
      b *= 1 - warmth * .48;

      const shadow = underEye * .018 * highStrength;
      r *= 1 - shadow * .5;
      g *= 1 - shadow;
      b *= 1 - shadow * .78;

      const foreheadLight = band(sx, 0, .45) * band(y, .78, .18) * front * .012 * highStrength;
      r *= 1 + foreheadLight;
      g *= 1 + foreheadLight;
      b *= 1 + foreheadLight;
    } else if (part === 'body') {
      // Imported body meshes often contain the hands/forearms as the exposed
      // skin group. A tiny extremity warmth stops hands looking like flat plastic.
      const extremity = T.MathUtils.smoothstep(Math.abs(sx), .70, 1) * (.45 + .55 * (1 - y));
      const warmth = extremity * .025 * highStrength;
      r *= 1 + warmth;
      g *= 1 - warmth * .28;
      b *= 1 - warmth * .42;
    }

    colors[i * 3] = T.MathUtils.clamp(r, .88, 1.12);
    colors[i * 3 + 1] = T.MathUtils.clamp(g, .88, 1.08);
    colors[i * 3 + 2] = T.MathUtils.clamp(b, .86, 1.08);
  }

  geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
}
