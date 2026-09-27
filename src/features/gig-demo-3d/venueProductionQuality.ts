import * as T from 'three';
import woodFloorUrl from '@/assets/textures/floors/stage-floor-wood.png';
import metalFloorUrl from '@/assets/textures/floors/stage-floor-metal.png';
import rubberFloorUrl from '@/assets/textures/floors/stage-floor-rubber.png';
import concreteFloorUrl from '@/assets/textures/floors/stage-floor-concrete.png';
import ledPanelUrl from '@/assets/textures/venue/stage-backdrop-led.png';
import { box, cylinder, rod } from './stage';
import type { VenueProfile } from './venueProfile';

/** Metres, not a multiplier on the entire venue mesh. Equipment grows in both
 * cabinet size and number: a stadium uses a concert PA, not stretched pub boxes. */
export interface ProductionEquipmentSpec {
  readonly ampWidth: number;
  readonly ampHeight: number;
  readonly ampDepth: number;
  readonly ampColumns: number;
  readonly ampRows: number;
  readonly paWidth: number;
  readonly paHeight: number;
  readonly paDepth: number;
  readonly subWidth: number;
  readonly subHeight: number;
  readonly subDepth: number;
  readonly screenWidth: number;
  readonly screenHeight: number;
  readonly fixtureScale: number;
}
const TIERS: readonly ProductionEquipmentSpec[] = [
  { ampWidth: .66, ampHeight: .55, ampDepth: .42, ampColumns: 1, ampRows: 1, paWidth: .5, paHeight: .35, paDepth: .43, subWidth: .84, subHeight: .6, subDepth: .65, screenWidth: 0, screenHeight: 0, fixtureScale: .8 },
  { ampWidth: .9, ampHeight: .72, ampDepth: .48, ampColumns: 1, ampRows: 1, paWidth: .66, paHeight: .39, paDepth: .54, subWidth: 1.05, subHeight: .75, subDepth: .8, screenWidth: 0, screenHeight: 0, fixtureScale: 1 },
  { ampWidth: 1.12, ampHeight: .82, ampDepth: .57, ampColumns: 1, ampRows: 2, paWidth: .92, paHeight: .43, paDepth: .68, subWidth: 1.25, subHeight: .86, subDepth: .98, screenWidth: 0, screenHeight: 0, fixtureScale: 1.18 },
  { ampWidth: 1.27, ampHeight: .89, ampDepth: .66, ampColumns: 2, ampRows: 2, paWidth: 1.3, paHeight: .49, paDepth: .8, subWidth: 1.52, subHeight: 1.02, subDepth: 1.15, screenWidth: 4.6, screenHeight: 4.5, fixtureScale: 1.47 },
  { ampWidth: 1.46, ampHeight: .96, ampDepth: .73, ampColumns: 2, ampRows: 2, paWidth: 1.62, paHeight: .56, paDepth: .94, subWidth: 1.77, subHeight: 1.16, subDepth: 1.35, screenWidth: 7, screenHeight: 7.4, fixtureScale: 1.8 },
];

/** Tier comes from the actual venue capacity; all visual dimensions are deterministic. */
export function productionEquipmentSpec(tier: number): ProductionEquipmentSpec {
  return TIERS[Math.min(TIERS.length - 1, Math.max(0, Math.floor(Number.isFinite(tier) ? tier : 0)))];
}

function loadTexture(url: string) {
  // The deterministic fallback keeps the 3D scene constructible in Node smoke tests.
  if (typeof document === 'undefined') {
    const map = new T.DataTexture(new Uint8Array([112, 126, 138, 255]), 1, 1, T.RGBAFormat);
    map.needsUpdate = true;
    return map;
  }
  return new T.TextureLoader().load(url);
}

function tiledTexture(url: string, width: number, depth: number, color: boolean) {
  const map = loadTexture(url);
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.repeat.set(Math.max(1, width / 2.4), Math.max(1, depth / 2.4));
  map.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
  map.anisotropy = 4;
  return map;
}

