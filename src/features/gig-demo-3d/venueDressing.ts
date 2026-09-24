import * as T from 'three';
import { box, cylinder, matte, metal, rod } from './stage';
import { seededRandom } from './config';
import type { VenueProfile } from './venueProfile';
import type { VenueSurfaceMaterials } from './venueSurfaceMaterials';

const SMALL_VENUES = new Set([
  'cafe_stage',
  'jazz_lounge',
  'dive_bar',
  'rock_club',
  'live_house',
  'university_union',
]);

function feature(parent: T.Object3D, name: string) {
  const group = new T.Group();
  group.name = name;
  parent.add(group);
  return group;
}

function addPracticalLight(
  parent: T.Object3D,
  position: [number, number, number],
  color: string,
  intensity: number,
  distance: number,
  fixture: T.Material,
) {
  const [x, y, z] = position;
  rod(parent, [x, y + .18, z], [x, y + .48, z], .012, fixture);
  cylinder(parent, .11, .23, .22, [x, y, z], fixture, 14);
  const bulb = new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.35, roughness: .35 });
  cylinder(parent, .075, .075, .12, [x, y - .12, z], bulb, 12);
  const light = new T.PointLight(color, intensity, distance, 2);
  light.position.set(x, y - .22, z);
  light.castShadow = false;
  light.name = 'venue-practical-light';
  parent.add(light);
  return light;
}

function addFlightCase(parent: T.Object3D, x: number, z: number, scale = 1) {
  const shell = matte('#191d22');
  const edge = metal('#707985', .5);
  const w = 1.15 * scale, h = .72 * scale, d = .66 * scale;
  box(parent, [w, h, d], [x, h / 2, z], shell);
  for (const sy of [-1, 1]) box(parent, [w + .04, .035, d + .04], [x, h / 2 + sy * (h / 2 - .02), z], edge);
  for (const sx of [-1, 1]) {
    box(parent, [.035, h, d + .04], [x + sx * (w / 2 - .02), h / 2, z], edge);
    for (const sz of [-1, 1]) cylinder(parent, .055, .055, .04, [x + sx * w * .38, .045, z + sz * d * .34], edge, 10).rotation.z = Math.PI / 2;
  }
}

function addBottleShelf(parent: T.Object3D, x: number, y: number, z: number, alongZ: boolean, width = 3.8) {
  const wood = matte('#4a2c20', .72);
  const bottleA = matte('#4c6a4f', .46);
  const bottleB = matte('#6e493c', .46);
  const bottleC = matte('#85713f', .46);
  const span = width;
  const shelfSize = alongZ ? [.18, .08, span] : [span, .08, .18];
  box(parent, shelfSize, [x, y, z], wood);
  box(parent, shelfSize, [x, y + .72, z], wood);
  for (let i = 0; i < 11; i += 1) {
    const offset = -span * .43 + i * span * .086;
    const px = alongZ ? x : x + offset;
    const pz = alongZ ? z + offset : z;
    const mat = i % 3 === 0 ? bottleA : i % 3 === 1 ? bottleB : bottleC;
    cylinder(parent, .04, .055, .28 + (i % 2) * .08, [px, y + .2, pz], mat, 8);
    cylinder(parent, .022, .022, .09, [px, y + .39 + (i % 2) * .08, pz], mat, 8);
  }
}

function addStool(parent: T.Object3D, x: number, z: number, seat: T.Material) {
  const steel = metal('#555f68', .5);
  cylinder(parent, .23, .23, .09, [x, .68, z], seat, 14);
  rod(parent, [x, .05, z], [x, .63, z], .035, steel);
  for (let i = 0; i < 3; i += 1) {
    const a = i * Math.PI * 2 / 3;
    rod(parent, [x, .1, z], [x + Math.cos(a) * .22, .02, z + Math.sin(a) * .22], .018, steel);
  }
}

