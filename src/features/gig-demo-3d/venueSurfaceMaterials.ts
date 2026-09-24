import * as T from 'three';
import type { VenueKind, VenueProfile } from './venueProfile';

export type VenueSurfacePattern =
  | 'wood'
  | 'brick'
  | 'concrete'
  | 'plaster'
  | 'carpet'
  | 'tile'
  | 'stone'
  | 'metal-panel'
  | 'asphalt'
  | 'grass'
  | 'sand';

interface SurfaceSpec {
  pattern: VenueSurfacePattern;
  base: string;
  detail: string;
  repeat: [number, number];
  roughness: number;
  metalness?: number;
  bumpScale?: number;
}

interface VenueSurfaceStyle {
  floor: SurfaceSpec;
  wall: SurfaceSpec;
  detail: SurfaceSpec;
  seat: SurfaceSpec;
}

export interface VenueSurfaceMaterials {
  floor: T.MeshStandardMaterial;
  wall: T.MeshStandardMaterial;
  detail: T.MeshStandardMaterial;
  seat: T.MeshStandardMaterial;
  concrete: T.MeshStandardMaterial;
  stone: T.MeshStandardMaterial;
  grass: T.MeshStandardMaterial;
  sand: T.MeshStandardMaterial;
}

const spec = (
  pattern: VenueSurfacePattern,
  base: string,
  detail: string,
  repeat: [number, number],
  roughness: number,
  metalness = 0,
  bumpScale = .045,
): SurfaceSpec => ({ pattern, base, detail, repeat, roughness, metalness, bumpScale });

const WOOD_WARM = spec('wood', '#8b684c', '#c5a57f', [6, 3], .62, 0, .035);
const WOOD_DARK = spec('wood', '#3a2a24', '#73523e', [7, 3], .72, 0, .04);
const BRICK_RED = spec('brick', '#5d4038', '#aa7462', [7, 3], .9, 0, .07);
const BRICK_DARK = spec('brick', '#2f292b', '#625052', [7, 3], .92, 0, .06);
const CONCRETE = spec('concrete', '#535a60', '#798086', [7, 7], .92, 0, .055);
const CONCRETE_DARK = spec('concrete', '#272d32', '#485057', [8, 8], .94, 0, .05);
const PLASTER = spec('plaster', '#a59681', '#c9bda9', [5, 4], .96, 0, .025);
const CARPET_RED = spec('carpet', '#481f2b', '#7b3b4f', [8, 10], .96, 0, .025);
const CARPET_NAVY = spec('carpet', '#1f2b3a', '#384c63', [8, 10], .96, 0, .025);
const TILE = spec('tile', '#777a77', '#b5b4aa', [9, 13], .8, 0, .025);
const STONE = spec('stone', '#76716b', '#a39b90', [7, 7], .9, 0, .06);
const METAL_PANEL = spec('metal-panel', '#343d46', '#64727f', [8, 5], .58, .42, .025);
const ASPHALT = spec('asphalt', '#25292b', '#4a4d4c', [10, 12], .98, 0, .04);
const GRASS = spec('grass', '#2c4635', '#567452', [11, 15], .98, 0, .035);
const SAND = spec('sand', '#9b8667', '#cab28a', [12, 12], .94, 0, .025);
const ICE_SEAT = spec('carpet', '#233c56', '#4f6c88', [7, 8], .86, 0, .018);
const BLACK_SEAT = spec('carpet', '#171a1e', '#3b4147', [7, 8], .92, 0, .018);
const HERITAGE_SEAT = spec('carpet', '#612738', '#99465c', [7, 8], .9, 0, .02);

const DEFAULT_STYLE: VenueSurfaceStyle = {
  floor: CONCRETE_DARK,
  wall: BRICK_DARK,
  detail: METAL_PANEL,
  seat: BLACK_SEAT,
};