/** Distinct stage-floor surfaces with physically sized tiling and bump detail. */
export function createStageDeckMaterial(p: VenueProfile, _fallbackWood: T.Material): T.Material {
  // Previously the heritage floor reused a fixed-tiling generic wood shader.
  // Give every stage its own metre-scaled map and bump; ornate rooms keep
  // a warmer finish, while touring decks retain their metal/rubber treatment.
  const wood = ['cafe_stage', 'jazz_lounge', 'church_hall', 'concert_hall', 'theatre', 'park_bandstand'].includes(p.kind);
  const concrete = ['street_corner', 'city_square', 'warehouse'].includes(p.kind);
  const isMetal = ['indoor_arena', 'ice_arena', 'stadium', 'festival_stage', 'live_house'].includes(p.kind);
  const url = wood ? woodFloorUrl : concrete ? concreteFloorUrl : isMetal ? metalFloorUrl : rubberFloorUrl;
  const surfaceKind = wood ? 'timber' : concrete ? 'concrete' : isMetal ? 'metal' : 'rubber';
  const surface = new T.MeshStandardMaterial({
    name: 'venue-stage-floor-' + surfaceKind,
    color: p.kind === 'jazz_lounge' ? '#a27e72' : '#ffffff',
    map: tiledTexture(url, p.stageWidth, p.stageDepth, true),
    bumpMap: tiledTexture(url, p.stageWidth, p.stageDepth, false),
    bumpScale: wood ? .032 : concrete ? .025 : isMetal ? .012 : .018,
    roughness: wood ? (p.kind === 'concert_hall' ? .53 : .69) : isMetal ? .62 : .83,
    metalness: isMetal ? .32 : 0,
  });
  surface.userData.venueSurfaceRole = 'stage-deck';
  surface.userData.venueKind = p.kind;
  surface.userData.venueFloorTreatment = surfaceKind;
  return surface;
}

function speakerFront(parent: T.Object3D, width: number, height: number, depth: number, grille: T.Material, steel: T.Material) {
  box(parent, [width - .075, height - .075, .023], [0, 0, depth / 2 + .014], grille);
  for (const side of [-1, 1]) {
    box(parent, [.025, height - .045, .04], [side * (width / 2 - .025), 0, depth / 2 + .03], steel);
  }
  box(parent, [width - .045, .022, .04], [0, height / 2 - .023, depth / 2 + .03], steel);
  box(parent, [width - .045, .022, .04], [0, -height / 2 + .023, depth / 2 + .03], steel);
}

/** Stack dimensions and cabinet grids are visible even from the venue-wide shot. */
export function addAmplifierStack(
  parent: T.Object3D,
  name: string,
  x: number,
  baseY: number,
  z: number,
  spec: ProductionEquipmentSpec,
  shell: T.Material,
  grille: T.Material,
  steel: T.Material,
  chrome: T.Material,
  makeLabel: (text: string, w: number, h: number) => T.Mesh,
) {
  const root = new T.Group();
  root.name = name;
  root.position.set(x, baseY, z);
  parent.add(root);
  const gap = .045;
  for (let row = 0; row < spec.ampRows; row++)
    for (let col = 0; col < spec.ampColumns; col++) {
      const cabinet = new T.Group();
      cabinet.position.set((col - (spec.ampColumns - 1) / 2) * (spec.ampWidth + gap), row * (spec.ampHeight + gap) + spec.ampHeight / 2, 0);
      root.add(cabinet);
      const body = box(cabinet, [spec.ampWidth, spec.ampHeight, spec.ampDepth], [0, 0, 0], shell);
      body.name = name + '-cabinet-' + row + '-' + col;
      speakerFront(cabinet, spec.ampWidth, spec.ampHeight, spec.ampDepth, grille, steel);
      for (const side of [-1, 1]) {
        box(cabinet, [.15, .035, .035], [side * (spec.ampWidth / 2 - .015), .1, 0], chrome);
        for (const vertical of [-1, 1])
          box(cabinet, [.058, .065, .11], [side * (spec.ampWidth / 2 - .03), vertical * (spec.ampHeight / 2 - .032), spec.ampDepth / 2 - .04], steel);
      }
    }
  const totalWidth = spec.ampColumns * spec.ampWidth + (spec.ampColumns - 1) * gap;
  const top = spec.ampRows * spec.ampHeight + (spec.ampRows - 1) * gap;
  const headHeight = .22 + spec.ampWidth * .055;
  box(root, [totalWidth, headHeight, spec.ampDepth * .88], [0, top + headHeight / 2 + .045, 0], shell);
  box(root, [totalWidth - .12, headHeight * .5, .025], [0, top + headHeight / 2 + .045, spec.ampDepth * .44 + .02], steel);
  const logo = makeLabel('VOLTAGE', Math.min(totalWidth * .5, .88), .15);
  logo.name = name + '-badge';
  logo.position.set(-totalWidth * .12, top + headHeight / 2 + .048, spec.ampDepth * .44 + .046);
  root.add(logo);
  for (let i = 0; i < 4; i++) {
    const knob = cylinder(root, .018, .018, .028, [totalWidth * .16 + i * .07, top + headHeight / 2 + .045, spec.ampDepth * .44 + .055], chrome, 8);
    knob.rotation.x = Math.PI / 2;
  }
  root.userData.cabinets = spec.ampRows * spec.ampColumns;
  return root;
}