function addNoticeBoard(parent: T.Object3D, x: number, y: number, z: number, onSideWall: boolean, random: () => number) {
  const frame = matte('#4d3828', .7);
  const cork = matte('#9f7c57', .9);
  const board = box(parent, onSideWall ? [.045, 1.6, 2.4] : [2.4, 1.6, .045], [x, y, z], cork);
  if (onSideWall) board.rotation.y = 0;
  box(parent, onSideWall ? [.075, 1.76, 2.56] : [2.56, 1.76, .075], [x + (onSideWall ? -.018 : 0), y, z], frame);
  const paper = [matte('#d7c9a9'), matte('#b8c6d5'), matte('#b66c73'), matte('#d5b65f')];
  for (let i = 0; i < 10; i += 1) {
    const py = y - .55 + Math.floor(i / 5) * .62 + (random() - .5) * .08;
    const lateral = -.8 + (i % 5) * .4 + (random() - .5) * .07;
    const flyer = box(
      parent,
      onSideWall ? [.012, .42, .28] : [.28, .42, .012],
      onSideWall ? [x - .045, py, z + lateral] : [x + lateral, py, z - .045],
      paper[i % paper.length],
    );
    if (onSideWall) flyer.rotation.x = (random() - .5) * .08;
    else flyer.rotation.z = (random() - .5) * .08;
  }
}

function addExitDoor(parent: T.Object3D, x: number, z: number, side: -1 | 1, roofHeight: number) {
  const frame = metal('#58616a', .58);
  const door = matte('#1b2528', .82);
  const sign = new T.MeshStandardMaterial({ color: '#70d6a3', emissive: '#35d184', emissiveIntensity: 1.15, roughness: .42 });
  box(parent, [.12, 2.2, 1.25], [x, 1.1, z], door);
  box(parent, [.14, .09, 1.38], [x, 2.24, z], frame);
  box(parent, [.15, .28, .78], [x + side * .02, Math.min(2.65, roofHeight - .45), z], sign);
}

function addCableCoil(parent: T.Object3D, x: number, z: number, scale = 1) {
  const cable = matte('#101216', .82);
  for (let i = 0; i < 3; i += 1) {
    const torus = new T.Mesh(new T.TorusGeometry((.24 + i * .045) * scale, .018 * scale, 6, 24), cable);
    torus.rotation.x = Math.PI / 2;
    torus.position.set(x + i * .015, .035 + i * .018, z);
    parent.add(torus);
  }
}

function buildCafe(root: T.Group, p: VenueProfile, surfaces: VenueSurfaceMaterials) {
  const half = p.roomWidth / 2;
  const coffee = feature(root, 'venue-cafe-coffee-bar');
  box(coffee, [1.45, 1.02, 4.7], [-half + 1.35, .51, 8], matte('#4b3427', .66));
  box(coffee, [1.65, .11, 4.9], [-half + 1.35, 1.08, 8], surfaces.detail);
  addBottleShelf(coffee, -half + .28, 1.55, 8, true, 3.9);
  const espresso = metal('#626c73', .34);
  box(coffee, [.68, .5, .62], [-half + 1.32, 1.38, 7.15], espresso);
  for (const dz of [-.18, .18]) cylinder(coffee, .09, .09, .12, [-half + 1.32, 1.22, 7.15 + dz], matte('#171b20'), 12).rotation.z = Math.PI / 2;
  for (let i = 0; i < 5; i += 1) cylinder(coffee, .09, .075, .11, [-half + .58, 1.95, 6.6 + i * .55], matte('#d8cfbf'), 12);

  const windows = feature(root, 'venue-cafe-window-front');
  const glass = new T.MeshStandardMaterial({ color: '#536b74', emissive: '#1d2c32', emissiveIntensity: .18, metalness: .12, roughness: .18 });
  for (let i = 0; i < 3; i += 1) {
    const z = 4 + i * 4;
    box(windows, [.035, 2.4, 2.7], [half - .16, 2.05, z], glass);
    rod(windows, [half - .2, .85, z], [half - .2, 3.25, z], .018, metal('#5d6468', .6));
    rod(windows, [half - .2, 2.05, z - 1.3], [half - .2, 2.05, z + 1.3], .018, metal('#5d6468', .6));
  }

  const plants = feature(root, 'venue-cafe-plants');
  for (const z of [3.2, 11.7]) {
    cylinder(plants, .24, .3, .42, [half - .72, .21, z], matte('#6a4d38'), 12);
    rod(plants, [half - .72, .42, z], [half - .72, 1.22, z], .045, matte('#4c5b39'));
    const crown = new T.Mesh(new T.IcosahedronGeometry(.42, 1), matte('#486344'));
    crown.scale.set(.85, 1.25, .85);
    crown.position.set(half - .72, 1.28, z);
    plants.add(crown);
  }

  const lights = feature(root, 'venue-cafe-warm-practicals');
  for (const z of [4.8, 9.5, 14.2].filter(value => value < p.roomDepth - 1))
    addPracticalLight(lights, [0, Math.min(p.roofHeight - .65, 3.4), z], '#f0b979', 4.2, 5.2, matte('#3c3530'));
  root.userData.identityFeatures.push('coffee-bar', 'window-front', 'plants', 'warm-pendants');
}

