import * as T from 'three';
import { box, cylinder, rod, matte, metal } from './stage';
import type { VenueProfile } from './venueProfile';
import { resolveTotpPresenter } from '@/features/top-of-the-pops/presenters';
import { resolveTotpStudioStageGeometry } from './totpStudioGeometry';

const presenterSceneName = (key: string) => `totp-presenter-${key.replaceAll('_', '-')}`;

function monitorTexture(primary: string, secondary: string, mode: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 576;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 1024, 576);
  gradient.addColorStop(0, mode === 'chart' ? '#8d174a' : '#101a2d');
  gradient.addColorStop(1, mode === 'audience' ? '#55204e' : '#07111e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 576);
  ctx.strokeStyle = '#41d9ff';
  ctx.lineWidth = 10;
  ctx.strokeRect(18, 18, 988, 540);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 42px sans-serif';
  ctx.fillText('TOP OF THE POPS', 512, 118, 900);
  ctx.fillStyle = '#83e9ff';
  ctx.font = '800 26px sans-serif';
  ctx.fillText(mode.toUpperCase(), 512, 178, 850);
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${primary.length > 24 ? 42 : 56}px sans-serif`;
  ctx.fillText(primary.toUpperCase(), 512, 302, 900);
  ctx.fillStyle = 'rgba(255,255,255,.78)';
  ctx.font = `700 ${secondary.length > 34 ? 26 : 31}px sans-serif`;
  ctx.fillText(secondary, 512, 390, 900);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

export function updateTvStudioMonitors(root: T.Object3D, primary: string, secondary: string, mode: string) {
  root.traverse((object) => {
    if (!(object instanceof T.Mesh) || object.name !== 'totp-studio-monitor-screen') return;
    const material = object.material;
    if (!(material instanceof T.MeshStandardMaterial)) return;
    const texture = monitorTexture(primary || 'TOP OF THE POPS', secondary || 'LIVE FROM LONDON', mode || 'performance');
    material.map?.dispose();
    material.emissiveMap?.dispose();
    material.map = texture;
    material.emissiveMap = texture;
    material.emissive.set('#ffffff');
    material.emissiveIntensity = .62;
    material.color.set('#ffffff');
    material.needsUpdate = true;
  });
}

function namedMat(name: string, color: string) {
  const material = matte(color);
  material.name = name;
  return material;
}

type StudioTexturePattern = 'grid' | 'brushed' | 'rubber' | 'perforated';

function studioTexture(base: string, accent: string, pattern: StudioTexturePattern, repeatX: number, repeatY: number) {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  const rgb = (hex: string) => {
    const value = Number.parseInt(hex.replace('#', ''), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
  };
  const primary = rgb(base);
  const detail = rgb(accent);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let mix = 0;
      if (pattern === 'grid') mix = x % 16 < 2 || y % 16 < 2 ? .58 : ((x * 11 + y * 17) % 19 === 0 ? .16 : 0);
      if (pattern === 'brushed') mix = y % 5 === 0 ? .22 : ((x + y * 7) % 23 === 0 ? .12 : 0);
      if (pattern === 'rubber') mix = (x + y) % 18 < 2 ? .2 : ((x * 5 + y * 13) % 29 === 0 ? .12 : 0);
      if (pattern === 'perforated') {
        const dx = x % 8 - 4;
        const dy = y % 8 - 4;
        mix = dx * dx + dy * dy < 4 ? .72 : .05;
      }
      const offset = (y * size + x) * 4;
      data[offset] = Math.round(primary[0] + (detail[0] - primary[0]) * mix);
      data[offset + 1] = Math.round(primary[1] + (detail[1] - primary[1]) * mix);
      data[offset + 2] = Math.round(primary[2] + (detail[2] - primary[2]) * mix);
      data[offset + 3] = 255;
    }
  }

  const texture = new T.DataTexture(data, size, size, T.RGBAFormat);
  texture.name = `totp-${pattern}-surface-texture`;
  texture.wrapS = T.RepeatWrapping;
  texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function texturedMaterial(
  name: string,
  base: string,
  accent: string,
  pattern: StudioTexturePattern,
  repeatX: number,
  repeatY: number,
  metalness = 0,
  roughness = .72,
) {
  const material = new T.MeshStandardMaterial({
    color: '#ffffff',
    map: studioTexture(base, accent, pattern, repeatX, repeatY),
    metalness,
    roughness,
  });
  material.name = name;
  return material;
}

function buildCameraBody(root: T.Group, x: number, z: number, yaw = 0, handheld = false) {
  const dark = matte('#151a20');
  const steel = metal('#5f6b76');
  const glass = new T.MeshStandardMaterial({ color: '#263645', metalness: .3, roughness: .2 });
  const lensBlack = new T.MeshStandardMaterial({ color: '#05070a', metalness: .45, roughness: .18 });
  const tally = new T.MeshStandardMaterial({ color: '#8f1021', emissive: '#ff2a42', emissiveIntensity: 2.1, roughness: .28 });
  const camera = new T.Group();
  camera.position.set(x, 0, z);
  camera.rotation.y = yaw;
  camera.name = handheld ? 'totp-handheld-camera' : 'totp-pedestal-camera';

  if (!handheld) {
    cylinder(camera, .18, .24, .15, [0, .075, 0], steel, 16);
    rod(camera, [0, .15, 0], [0, 1.35, 0], .055, steel);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      cylinder(camera, .055, .055, .08, [Math.cos(a) * .24, .04, Math.sin(a) * .24], dark, 10);
    }
  }

  const bodyY = handheld ? 1.55 : 1.45;
  const head = new T.Group();
  head.name = handheld ? 'totp-handheld-camera-head' : 'totp-pedestal-camera-head';
  box(head, [.58, .38, .66], [0, bodyY, 0], dark);
  cylinder(head, .12, .16, .38, [0, bodyY, -.48], glass, 18).rotation.x = Math.PI / 2;
  cylinder(head, .145, .145, .055, [0, bodyY, -.69], lensBlack, 20).rotation.x = Math.PI / 2;
  cylinder(head, .105, .105, .035, [0, bodyY, -.735], glass, 20).rotation.x = Math.PI / 2;
  box(head, [.34, .22, .05], [.34, bodyY + .08, .05], glass);
  box(head, [.22, .12, .18], [-.35, bodyY + .1, .04], dark).name = 'totp-camera-viewfinder';
  box(head, [.16, .045, .09], [0, bodyY + .245, -.18], tally).name = 'totp-camera-tally';
  rod(head, [-.22, bodyY + .26, .08], [.22, bodyY + .26, .08], .026, steel).name = 'totp-camera-top-handle';
  box(head, [.12, .08, .04], [-.2, bodyY - .19, .22], steel).name = 'totp-camera-connector-panel';
  camera.add(head);
  root.add(camera);
  return camera;
}

function buildOperator(root: T.Group, x: number, z: number, yaw = 0, name = 'totp-camera-operator') {
  const skin = matte('#b98968');
  const blackTop = matte('#111318');
  const blackTrousers = matte('#0b0d10');
  const blackShoes = matte('#08090b');
  const hair = matte('#2a211c');
  const operator = new T.Group();
  operator.name = name;
  operator.userData.crew = true;
  operator.userData.department = 'camera';
  operator.position.set(x, 0, z);
  operator.rotation.y = yaw;

  // Use the same human proportions as the low-poly audience rather than a
  // cylinder-shaped prop. Clothing is intentionally all black for TV crew.
  cylinder(operator, .20, .15, .52, [0, 1.12, 0], blackTop, 8);
  for (const side of [-1, 1]) {
    const sx = side * .105;
    rod(operator, [sx, .88, 0], [side * .12, .46, .02], .075, blackTrousers);
    rod(operator, [side * .12, .46, .02], [side * .12, .08, .08], .062, blackTrousers);
    box(operator, [.16, .09, .24], [side * .12, .055, .14], blackShoes);
    rod(operator, [side * .16, 1.26, 0], [side * .31, 1.03, -.12], .055, blackTop);
    rod(operator, [side * .31, 1.03, -.12], [side * .36, .87, -.24], .043, skin);
  }
  const head = new T.Mesh(new T.SphereGeometry(.15, 10, 8), skin);
  head.scale.set(.86, 1.08, .9);
  head.position.set(0, 1.58, 0);
  head.name = 'totp-camera-operator-head';
  operator.add(head);
  const hairCap = new T.Mesh(new T.SphereGeometry(.154, 10, 5, 0, Math.PI * 2, 0, Math.PI * .52), hair);
  hairCap.position.set(0, 1.66, -.01);
  operator.add(hairCap);

  box(operator, [.34, .055, .23], [0, .86, .015], blackTop).name = 'totp-camera-crew-utility-belt';
  box(operator, [.105, .17, .07], [.18, .91, .11], blackTop).name = 'totp-camera-crew-radio';
  box(operator, [.038, .13, .055], [-.145, 1.59, 0], blackTop).name = 'totp-camera-crew-headset-left';
  box(operator, [.038, .13, .055], [.145, 1.59, 0], blackTop).name = 'totp-camera-crew-headset-right';
  const headband = new T.Mesh(new T.TorusGeometry(.15, .013, 6, 18, Math.PI), blackTop);
  headband.position.set(0, 1.59, 0);
  headband.name = 'totp-camera-crew-headset-band';
  operator.add(headband);
  rod(operator, [.145, 1.57, -.01], [.18, 1.49, -.12], .012, blackTop).name = 'totp-camera-crew-headset-mic';

  root.add(operator);
  return operator;
}

function buildPresenter(root: T.Group, x: number, z: number, presenterKey?: string | null) {
  const profile = resolveTotpPresenter(presenterKey);
  const suit = namedMat('totp-presenter-suit', profile.visual.suit);
  const shirt = namedMat('totp-presenter-shirt', profile.visual.shirt);
  const skin = namedMat('totp-presenter-skin', profile.visual.skin);
  const hair = namedMat('totp-presenter-hair', profile.visual.hair);
  const accent = namedMat('totp-presenter-accent', profile.visual.accent);
  const presenter = new T.Group();
  presenter.name = presenterSceneName(profile.key);
  presenter.userData.presenterKey = profile.key;
  presenter.userData.presenterDisplayName = profile.displayName;
  presenter.position.set(x, 0, z);
  presenter.rotation.y = Math.PI * .08;

  cylinder(presenter, .22, .28, 1.05, [0, .85, 0], suit, 18);
  box(presenter, [.22, .55, .08], [0, 1.0, -.235], shirt);
  box(presenter, [.055, .35, .04], [0, .98, -.29], accent);
  cylinder(presenter, .19, .19, .34, [0, 1.58, 0], skin, 18);
  const hairCap = new T.Mesh(new T.SphereGeometry(.195, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair);
  hairCap.position.set(0, 1.74, 0);
  presenter.add(hairCap);
  const leftArm = rod(presenter, [-.18, 1.15, 0], [-.42, .96, -.08], .06, suit);
  leftArm.name = 'totp-presenter-left-arm';
  const rightArm = rod(presenter, [.18, 1.15, 0], [.38, 1.02, -.2], .06, suit);
  rightArm.name = 'totp-presenter-right-arm';
  const mic = cylinder(presenter, .035, .045, .28, [.42, 1.08, -.24], matte('#111318'), 10);
  mic.rotation.x = Math.PI / 2;
  mic.name = 'totp-presenter-microphone';
  root.add(presenter);
  return presenter;
}

export function applyTvStudioPresenterProfile(root: T.Object3D, presenterKey?: string | null) {
  const profile = resolveTotpPresenter(presenterKey);
  const presenter = root.getObjectByName('totp-presenter-alex-rayne')
    ?? root.children.find(child => child.userData.presenterKey && child.name.startsWith('totp-presenter-'))
    ?? null;
  if (!presenter) return;

  presenter.name = presenterSceneName(profile.key);
  presenter.userData.presenterKey = profile.key;
  presenter.userData.presenterDisplayName = profile.displayName;

  const palette: Record<string, string> = {
    'totp-presenter-suit': profile.visual.suit,
    'totp-presenter-shirt': profile.visual.shirt,
    'totp-presenter-skin': profile.visual.skin,
    'totp-presenter-hair': profile.visual.hair,
    'totp-presenter-accent': profile.visual.accent,
  };
  presenter.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach(material => {
      const next = palette[material.name];
      if (next && material instanceof T.MeshStandardMaterial) {
        material.color.set(next);
        if (material.emissive) material.emissive.set('#000000');
      }
    });
  });
}

function tvSetVariant(p: VenueProfile): 0 | 1 | 2 {
  const key = `${p.showVariant ?? 'regular'}:${p.presenterKey ?? 'alex_rayne'}:${p.seed}`;
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  return (hash % 3) as 0 | 1 | 2;
}

function buildStudioSetVariant(root: T.Group, p: VenueProfile) {
  const group = new T.Group();
  const variant = tvSetVariant(p);
  group.name = `totp-set-variant-${variant}`;
  group.userData.variant = variant;

  const cyan = new T.MeshStandardMaterial({ color: '#173b4c', emissive: '#27c9ff', emissiveIntensity: 1.55, roughness: .46 });
  const magenta = new T.MeshStandardMaterial({ color: '#441633', emissive: '#ff4fbd', emissiveIntensity: 1.5, roughness: .5 });
  const amber = new T.MeshStandardMaterial({ color: '#4a3315', emissive: '#ffbf4f', emissiveIntensity: 1.35, roughness: .52 });
  const back = .65 - p.stageDepth;

  if (variant === 0) {
    for (let index = 0; index < 4; index += 1) {
      const width = 8.2 - index * .8;
      const height = 4.6 - index * .42;
      const z = back + .78 + index * .13;
      const material = index % 2 ? magenta : cyan;
      rod(group, [-width / 2, p.stageHeight + .12, z], [-width / 2, p.stageHeight + height, z], .045, material);
      rod(group, [width / 2, p.stageHeight + .12, z], [width / 2, p.stageHeight + height, z], .045, material);
      rod(group, [-width / 2, p.stageHeight + height, z], [width / 2, p.stageHeight + height, z], .045, material);
    }
  } else if (variant === 1) {
    for (const side of [-1, 1]) {
      for (let index = 0; index < 4; index += 1) {
        const panel = box(
          group,
          [.82 + index * .12, .66 + index * .16, .08],
          [side * (3.4 + index * .18), p.stageHeight + 1.0 + index * .78, back + .82 + (index % 2) * .16],
          index % 2 ? amber : magenta,
        );
        panel.rotation.z = side * (index % 2 ? .12 : -.08);
      }
    }
  } else {
    for (let index = 0; index < 13; index += 1) {
      const x = (index - 6) * .62;
      const height = 1.3 + ((index * 7) % 5) * .56;
      box(group, [.055, height, .06], [x, p.stageHeight + .7 + height / 2, back + .84], index % 3 === 0 ? amber : index % 2 ? magenta : cyan);
    }
    for (const side of [-1, 1]) {
      const ring = new T.Mesh(new T.TorusGeometry(1.05, .06, 10, 40, Math.PI * 1.5), side < 0 ? cyan : magenta);
      ring.position.set(side * 3.55, p.stageHeight + 2.2, back + .72);
      ring.rotation.z = side < 0 ? .35 : Math.PI - .35;
      group.add(ring);
    }
  }

  root.add(group);
}

function buildPerformanceZones(root: T.Group, p: VenueProfile) {
  const dark = texturedMaterial('totp-main-stage-deck-material', '#10151c', '#2c3540', 'rubber', 8, 5, .08, .68);
  const black = texturedMaterial('totp-rock-stage-deck-material', '#080a0e', '#242a31', 'rubber', 7, 5, .12, .7);
  const steel = metal('#46505b');
  const magenta = texturedMaterial('totp-magenta-led-wall-material', '#76123d', '#c02972', 'grid', 9, 4, .05, .48);
  magenta.emissive.set('#4d0826');
  magenta.emissiveIntensity = .65;
  const blue = texturedMaterial('totp-blue-led-wall-material', '#1b3559', '#376b9f', 'grid', 7, 4, .05, .5);
  blue.emissive.set('#112a4b');
  blue.emissiveIntensity = .58;
  const amber = texturedMaterial('totp-amber-led-wall-material', '#6a351b', '#bd7041', 'grid', 7, 4, .04, .54);
  amber.emissive.set('#40200f');
  amber.emissiveIntensity = .5;
  const main = resolveTotpStudioStageGeometry('main_stage', p);
  const stageBGeometry = resolveTotpStudioStageGeometry('stage_b', p);
  const rockGeometry = resolveTotpStudioStageGeometry('rock_stage', p);
  const floorGeometry = resolveTotpStudioStageGeometry('studio_floor', p);

  const mainDeck = box(root, [main.deckWidth, .12, main.deckDepth], [main.centerX, p.stageHeight - .06, main.centerZ], dark);
  mainDeck.name = 'totp-zone-main-stage';
  box(root, [main.deckWidth, .12, .08], [main.centerX, p.stageHeight - .01, main.centerZ + main.deckDepth / 2 - .035], steel).name = 'totp-main-stage-front-trim';
  box(root, [p.stageWidth * .82, 2.4, .12], [0, p.stageHeight + 2.0, .65 - p.stageDepth - .32], magenta).name = 'totp-main-stage-backdrop';
  for (const x of [-p.stageWidth * .38, 0, p.stageWidth * .38]) rod(root, [x, p.stageHeight, .5 - p.stageDepth], [x, p.rigHeight - .7, .5 - p.stageDepth], .04, steel);

  const stageBRear = stageBGeometry.centerZ - stageBGeometry.deckDepth / 2;
  const stageB = box(root, [stageBGeometry.deckWidth, .22, stageBGeometry.deckDepth], [stageBGeometry.centerX, .11, stageBGeometry.centerZ], blue);
  stageB.name = 'totp-zone-stage-b';
  box(root, [stageBGeometry.deckWidth, .09, .07], [stageBGeometry.centerX, .22, stageBGeometry.centerZ + stageBGeometry.deckDepth / 2 - .03], steel).name = 'totp-stage-b-front-trim';
  box(root, [4.4, 1.7, .12], [stageBGeometry.centerX, 1.45, stageBRear + .08], blue).name = 'totp-stage-b-backdrop';
  for (const x of [stageBGeometry.centerX - 1.85, stageBGeometry.centerX - .95, stageBGeometry.centerX - .05, stageBGeometry.centerX + .85, stageBGeometry.centerX + 1.75]) {
    const strip = box(root, [.055, 2.25, .07], [x, 1.65, stageBRear + .18], Math.abs(x - stageBGeometry.centerX) < .1 ? magenta : blue);
    strip.name = 'totp-stage-b-light-strip';
  }
  const stageBRing = new T.Mesh(new T.TorusGeometry(1.45, .055, 10, 48), magenta);
  stageBRing.position.set(stageBGeometry.centerX, 1.75, stageBRear);
  stageBRing.name = 'totp-stage-b-ring';
  root.add(stageBRing);

  const rockRear = rockGeometry.centerZ - rockGeometry.deckDepth / 2;
  const rock = box(root, [rockGeometry.deckWidth, .28, rockGeometry.deckDepth], [rockGeometry.centerX, .14, rockGeometry.centerZ], black);
  rock.name = 'totp-zone-rock-stage';
  box(root, [rockGeometry.deckWidth, .1, .075], [rockGeometry.centerX, .27, rockGeometry.centerZ + rockGeometry.deckDepth / 2 - .035], steel).name = 'totp-rock-stage-front-trim';
  for (const x of [rockGeometry.centerX - 1.9, rockGeometry.centerX, rockGeometry.centerX + 1.9]) rod(root, [x, .28, rockRear + .5], [x, 4.5, rockRear + .5], .055, steel);
  box(root, [5.8, 1.5, .14], [rockGeometry.centerX, 2.0, rockRear + .02], amber).name = 'totp-rock-stage-backdrop';
  for (const side of [-1, 1]) {
    const towerX = rockGeometry.centerX + side * 2.25;
    for (let level = 0; level < 3; level += 1) {
      const amp = box(root, [.85, .62, .42], [towerX, .62 + level * .67, rockRear + .85], black);
      amp.name = 'totp-rock-amp-stack';
      box(amp, [.74, .5, .025], [0, 0, .225], steel);
    }
  }
  for (let index = 0; index < 7; index += 1) {
    const bar = box(root, [.055, 2.0 + (index % 3) * .35, .06], [rockGeometry.centerX - 1.5 + index * .5, 2.15, rockRear + .12], amber);
    bar.rotation.z = (index - 3) * .035;
  }

  const floorRadius = floorGeometry.deckWidth / 2;
  const floorDisc = cylinder(root, floorRadius - .2, floorRadius, .08, [floorGeometry.centerX, .04, floorGeometry.centerZ], magenta, 40);
  floorDisc.name = 'totp-zone-studio-floor';
  const floorRingOuter = new T.Mesh(new T.TorusGeometry(2.65, .045, 10, 56), blue);
  floorRingOuter.rotation.x = Math.PI / 2;
  floorRingOuter.position.set(floorGeometry.centerX, .1, floorGeometry.centerZ);
  floorRingOuter.name = 'totp-studio-floor-ring-outer';
  root.add(floorRingOuter);
  const floorRingInner = new T.Mesh(new T.TorusGeometry(1.75, .035, 10, 48), amber);
  floorRingInner.rotation.x = Math.PI / 2;
  floorRingInner.position.set(floorGeometry.centerX, .105, floorGeometry.centerZ);
  floorRingInner.name = 'totp-studio-floor-ring-inner';
  root.add(floorRingInner);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    cylinder(root, .045, .045, .06, [floorGeometry.centerX + Math.cos(a) * 2.65, .11, floorGeometry.centerZ + Math.sin(a) * 2.65], blue, 10);
  }
}

function buildChristmasSpecialDecor(root: T.Group, p: VenueProfile) {
  const group = new T.Group();
  group.name = 'totp-special-christmas';
  group.userData.showVariant = 'christmas';
  const green = namedMat('totp-christmas-foliage', '#164b31');
  const trunk = matte('#5b3420');
  const red = new T.MeshStandardMaterial({ color: '#9c1f30', emissive: '#3a0710', emissiveIntensity: .35, roughness: .45 });
  const gold = new T.MeshStandardMaterial({ color: '#c9a74b', emissive: '#604910', emissiveIntensity: .5, roughness: .3, metalness: .45 });
  const warm = new T.MeshStandardMaterial({ color: '#fff1b8', emissive: '#ffd86b', emissiveIntensity: 1.25, roughness: .2 });

  const treeX = p.stageWidth * .58;
  const treeZ = .35 - p.stageDepth;
  cylinder(group, .16, .2, 1.0, [treeX, .5, treeZ], trunk, 12);
  [
    { y: 1.2, radius: 1.15, height: 1.7 },
    { y: 2.05, radius: .9, height: 1.55 },
    { y: 2.8, radius: .62, height: 1.35 },
  ].forEach(({ y, radius, height }) => {
    const foliage = new T.Mesh(new T.ConeGeometry(radius, height, 18), green);
    foliage.position.set(treeX, y, treeZ);
    group.add(foliage);
  });
  const topper = new T.Mesh(new T.OctahedronGeometry(.2), gold);
  topper.position.set(treeX, 3.55, treeZ);
  topper.rotation.z = Math.PI / 4;
  topper.name = 'totp-christmas-tree-topper';
  group.add(topper);

  for (let index = 0; index < 10; index += 1) {
    const angle = index / 10 * Math.PI * 2;
    const ornament = new T.Mesh(new T.SphereGeometry(.075, 10, 8), index % 2 === 0 ? red : gold);
    const y = 1.05 + (index % 5) * .48;
    const radius = Math.max(.42, 1.0 - (y - 1.05) * .2);
    ornament.position.set(treeX + Math.cos(angle) * radius, y, treeZ + Math.sin(angle) * radius);
    group.add(ornament);
  }

  box(group, [.7, .45, .6], [treeX - .48, .23, treeZ + .65], red).name = 'totp-christmas-present-red';
  box(group, [.58, .36, .52], [treeX + .42, .18, treeZ + .68], gold).name = 'totp-christmas-present-gold';

  for (let index = 0; index < 12; index += 1) {
    const light = new T.Mesh(new T.SphereGeometry(.055, 8, 6), index % 3 === 0 ? red : warm);
    light.position.set(-p.stageWidth * .39 + index * (p.stageWidth * .78 / 11), p.stageHeight + 3.0 + Math.sin(index * .9) * .16, .5 - p.stageDepth - .2);
    group.add(light);
  }

  root.add(group);
}

function buildAnniversarySpecialDecor(root: T.Group, p: VenueProfile) {
  const group = new T.Group();
  group.name = 'totp-special-anniversary';
  group.userData.showVariant = 'anniversary';
  const gold = new T.MeshStandardMaterial({ color: '#c6a34b', emissive: '#4f3b0d', emissiveIntensity: .55, roughness: .25, metalness: .6 });
  const paleGold = new T.MeshStandardMaterial({ color: '#f0d98b', emissive: '#7a5f18', emissiveIntensity: .45, roughness: .3, metalness: .35 });
  const dark = matte('#171410');

  const backdropZ = .46 - p.stageDepth;
  box(group, [p.stageWidth * .7, .09, .08], [0, p.stageHeight + 3.05, backdropZ], gold).name = 'totp-anniversary-header';
  for (const x of [-p.stageWidth * .35, p.stageWidth * .35]) {
    box(group, [.12, 3.1, .1], [x, p.stageHeight + 1.75, backdropZ], gold);
  }

  for (let index = 0; index < 9; index += 1) {
    const angle = index / 9 * Math.PI * 2;
    const medallion = new T.Mesh(new T.CylinderGeometry(.11, .11, .035, 18), index % 2 === 0 ? gold : paleGold);
    medallion.rotation.x = Math.PI / 2;
    medallion.position.set(Math.cos(angle) * (p.stageWidth * .27), p.stageHeight + 2.05 + Math.sin(angle) * .75, backdropZ + .08);
    group.add(medallion);
  }

  const podium = cylinder(group, .5, .62, .72, [-p.stageWidth * .58, .36, -.28], dark, 24);
  podium.name = 'totp-anniversary-podium';
  const emblem = new T.Mesh(new T.TorusGeometry(.28, .055, 10, 24), gold);
  emblem.rotation.x = Math.PI / 2;
  emblem.position.set(-p.stageWidth * .58, .76, -.28);
  emblem.name = 'totp-anniversary-emblem';
  group.add(emblem);

  root.add(group);
}


function buildSoftbox(root: T.Group, x: number, y: number, z: number, name: string) {
  const group = new T.Group();
  group.name = name;
  group.position.set(x, y, z);
  const frame = metal('#333b45');
  const diffuser = new T.MeshStandardMaterial({ color: '#fff7df', emissive: '#fff1bc', emissiveIntensity: 1.75, roughness: .24 });
  box(group, [1.5, .09, .92], [0, 0, 0], frame);
  box(group, [1.28, .025, .72], [0, -.058, 0], diffuser).name = 'totp-softbox-diffuser';
  rod(group, [0, .05, 0], [0, .35, 0], .022, frame);
  root.add(group);
}

function buildRoadCase(root: T.Group, x: number, z: number, width: number, name: string) {
  const group = new T.Group();
  group.name = name;
  group.position.set(x, 0, z);
  const shell = texturedMaterial(`${name}-material`, '#181d23', '#3b444f', 'grid', 4, 3, .35, .55);
  const edge = metal('#717b84');
  box(group, [width, .72, .62], [0, .38, 0], shell);
  box(group, [width + .035, .035, .65], [0, .73, 0], edge);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(group, [.055, .76, .055], [sx * width * .48, .38, sz * .29], edge);
  }
  for (const sx of [-1, 1]) cylinder(group, .055, .055, .045, [sx * width * .32, .035, .22], edge, 10).rotation.z = Math.PI / 2;
  root.add(group);
}

function buildStudioInfrastructure(root: T.Group, p: VenueProfile) {
  const group = new T.Group();
  group.name = 'totp-studio-infrastructure';
  const truss = metal('#56616b');
  const cable = matte('#090b0e');
  const tape = new T.MeshStandardMaterial({ color: '#d2b24c', emissive: '#4a3a09', emissiveIntensity: .18, roughness: .7 });
  const productionFloor = texturedMaterial('totp-production-floor-material', '#20252b', '#313942', 'rubber', 12, 8, .04, .78);

  const floor = box(group, [p.roomWidth * .84, .025, 11.6], [0, .012, 4.25], productionFloor);
  floor.name = 'totp-studio-floor-texture';

  const gridY = p.rigHeight - .28;
  for (const x of [-8.6, -2.9, 2.9, 8.6]) rod(group, [x, gridY, -5.2], [x, gridY, 9.1], .052, truss);
  for (const z of [-4.7, -.6, 3.5, 7.8]) rod(group, [-9.5, gridY, z], [9.5, gridY, z], .052, truss);
  group.children[group.children.length - 1].name = 'totp-studio-lighting-grid';

  buildSoftbox(group, -5.4, gridY - .18, -1.1, 'totp-softbox-key-left');
  buildSoftbox(group, 5.3, gridY - .2, -.4, 'totp-softbox-key-right');
  buildSoftbox(group, -2.2, gridY - .15, 5.8, 'totp-softbox-floor-left');
  buildSoftbox(group, 4.5, gridY - .16, 5.2, 'totp-softbox-floor-right');

  for (const x of [-5.8, 0, 5.8]) {
    const lamp = new T.Group();
    lamp.position.set(x, gridY - .55, 2.2 + Math.abs(x) * .12);
    lamp.name = 'totp-fresnel-lamp';
    cylinder(lamp, .19, .26, .4, [0, 0, 0], truss, 16).rotation.x = Math.PI / 2;
    cylinder(lamp, .14, .18, .05, [0, 0, -.23], new T.MeshStandardMaterial({ color: '#fff0c6', emissive: '#ffc75b', emissiveIntensity: 1.45, roughness: .22 }), 16).rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) box(lamp, [.18, .28, .025], [side * .19, 0, -.25], truss).rotation.y = side * .3;
    group.add(lamp);
  }

  for (const z of [2.0, 4.9, 7.5]) {
    const channel = box(group, [p.roomWidth * .72, .035, .15], [0, .035, z], cable);
    channel.name = 'totp-floor-cable-ramp';
  }
  for (const x of [-6.3, -2.8, 2.8, 6.3]) {
    box(group, [.55, .018, .055], [x, .034, 1.35], tape).name = 'totp-camera-floor-mark';
    box(group, [.055, .018, .55], [x, .034, 1.35], tape).name = 'totp-camera-floor-mark';
  }

  const railsX = -8.55;
  for (const x of [railsX - .31, railsX + .31]) rod(group, [x, .07, 1.25], [x, .07, 4.55], .028, truss);
  for (let z = 1.35; z <= 4.45; z += .45) box(group, [.82, .045, .065], [railsX, .045, z], truss);
  box(group, [.92, .12, .72], [railsX, .13, 2.0], metal('#3e4852')).name = 'totp-dolly-track';

  buildRoadCase(group, -9.1, 6.6, 1.25, 'totp-road-case-left');
  buildRoadCase(group, 9.0, 6.2, 1.1, 'totp-road-case-right');
  buildRoadCase(group, -9.2, 8.0, .95, 'totp-road-case-lighting');

  const reel = new T.Group();
  reel.name = 'totp-cable-reel';
  reel.position.set(9.1, 7.5, 0);
  cylinder(reel, .31, .31, .18, [0, .34, 0], metal('#4a535d'), 20).rotation.z = Math.PI / 2;
  cylinder(reel, .18, .18, .24, [0, .34, 0], cable, 18).rotation.z = Math.PI / 2;
  rod(reel, [0, .12, 0], [0, .68, 0], .025, metal('#4a535d'));
  group.add(reel);

  const onAir = new T.MeshStandardMaterial({ color: '#7f101e', emissive: '#ff253e', emissiveIntensity: 1.85, roughness: .32 });
  box(group, [1.55, .42, .08], [-8.6, 4.55, -5.65], onAir).name = 'totp-on-air-lightbox';

  root.add(group);
}

function buildBoomRig(root: T.Group, x: number, z: number) {
  const boom = new T.Group();
  boom.name = 'totp-boom-rig';
  const pole = metal('#3f4852');
  rod(boom, [x, 1.45, z], [x + 3.8, 3.25, z - 1.9], .028, pole);
  const mic = cylinder(boom, .045, .055, .32, [x + 3.84, 3.27, z - 1.95], matte('#101317'), 12);
  mic.rotation.x = Math.PI / 2.45;
  mic.name = 'totp-boom-microphone';
  root.add(boom);
}

function buildAdditionalCameraDepartment(root: T.Group, p: VenueProfile) {
  const shoulderLeft = buildCameraBody(root, -.9, 1.65, -.08, true);
  shoulderLeft.name = 'totp-camera-shoulder-left';
  buildOperator(root, -1.16, 1.98, -.08, 'totp-operator-shoulder-left');

  const stageBCamera = buildCameraBody(root, 8.45, 4.25, .42, true);
  stageBCamera.name = 'totp-camera-stage-b';
  buildOperator(root, 8.78, 4.62, .42, 'totp-operator-stage-b');

  buildOperator(root, p.crowdWidth * .58 + .58, 7.72, -.48, 'totp-operator-jib');
  buildOperator(root, -9.72, 5.35, -.12, 'totp-camera-assistant-left');

  const floorManager = buildOperator(root, -9.85, 1.6, .4, 'totp-floor-manager');
  floorManager.userData.department = 'floor';
  box(floorManager, [.28, .36, .025], [.33, 1.03, -.18], matte('#d9d9d3')).name = 'totp-floor-manager-clipboard';

  const boomOperator = buildOperator(root, -8.55, -.15, .35, 'totp-boom-operator');
  boomOperator.userData.department = 'sound';
  buildBoomRig(root, -8.55, -.15);
}

function buildSpecialEditionDecor(root: T.Group, p: VenueProfile) {
  if (p.showVariant === 'christmas') buildChristmasSpecialDecor(root, p);
  if (p.showVariant === 'anniversary') buildAnniversarySpecialDecor(root, p);
}

export function buildTvStudioProduction(root: T.Group, p: VenueProfile) {
  if (p.kind !== 'tv_studio') return;

  const dark = matte('#11151c');
  const steel = metal('#4f5965');
  const accent = new T.MeshStandardMaterial({ color: '#b41945', emissive: '#7a0d2d', emissiveIntensity: .55, roughness: .55 });
  const floor = texturedMaterial('totp-presenter-rostrum-material', '#20262d', '#3b4550', 'brushed', 5, 4, .08, .65);

  buildStudioInfrastructure(root, p);
  buildPerformanceZones(root, p);
  buildStudioSetVariant(root, p);
  buildSpecialEditionDecor(root, p);

  const presenterX = -p.stageWidth * .66;
  const presenterZ = -.35;
  const rostrum = box(root, [2.7, .2, 2.0], [presenterX, .1, presenterZ], floor);
  rostrum.name = 'totp-presenter-rostrum';
  box(root, [2.5, 1.25, .12], [presenterX, .9, presenterZ - .95], accent).name = 'totp-presenter-backdrop';
  buildPresenter(root, presenterX, presenterZ - .12, p.presenterKey);

  const pedestalLeft = buildCameraBody(root, -p.crowdWidth * .58, 4.75, -.18);
  pedestalLeft.name = 'totp-camera-pedestal-left';
  buildOperator(root, -p.crowdWidth * .58 - .48, 5.12, -.18, 'totp-operator-left');

  const pedestalRight = buildCameraBody(root, p.crowdWidth * .42, 5.1, .18);
  pedestalRight.name = 'totp-camera-pedestal-right';
  buildOperator(root, p.crowdWidth * .42 + .45, 5.5, .18, 'totp-operator-right');

  const handheld = buildCameraBody(root, p.stageWidth * .24, 2.4, .05, true);
  handheld.name = 'totp-camera-handheld';
  buildOperator(root, p.stageWidth * .24 + .22, 2.7, .05, 'totp-operator-handheld');

  const jib = new T.Group();
  jib.name = 'totp-camera-jib';
  const baseX = p.crowdWidth * .58, baseZ = 7.4;
  cylinder(jib, .42, .55, .3, [baseX, .15, baseZ], steel, 18);
  rod(jib, [baseX, .3, baseZ], [baseX, 2.45, baseZ], .09, steel);
  const armStart = new T.Vector3(baseX, 2.35, baseZ);
  const armEnd = new T.Vector3(baseX - 5.2, 4.1, baseZ - 5.5);
  rod(jib, armStart.toArray(), armEnd.toArray(), .075, steel);
  const head = new T.Group();
  head.name = 'totp-camera-jib-head';
  head.position.copy(armEnd);
  box(head, [.48, .3, .56], [0, 0, 0], dark);
  cylinder(head, .11, .14, .32, [0, 0, -.39], matte('#203447'), 16).rotation.x = Math.PI / 2;
  jib.add(head);
  root.add(jib);

  buildAdditionalCameraDepartment(root, p);

  for (const x of [-p.stageWidth * .46, 0, p.stageWidth * .46]) {
    const tower = new T.Group();
    tower.name = 'totp-studio-monitor';
    tower.position.set(x, p.stageHeight + 2.4, .65 - p.stageDepth - .18);
    box(tower, [2.0, 1.15, .14], [0, 0, 0], dark);
    const screen = box(tower, [1.8, .95, .04], [0, 0, .09], accent);
    screen.name = 'totp-studio-monitor-screen';
    root.add(tower);
  }
}