export function addLineArrayCabinet(
  parent: T.Object3D, name: string, x: number, y: number, z: number, index: number,
  spec: ProductionEquipmentSpec, shell: T.Material, grille: T.Material, steel: T.Material,
) {
  const root = new T.Group();
  root.name = name;
  root.position.set(x, y, z);
  root.rotation.x = -index * .018;
  parent.add(root);
  const body = box(root, [spec.paWidth, spec.paHeight, spec.paDepth], [0, 0, 0], shell);
  body.name = name + '-cabinet';
  speakerFront(root, spec.paWidth, spec.paHeight, spec.paDepth, grille, steel);
  for (const side of [-1, 1]) {
    const xSide = side * (spec.paWidth / 2 + .025);
    box(root, [.05, spec.paHeight * .73, spec.paDepth * .55], [xSide, 0, 0], steel);
    box(root, [.05, .04, .12], [xSide, spec.paHeight * .24, -.1], steel);
  }
  return root;
}

export function addSubwoofer(
  parent: T.Object3D, name: string, x: number, z: number, spec: ProductionEquipmentSpec,
  shell: T.Material, grille: T.Material, steel: T.Material,
) {
  const root = new T.Group();
  root.name = name;
  root.position.set(x, spec.subHeight / 2, z);
  parent.add(root);
  const body = box(root, [spec.subWidth, spec.subHeight, spec.subDepth], [0, 0, 0], shell);
  body.name = name + '-cabinet';
  speakerFront(root, spec.subWidth, spec.subHeight, spec.subDepth, grille, steel);
  for (const side of [-1, 1])
    box(root, [.12, .055, .22], [side * (spec.subWidth / 2 + .005), spec.subHeight * .17, 0], steel);
  return root;
}

function ledTexture() {
  const map = loadTexture(ledPanelUrl);
  map.colorSpace = T.SRGBColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.repeat.set(3, 2);
  map.anisotropy = 4;
  return map;
}

/** One deterministic show graphic is shared by all the venue's LED walls.
 * A 2K stadium display should not use a blown-up club-size texture or
 * allocate a separate identical graphic for every IMAG screen.
 * Canvas is purely a browser render asset: Node tests use the safe fallback. */
export function createVenueShowScreenTexture(p: VenueProfile, bandName: string, tier: number): T.Texture {
  const width = tier >= 4 ? 2048 : tier >= 2 ? 1024 : 512;
  const height = width / 2;
  const texture = (() => {
    if (typeof document === 'undefined') return ledTexture();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return ledTexture();
    const unit = width / 1024;
    const fill = ctx.createLinearGradient(0, 0, width, height);
    fill.addColorStop(0, '#090f1c');
    fill.addColorStop(.51, p.kind === 'theatre' || p.kind === 'concert_hall' ? '#302422' : '#172b3c');
    fill.addColorStop(1, '#050a12');
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, width, height);
    // Layered stage-camera shapes, modular LED seam highlights and an
    // unmistakable named artist, without external artwork or image rights.
    ctx.lineWidth = 7 * unit;
    ctx.strokeStyle = p.accent;
    for (let ring = 0; ring < 5; ring++) {
      const inset = (52 + ring * 54) * unit;
      ctx.globalAlpha = .4 / (ring + 1);
      ctx.strokeRect(inset, inset * .65, width - inset * 2, height - inset * 1.3);
    }
    ctx.globalAlpha = .62;
    ctx.fillStyle = p.accent;
    for (let i = 0; i < 48; i++) {
      const x = (i + .5) * width / 48;
      const shape = (Math.sin(i * .73 + p.seed * .013) * .5 + .5) ** 2;
      const barHeight = (38 + shape * 165) * unit;
      ctx.fillRect(x, height * .84 - barHeight, width / 70, barHeight);
    }
    ctx.globalAlpha = .14;
    ctx.fillStyle = '#e7f5ff';
    for (let x = 0; x < width; x += 24 * unit)
      ctx.fillRect(x, 0, unit, height);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = p.accent;
    ctx.shadowBlur = 29 * unit;
    ctx.fillStyle = '#eaf5ff';
    ctx.font = `800 ${42 * unit}px sans-serif`;
    ctx.fillText('ROCKMUNDO LIVE', width / 2, height * .18, width * .84);
    const name = bandName.trim().slice(0, 64) || 'ROCKMUNDO';
    const textSize = (name.length > 28 ? 83 : name.length > 17 ? 110 : 148) * unit;
    ctx.font = `900 ${textSize}px sans-serif`;
    ctx.fillText(name.toUpperCase(), width / 2, height * .44, width * .87);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = .88;
    ctx.font = `700 ${33 * unit}px sans-serif`;
    ctx.fillStyle = '#b4d5e5';
    ctx.fillText(p.label.toUpperCase(), width / 2, height * .62, width * .8);
    const result = new T.CanvasTexture(canvas);
    result.generateMipmaps = true;
    result.minFilter = T.LinearMipmapLinearFilter;
    result.magFilter = T.LinearFilter;
    return result;
  })();
  texture.name = 'venue-shared-show-led-' + p.kind;
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.userData.venueShowGraphics = { venueKind: p.kind, bandName: bandName.trim().slice(0, 64) || 'ROCKMUNDO', width, height };
  texture.needsUpdate = true;
  return texture;
}