function buildJazz(root: T.Group, p: VenueProfile, surfaces: VenueSurfaceMaterials) {
  const half = p.roomWidth / 2;
  const lounge = feature(root, 'venue-jazz-banquettes');
  for (const side of [-1, 1] as const) {
    const x = side * (half - .9);
    box(lounge, [.75, .5, Math.min(12, p.roomDepth - 4)], [x, .25, 8], surfaces.seat);
    box(lounge, [.28, 1.25, Math.min(12, p.roomDepth - 4)], [side * (half - .64), .9, 8], surfaces.seat);
  }

  const art = feature(root, 'venue-jazz-framed-art');
  const frame = metal('#9b7c48', .45);
  const artMats = [matte('#6d2839'), matte('#2d4c54'), matte('#604533')];
  for (const side of [-1, 1] as const) for (let i = 0; i < 3; i += 1) {
    const x = side * (half - .15), z = 4 + i * 4.2;
    box(art, [.06, 1.22, 1.55], [x, 2.3, z], frame);
    box(art, [.065, .95, 1.25], [x - side * .025, 2.3, z], artMats[(i + (side > 0 ? 1 : 0)) % artMats.length]);
  }

  const lights = feature(root, 'venue-jazz-brass-sconces');
  for (const side of [-1, 1] as const) for (const z of [4.3, 10.4]) {
    rod(lights, [side * (half - .18), 2.65, z], [side * (half - .72), 2.65, z], .025, metal('#9f8248', .38));
    addPracticalLight(lights, [side * (half - .82), 2.6, z], '#e6a067', 3.2, 4.2, metal('#a3844e', .38));
  }

  const service = feature(root, 'venue-jazz-cocktail-service');
  addBottleShelf(service, -half + .25, 1.55, 7.8, true, 4.6);
  for (const z of [6.2, 7.2, 8.2, 9.2]) addStool(service, -half + 1.75, z, surfaces.seat);
  root.userData.identityFeatures.push('banquettes', 'brass-sconces', 'framed-art', 'cocktail-service');
}

function buildDiveBar(root: T.Group, p: VenueProfile, surfaces: VenueSurfaceMaterials) {
  const half = p.roomWidth / 2;
  const backBar = feature(root, 'venue-dive-back-bar');
  addBottleShelf(backBar, -half + .25, 1.5, 7.8, true, 5.2);
  for (let z = 5.9; z < 10.6; z += 1.05) addStool(backBar, -half + 1.75, z, surfaces.seat);

  const dart = feature(root, 'venue-dive-dartboard');
  const board = cylinder(dart, .46, .46, .055, [half - .2, 2.15, 10.2], matte('#22201c'), 24);
  board.rotation.z = Math.PI / 2;
  const ring = new T.Mesh(new T.TorusGeometry(.35, .025, 6, 24), matte('#b5834b'));
  ring.rotation.y = Math.PI / 2;
  ring.position.set(half - .235, 2.15, 10.2);
  dart.add(ring);

  const beams = feature(root, 'venue-dive-low-ceiling-beams');
  for (let z = 2; z < p.roomDepth - 1; z += 4.5)
    box(beams, [p.roomWidth - .6, .22, .3], [0, p.roofHeight - .25, z], matte('#2a211d'));

  const clutter = feature(root, 'venue-dive-edge-clutter');
  box(clutter, [.65, .8, .65], [half - .75, .4, 5.8], matte('#272b2b'));
  for (let i = 0; i < 4; i += 1)
    rod(clutter, [half - .55, .2, 13 + i * .08], [half - .55, 1.9, 13 + i * .08], .018, matte('#7a6245'));
  const sign = new T.MeshStandardMaterial({ color: '#7f2435', emissive: '#ff365e', emissiveIntensity: 1.35, roughness: .45 });
  box(clutter, [.05, .62, 2.2], [half - .16, 2.55, 5.1], sign);

  const lights = feature(root, 'venue-dive-dim-practicals');
  for (const z of [4.5, 11.5]) addPracticalLight(lights, [0, p.roofHeight - .65, z], '#d28758', 2.5, 4.2, matte('#29221d'));
  root.userData.identityFeatures.push('bottle-backbar', 'dartboard', 'low-beams', 'edge-clutter', 'neon-sign');
}