const VENUE_SURFACE_STYLES: Readonly<Partial<Record<VenueKind, VenueSurfaceStyle>>> = Object.freeze({
  street_corner: { floor: ASPHALT, wall: CONCRETE, detail: TILE, seat: BLACK_SEAT },
  cafe_stage: { floor: WOOD_WARM, wall: PLASTER, detail: spec('tile', '#5c4638', '#b99777', [8, 6], .8), seat: spec('carpet', '#6f5540', '#a37b58', [7, 8], .88) },
  dive_bar: { floor: WOOD_DARK, wall: BRICK_DARK, detail: spec('metal-panel', '#20252a', '#6d7377', [7, 5], .62, .3), seat: BLACK_SEAT },
  jazz_lounge: { floor: CARPET_RED, wall: WOOD_DARK, detail: spec('wood', '#4a2825', '#8b5a49', [5, 4], .7), seat: HERITAGE_SEAT },
  rock_club: { floor: CONCRETE_DARK, wall: BRICK_DARK, detail: spec('metal-panel', '#1a2026', '#48535e', [8, 5], .58, .4), seat: BLACK_SEAT },
  live_house: { floor: WOOD_DARK, wall: spec('brick', '#3e3438', '#71616b', [7, 3], .9), detail: METAL_PANEL, seat: BLACK_SEAT },
  warehouse: { floor: CONCRETE, wall: CONCRETE_DARK, detail: METAL_PANEL, seat: BLACK_SEAT },
  university_union: { floor: TILE, wall: spec('plaster', '#56606b', '#939ca4', [5, 4], .93), detail: spec('tile', '#31363d', '#747f88', [8, 7], .78), seat: CARPET_NAVY },
  church_hall: { floor: WOOD_WARM, wall: PLASTER, detail: spec('stone', '#817766', '#baaa8e', [6, 6], .9), seat: spec('wood', '#594333', '#96755a', [7, 4], .76) },
  concert_hall: { floor: WOOD_WARM, wall: spec('wood', '#6a4932', '#b1845f', [7, 4], .68), detail: spec('wood', '#4e3528', '#8f6648', [8, 4], .7), seat: CARPET_RED },
  theatre: { floor: CARPET_RED, wall: spec('plaster', '#4d2932', '#8e5363', [6, 4], .9), detail: spec('wood', '#4c2e25', '#9a7151', [6, 4], .65), seat: HERITAGE_SEAT },
  indoor_arena: { floor: CONCRETE, wall: METAL_PANEL, detail: spec('metal-panel', '#222a33', '#667585', [9, 5], .52, .46), seat: spec('carpet', '#263b54', '#4c6680', [7, 8], .86) },
  ice_arena: { floor: spec('concrete', '#66747b', '#9eb0b7', [8, 8], .78), wall: spec('metal-panel', '#33434e', '#738b98', [8, 5], .48, .38), detail: spec('tile', '#d1dadc', '#7aa8ba', [10, 10], .52), seat: ICE_SEAT },
  stadium: { floor: CONCRETE, wall: spec('concrete', '#555b5d', '#8d9391', [9, 7], .9), detail: spec('metal-panel', '#2d363e', '#71808b', [10, 5], .55, .42), seat: spec('carpet', '#26465b', '#4d7690', [7, 8], .86) },
  amphitheatre: { floor: STONE, wall: STONE, detail: spec('stone', '#5d5a52', '#9c9382', [6, 6], .92), seat: STONE },
  park_bandstand: { floor: GRASS, wall: PLASTER, detail: spec('wood', '#596a55', '#9eaa87', [6, 4], .74), seat: spec('wood', '#535243', '#88846d', [6, 4], .82) },
  city_square: { floor: spec('stone', '#6b6865', '#a29c95', [10, 10], .9), wall: STONE, detail: TILE, seat: STONE },
  rooftop_terrace: { floor: spec('tile', '#575b5e', '#90969a', [10, 10], .78), wall: CONCRETE, detail: METAL_PANEL, seat: spec('wood', '#4e4035', '#8c735d', [6, 4], .76) },
  festival_tent: { floor: spec('grass', '#314532', '#6f8052', [12, 16], .99), wall: PLASTER, detail: spec('wood', '#5d4c3d', '#9a8269', [6, 4], .82), seat: BLACK_SEAT },
  beach_stage: { floor: SAND, wall: PLASTER, detail: spec('wood', '#6a5946', '#b99d77', [7, 4], .82), seat: BLACK_SEAT },
  festival_stage: { floor: GRASS, wall: METAL_PANEL, detail: spec('metal-panel', '#20262d', '#66737d', [9, 5], .56, .45), seat: BLACK_SEAT },
  tv_studio: { floor: CONCRETE_DARK, wall: METAL_PANEL, detail: spec('metal-panel', '#191d27', '#5b4570', [8, 5], .5, .45), seat: BLACK_SEAT },
});

function rgb(hex: string) {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
}