export function addVideoScreen(
  parent: T.Object3D, name: string, width: number, height: number, pos: readonly [number, number, number],
  frame: T.Material, trim: T.Material, accent: string, showTexture?: T.Texture,
) {
  const root = new T.Group();
  root.name = name;
  root.position.set(...pos);
  parent.add(root);
  box(root, [width + .24, height + .24, .32], [0, 0, 0], frame);
  // One image backs both diffuse and emissive channels so every IMAG panel
  // shares its pixel alignment and does not allocate a duplicate GPU texture.
  const ledMap = showTexture ?? ledTexture();
  const pixels = new T.MeshStandardMaterial({
    color: '#ffffff', map: ledMap, emissive: showTexture ? '#ffffff' : accent, emissiveMap: ledMap,
    emissiveIntensity: showTexture ? .83 : 1.1, roughness: .38, metalness: .12,
  });
  const face = box(root, [width, height, .045], [0, 0, .185], pixels);
  face.name = name + '-display';
  // Individual LED modules are delineated without hundreds of separate screen meshes.
  const cols = Math.max(2, Math.ceil(width / 1.4)), rows = Math.max(2, Math.ceil(height / 1.2));
  for (let i = 1; i < cols; i++)
    box(root, [.012, height, .02], [-width / 2 + i * width / cols, 0, .216], trim);
  for (let i = 1; i < rows; i++)
    box(root, [width, .012, .02], [0, -height / 2 + i * height / rows, .216], trim);
  for (const side of [-1, 1])
    box(root, [.05, height + .32, .4], [side * (width / 2 + .14), 0, 0], trim);
  root.userData.displaySize = [width, height];
  return root;
}

export function addMovingHead(
  parent: T.Object3D, name: string, pos: [number, number, number], scale: number,
  shell: T.Material, steel: T.Material, lens: T.Material,
) {
  const root = new T.Group();
  root.name = name;
  root.position.set(...pos);
  parent.add(root);
  box(root, [.28 * scale, .12 * scale, .25 * scale], [0, .14 * scale, 0], shell);
  for (const side of [-1, 1])
    rod(root, [side * .12 * scale, .14 * scale, 0], [side * .12 * scale, -.11 * scale, 0], .018 * scale, steel);
  const head = cylinder(root, .125 * scale, .15 * scale, .29 * scale, [0, -.08 * scale, 0], shell, 16);
  head.rotation.x = .28;
  cylinder(root, .09 * scale, .09 * scale, .025 * scale, [0, -.245 * scale, .05 * scale], lens, 16);
  const bezel = new T.Mesh(new T.TorusGeometry(.095 * scale, .018 * scale, 5, 16), steel);
  bezel.position.set(0, -.258 * scale, .056 * scale);
  bezel.rotation.x = Math.PI / 2;
  root.add(bezel);
  return root;
}