function buildRockClub(root: T.Group, p: VenueProfile, surfaces: VenueSurfaceMaterials) {
  const half = p.roomWidth / 2;
  const barrier = feature(root, 'venue-rock-front-barrier');
  const steel = metal('#59616a', .56);
  const z = 1.45;
  for (let x = -p.stageWidth * .46; x <= p.stageWidth * .46; x += 1.2) {
    rod(barrier, [x, 0, z], [x, 1.0, z], .028, steel);
    rod(barrier, [x, .88, z], [Math.min(x + 1.1, p.stageWidth * .48), .88, z], .022, steel);
  }

  const cases = feature(root, 'venue-rock-road-cases');
  for (let i = 0; i < 4; i += 1) addFlightCase(cases, (i < 2 ? -1 : 1) * (half - 1.2), 2.7 + (i % 2) * 1.05, .9);
  addCableCoil(cases, half - 1.15, 5.15);
  addCableCoil(cases, -half + 1.15, 5.45);

  const walls = feature(root, 'venue-rock-acoustic-wall');
  for (const side of [-1, 1] as const) for (let i = 0; i < 4; i += 1) {
    const panel = box(walls, [.08, 1.4, 1.1], [side * (half - .15), 2.65, 3 + i * 3.1], surfaces.detail);
    panel.rotation.x = (i % 2 ? .025 : -.025);
  }
  addExitDoor(walls, half - .12, 13.5, 1, p.roofHeight);

  const lights = feature(root, 'venue-rock-industrial-practicals');
  for (const side of [-1, 1] as const) for (const z0 of [4.2, 10.5])
    addPracticalLight(lights, [side * (half - 1.2), p.roofHeight - .75, z0], '#7ca6bc', 3.5, 5.3, steel);
  root.userData.identityFeatures.push('front-barrier', 'road-cases', 'cable-coils', 'acoustic-wall', 'industrial-practicals');
}

function buildLiveHouse(root: T.Group, p: VenueProfile, surfaces: VenueSurfaceMaterials) {
  const half = p.roomWidth / 2;
  const foh = feature(root, 'venue-live-house-foh');
  const z = Math.min(p.roomDepth - 3.2, p.crowdDepth + 3.2);
  box(foh, [3.2, .92, 1.45], [0, .46, z], matte('#171c22'));
  box(foh, [3.0, .09, 1.35], [0, .97, z], metal('#3d4650', .52));
  for (let row = 0; row < 4; row += 1) for (let col = 0; col < 10; col += 1) {
    const light = new T.MeshStandardMaterial({
      color: (row + col) % 3 === 0 ? '#5ac19b' : (row + col) % 3 === 1 ? '#d9a45f' : '#637f9b',
      emissive: (row + col) % 3 === 0 ? '#3fb887' : '#6b5238',
      emissiveIntensity: .45,
      roughness: .45,
    });
    box(foh, [.12, .035, .055], [-1.24 + col * .275, 1.04, z - .48 + row * .22], light);
  }

  const backstage = feature(root, 'venue-live-house-backstage-door');
  addExitDoor(backstage, -half + .12, 2.5, -1, p.roofHeight);
  for (let i = 0; i < 5; i += 1) addFlightCase(backstage, -half + 1.25 + (i % 2) * .85, 2.0 + Math.floor(i / 2) * .82, .78);

  const treatment = feature(root, 'venue-live-house-acoustic-treatment');
  for (const side of [-1, 1] as const) for (let i = 0; i < 5; i += 1)
    box(treatment, [.07, 1.3, 1.35], [side * (half - .16), 2.65, 3.2 + i * 2.65], i % 2 ? surfaces.detail : matte('#22272c'));

  const merch = feature(root, 'venue-live-house-merch-point');
  box(merch, [2.8, .78, .8], [half - 1.8, .39, Math.min(p.roomDepth - 2.6, 13)], matte('#27202a'));
  box(merch, [2.5, 1.1, .05], [half - 1.8, 1.65, Math.min(p.roomDepth - 2.95, 12.7)], surfaces.wall);

  const lights = feature(root, 'venue-live-house-practicals');
  for (const z0 of [4.8, 11.2].filter(value => value < p.roomDepth - 1))
    addPracticalLight(lights, [0, p.roofHeight - .72, z0], '#b9c9d0', 3.6, 5.4, metal('#5c6670', .5));
  root.userData.identityFeatures.push('foh-desk', 'backstage-door', 'flight-cases', 'acoustic-treatment', 'merch-point');
}