function samplePattern(pattern: VenueSurfacePattern, x: number, y: number) {
  const noise = ((x * 17 + y * 29 + x * y * 3) % 31) / 31;
  if (pattern === 'brick') {
    const row = Math.floor(y / 10);
    const mortarY = y % 10 < 1;
    const shiftedX = (x + (row % 2) * 8) % 16;
    return mortarY || shiftedX < 1 ? .82 : .1 + noise * .12;
  }
  if (pattern === 'wood') {
    const grain = Math.abs(Math.sin((x * .36) + Math.sin(y * .12) * 1.7));
    const board = x % 18 < 1 ? .58 : 0;
    return Math.min(1, .06 + grain * .28 + board);
  }
  if (pattern === 'concrete') return Math.min(.55, .08 + noise * .28 + ((x + y * 3) % 41 === 0 ? .22 : 0));
  if (pattern === 'plaster') return .05 + noise * .12 + ((x * 5 + y * 7) % 61 === 0 ? .16 : 0);
  if (pattern === 'carpet') return .08 + (((x + y) % 5) / 5) * .12 + noise * .12;
  if (pattern === 'tile') return x % 12 < 1 || y % 12 < 1 ? .68 : .08 + noise * .1;
  if (pattern === 'stone') {
    const row = Math.floor(y / 14);
    const seamY = y % 14 < 1;
    const seamX = (x + (row % 2) * 9) % 18 < 1;
    return seamY || seamX ? .62 : .1 + noise * .16;
  }
  if (pattern === 'metal-panel') return x % 20 < 1 || y % 16 < 1 ? .52 : .05 + noise * .12;
  if (pattern === 'asphalt') return .05 + noise * .24 + ((x * 7 + y * 11) % 47 === 0 ? .28 : 0);
  if (pattern === 'grass') return .08 + ((x * 3 + y * 11) % 13) / 13 * .3;
  return .06 + noise * .22 + ((x + y * 2) % 37 === 0 ? .2 : 0);
}

function proceduralTexture(
  specValue: SurfaceSpec,
  name: string,
  bump = false,
) {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  const base = rgb(specValue.base);
  const detail = rgb(specValue.detail);

  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const mix = Math.max(0, Math.min(1, samplePattern(specValue.pattern, x, y)));
    const offset = (y * size + x) * 4;
    if (bump) {
      const value = Math.round(90 + mix * 145);
      data[offset] = value; data[offset + 1] = value; data[offset + 2] = value;
    } else {
      data[offset] = Math.round(base[0] + (detail[0] - base[0]) * mix);
      data[offset + 1] = Math.round(base[1] + (detail[1] - base[1]) * mix);
      data[offset + 2] = Math.round(base[2] + (detail[2] - base[2]) * mix);
    }
    data[offset + 3] = 255;
  }

  const texture = new T.DataTexture(data, size, size, T.RGBAFormat);
  texture.name = `${name}-${bump ? 'bump' : 'diffuse'}`;
  texture.wrapS = T.RepeatWrapping;
  texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(...specValue.repeat);
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.colorSpace = bump ? T.NoColorSpace : T.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function materialFor(
  p: VenueProfile,
  role: string,
  specValue: SurfaceSpec,
  fallbackWood: T.Material,
  fallbackBrick: T.Material,
) {
  const name = `venue-${p.kind}-${role}-${specValue.pattern}`;
  const fallback = specValue.pattern === 'wood' ? fallbackWood : specValue.pattern === 'brick' ? fallbackBrick : null;
  const material = fallback instanceof T.MeshStandardMaterial
    ? fallback.clone()
    : new T.MeshStandardMaterial();

  material.name = name;
  material.color.set(specValue.pattern === 'wood' || specValue.pattern === 'brick' ? specValue.base : '#ffffff');
  material.roughness = specValue.roughness;
  material.metalness = specValue.metalness ?? 0;
  if (!material.map) material.map = proceduralTexture(specValue, name);
  if (!material.normalMap && !material.bumpMap) {
    material.bumpMap = proceduralTexture(specValue, name, true);
    material.bumpScale = specValue.bumpScale ?? .04;
  }
  material.userData.venueSurfacePattern = specValue.pattern;
  material.userData.venueSurfaceRole = role;
  material.userData.venueKind = p.kind;
  material.needsUpdate = true;
  return material;
}

export function buildVenueSurfaceMaterials(
  p: VenueProfile,
  fallbackWood: T.Material,
  fallbackBrick: T.Material,
): VenueSurfaceMaterials {
  const style = VENUE_SURFACE_STYLES[p.kind] ?? DEFAULT_STYLE;
  return {
    floor: materialFor(p, 'floor', style.floor, fallbackWood, fallbackBrick),
    wall: materialFor(p, 'wall', style.wall, fallbackWood, fallbackBrick),
    detail: materialFor(p, 'detail', style.detail, fallbackWood, fallbackBrick),
    seat: materialFor(p, 'seat', style.seat, fallbackWood, fallbackBrick),
    concrete: materialFor(p, 'concrete', CONCRETE, fallbackWood, fallbackBrick),
    stone: materialFor(p, 'stone', STONE, fallbackWood, fallbackBrick),
    grass: materialFor(p, 'grass', GRASS, fallbackWood, fallbackBrick),
    sand: materialFor(p, 'sand', SAND, fallbackWood, fallbackBrick),
  };
}