function buildUniversityUnion(root: T.Group, p: VenueProfile, random: () => number, surfaces: VenueSurfaceMaterials) {
  const half = p.roomWidth / 2;
  const notice = feature(root, 'venue-union-noticeboards');
  addNoticeBoard(notice, half - .15, 2.2, 7, true, random);
  addNoticeBoard(notice, -half + .15, 2.2, 11, true, random);

  const chairs = feature(root, 'venue-union-stacked-chairs');
  const seat = surfaces.seat;
  const steel = metal('#68717a', .6);
  for (const side of [-1, 1] as const) for (let i = 0; i < 5; i += 1) {
    const x = side * (half - .8);
    const z = 3.3 + i * .36;
    box(chairs, [.65, .08, .65], [x, .42 + i * .025, z], seat);
    box(chairs, [.65, .65, .08], [x, .78 + i * .025, z + .28], seat);
    for (const dx of [-.24, .24]) rod(chairs, [x + dx, .05, z], [x + dx, .72, z], .018, steel);
  }

  const vending = feature(root, 'venue-union-vending-area');
  const glow = new T.MeshStandardMaterial({ color: '#4e6371', emissive: '#1e3f54', emissiveIntensity: .45, roughness: .28 });
  box(vending, [1.05, 2.05, .72], [half - .85, 1.025, 14], matte('#303840'));
  box(vending, [.88, 1.28, .04], [half - 1.39, 1.28, 14], glow);
  for (let i = 0; i < 4; i += 1) box(vending, [.05, .14, .48], [half - 1.42, .72 + i * .3, 14], matte(i % 2 ? '#c9a34d' : '#7aa36c'));

  const temp = feature(root, 'venue-union-portable-service');
  box(temp, [2.7, .78, .75], [-half + 1.8, .39, 13.2], matte('#41464c'));
  for (let i = 0; i < 4; i += 1) addStool(temp, -half + 3.05, 11.7 + i * .82, seat);
  addExitDoor(temp, half - .12, 4.2, 1, p.roofHeight);

  const lights = feature(root, 'venue-union-functional-lighting');
  const fluorescent = new T.MeshStandardMaterial({ color: '#d9e3df', emissive: '#cde4dc', emissiveIntensity: .85, roughness: .34 });
  for (const z0 of [4, 9, 14].filter(value => value < p.roomDepth - 1)) {
    box(lights, [3.4, .07, .22], [0, p.roofHeight - .25, z0], fluorescent);
    const light = new T.PointLight('#d9e8e4', 2.6, 5.5, 2);
    light.position.set(0, p.roofHeight - .5, z0);
    light.castShadow = false;
    light.name = 'venue-practical-light';
    lights.add(light);
  }

  root.userData.identityFeatures.push('noticeboards', 'stacked-chairs', 'vending-area', 'portable-service', 'functional-lighting');
}

export function buildVenueDressing(
  parent: T.Group,
  p: VenueProfile,
  seed: number,
  surfaces: VenueSurfaceMaterials,
) {
  if (!SMALL_VENUES.has(p.kind)) return null;

  const root = new T.Group();
  root.name = `venue-dressing-${p.kind}`;
  root.userData.identityFeatures = [] as string[];
  root.userData.venueKind = p.kind;
  parent.add(root);

  const random = seededRandom(seed + 911);

  if (p.kind === 'cafe_stage') buildCafe(root, p, surfaces);
  if (p.kind === 'jazz_lounge') buildJazz(root, p, surfaces);
  if (p.kind === 'dive_bar') buildDiveBar(root, p, surfaces);
  if (p.kind === 'rock_club') buildRockClub(root, p, surfaces);
  if (p.kind === 'live_house') buildLiveHouse(root, p, surfaces);
  if (p.kind === 'university_union') buildUniversityUnion(root, p, random, surfaces);

  return root;
}
