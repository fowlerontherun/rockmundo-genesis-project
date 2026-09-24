import * as T from 'three';
import { box, cylinder, matte, metal, rod } from './stage';
import { seededRandom } from './config';
import type { VenueProfile } from './venueProfile';
import type { VenueSurfaceMaterials } from './venueSurfaceMaterials';

const DETAIL_VENUES = new Set([
  'warehouse',
  'theatre',
  'concert_hall',
  'church_hall',
  'street_corner',
  'city_square',
  'rooftop_terrace',
]);

interface DetailPalette {
  dark: T.MeshStandardMaterial;
  steel: T.MeshStandardMaterial;
  brass: T.MeshStandardMaterial;
  timber: T.MeshStandardMaterial;
  pale: T.MeshStandardMaterial;
  green: T.MeshStandardMaterial;
  red: T.MeshStandardMaterial;
  warmGlow: T.MeshStandardMaterial;
  coolGlow: T.MeshStandardMaterial;
  accentGlow: T.MeshStandardMaterial;
}

function paletteFor(p: VenueProfile): DetailPalette {
  return {
    dark: matte('#181d22', .86),
    steel: metal('#65717a', .5),
    brass: metal('#a2874f', .4),
    timber: matte('#58402f', .74),
    pale: matte('#d0c6b2', .82),
    green: matte('#405f49', .82),
    red: matte('#622c3a', .82),
    warmGlow: new T.MeshStandardMaterial({ color: '#e4ae75', emissive: '#d98c48', emissiveIntensity: 1.15, roughness: .38 }),
    coolGlow: new T.MeshStandardMaterial({ color: '#9fc4cf', emissive: '#5b91a4', emissiveIntensity: .75, roughness: .32 }),
    accentGlow: new T.MeshStandardMaterial({ color: p.accent, emissive: p.accent, emissiveIntensity: 1.05, roughness: .42 }),
  };
}

function feature(parent: T.Object3D, name: string) {
  const group = new T.Group();
  group.name = name;
  parent.add(group);
  return group;
}

function practical(
  parent: T.Object3D,
  x: number,
  y: number,
  z: number,
  color: string,
  intensity: number,
  distance: number,
  fixture: T.Material,
  bulb: T.Material,
) {
  cylinder(parent, .14, .22, .22, [x, y, z], fixture, 14);
  cylinder(parent, .075, .075, .08, [x, y - .13, z], bulb, 10);
  const light = new T.PointLight(color, intensity, distance, 2);
  light.position.set(x, y - .2, z);
  light.castShadow = false;
  light.name = 'venue-detail-practical-light';
  parent.add(light);
}

function railing(parent: T.Object3D, fromX: number, toX: number, y: number, z: number, material: T.Material) {
  rod(parent, [fromX, y, z], [toX, y, z], .025, material);
  for (let x = fromX; x <= toX + .01; x += .65)
    rod(parent, [x, y - .8, z], [x, y, z], .018, material);
}

function crate(parent: T.Object3D, x: number, z: number, material: T.Material, edge: T.Material, scale = 1) {
  const w = 1.05 * scale, h = .72 * scale, d = .82 * scale;
  box(parent, [w, h, d], [x, h / 2, z], material);
  for (const sx of [-1, 1]) box(parent, [.055, h + .03, d + .04], [x + sx * w * .48, h / 2, z], edge);
  for (const sy of [-1, 1]) box(parent, [w + .04, .055, d + .04], [x, h / 2 + sy * h * .48, z], edge);
}

function planter(parent: T.Object3D, x: number, z: number, boxMat: T.Material, green: T.Material, scale = 1) {
  box(parent, [1.25 * scale, .5 * scale, .72 * scale], [x, .25 * scale, z], boxMat);
  for (const dx of [-.35, 0, .35]) {
    rod(parent, [x + dx * scale, .5 * scale, z], [x + dx * scale, 1.05 * scale, z], .035 * scale, green);
    const crown = new T.Mesh(new T.IcosahedronGeometry(.24 * scale, 1), green);
    crown.position.set(x + dx * scale, 1.12 * scale, z);
    crown.scale.set(1, .8, 1);
    parent.add(crown);
  }
}

function bench(parent: T.Object3D, x: number, z: number, rotation: number, seat: T.Material, steel: T.Material) {
  const root = new T.Group();
  root.position.set(x, 0, z);
  root.rotation.y = rotation;
  parent.add(root);
  box(root, [2.1, .12, .55], [0, .62, 0], seat);
  box(root, [2.1, .7, .12], [0, 1.02, .22], seat);
  for (const px of [-.82, .82]) {
    rod(root, [px, .05, -.18], [px, .58, -.18], .035, steel);
    rod(root, [px, .05, .18], [px, .58, .18], .035, steel);
  }
}

function buildWarehouse(root: T.Group, p: VenueProfile, random: () => number, surfaces: VenueSurfaceMaterials, palette: DetailPalette) {
  const half = p.roomWidth / 2;
  const back = .65 - p.stageDepth - 1.4;

  const loading = feature(root, 'venue-warehouse-loading-bay');
  const shutterZ = Math.min(p.roomDepth - 2.4, 16);
  box(loading, [.12, 4.7, 6.1], [-half + .16, 2.35, shutterZ], palette.dark);
  for (let y = .45; y < 4.55; y += .38)
    box(loading, [.035, .055, 5.75], [-half + .08, y, shutterZ], palette.steel);
  box(loading, [.3, .3, 6.5], [-half + .04, 4.72, shutterZ], palette.steel);
  box(loading, [2.4, .55, 3.2], [-half + 1.45, .275, shutterZ], surfaces.concrete);

  const gantry = feature(root, 'venue-warehouse-service-gantry');
  const gantryY = Math.min(p.roofHeight - 2.1, 6.3);
  box(gantry, [p.roomWidth - 2.2, .12, 1.2], [0, gantryY, p.roomDepth - 2.2], palette.steel);
  railing(gantry, -half + 1.2, half - 1.2, gantryY + 1, p.roomDepth - 1.65, palette.steel);
  for (const x of [-half + 1.4, 0, half - 1.4])
    rod(gantry, [x, 0, p.roomDepth - 2.2], [x, gantryY, p.roomDepth - 2.2], .055, palette.steel);

  const ducting = feature(root, 'venue-warehouse-overhead-ducting');
  for (const side of [-1, 1] as const) {
    const x = side * (half - 2.15);
    for (let z = back + 4; z < p.roomDepth - 2; z += 6.2) {
      cylinder(ducting, .34, .34, 5.2, [x, p.roofHeight - 1.25, z], palette.steel, 14).rotation.x = Math.PI / 2;
      for (const dz of [-2.55, 2.55]) {
        const ring = new T.Mesh(new T.TorusGeometry(.35, .028, 6, 18), palette.dark);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(x, p.roofHeight - 1.25, z + dz);
        ducting.add(ring);
      }
    }
  }

  const pallets = feature(root, 'venue-warehouse-pallet-stack');
  for (let i = 0; i < 7; i += 1) {
    const side = i % 2 ? -1 : 1;
    const x = side * (half - 1.35 - random() * .4);
    const z = 4 + Math.floor(i / 2) * 1.25;
    crate(pallets, x, z, i % 3 === 0 ? surfaces.wall : palette.timber, palette.steel, .78 + random() * .14);
  }

  const lights = feature(root, 'venue-warehouse-sodium-practicals');
  for (const x of [-half * .45, half * .45])
    practical(lights, x, p.roofHeight - .75, 9, '#d79a58', 4.2, 7.5, palette.steel, palette.warmGlow);

  root.userData.identityFeatures.push('loading-bay', 'service-gantry', 'overhead-ducting', 'pallet-stack', 'sodium-practicals');
}

function buildTheatre(root: T.Group, p: VenueProfile, surfaces: VenueSurfaceMaterials, palette: DetailPalette) {
  const half = p.roomWidth / 2;
  const back = .65 - p.stageDepth - 1.4;

  const boxes = feature(root, 'venue-theatre-private-boxes');
  for (const side of [-1, 1] as const) for (let level = 0; level < 2; level += 1) {
    const y = 3.8 + level * 2.25;
    const x = side * (half - 1.25);
    box(boxes, [2.15, .22, 5.2], [x, y, 6.8], surfaces.detail);
    box(boxes, [.18, 1.15, 5.1], [side * (half - .2), y + .54, 6.8], palette.red);
    rod(boxes, [x - .85, y + .95, 4.3], [x + .85, y + .95, 4.3], .04, palette.brass);
    rod(boxes, [x - .85, y + .95, 9.3], [x + .85, y + .95, 9.3], .04, palette.brass);
  }

  const drapes = feature(root, 'venue-theatre-side-drapes');
  for (const side of [-1, 1] as const) {
    const x = side * (p.stageWidth / 2 + .85);
    const drape = box(drapes, [1.15, p.rigHeight * .72, .22], [x, p.rigHeight * .42, back + 1.65], palette.red);
    drape.rotation.z = side * .035;
    for (let y = 1; y < p.rigHeight * .75; y += .55)
      box(drapes, [.08, .06, .24], [x - side * .58, y, back + 1.65], palette.brass);
  }

  const pit = feature(root, 'venue-theatre-orchestra-pit');
  box(pit, [Math.min(p.stageWidth * .86, 12), .28, 2.1], [0, .14, 2.15], palette.dark);
  railing(pit, -Math.min(p.stageWidth * .4, 5.5), Math.min(p.stageWidth * .4, 5.5), .95, 1.15, palette.brass);

  const sconces = feature(root, 'venue-theatre-house-sconces');
  for (const side of [-1, 1] as const) for (const z of [5.2, 11.8]) {
    rod(sconces, [side * (half - .15), 3.15, z], [side * (half - .7), 3.15, z], .025, palette.brass);
    practical(sconces, side * (half - .82), 3.15, z, '#efb070', 2.8, 4.6, palette.brass, palette.warmGlow);
  }

  root.userData.identityFeatures.push('private-boxes', 'side-drapes', 'orchestra-pit', 'gold-rails', 'house-sconces');
}

function buildConcertHall(root: T.Group, p: VenueProfile, surfaces: VenueSurfaceMaterials, palette: DetailPalette) {
  const half = p.roomWidth / 2;

  const fins = feature(root, 'venue-concert-acoustic-fins');
  for (const side of [-1, 1] as const) for (let i = 0; i < 8; i += 1) {
    const z = 2.5 + i * Math.min(3.3, (p.roomDepth - 5) / 8);
    const fin = box(fins, [.18, Math.min(4.8, p.roofHeight * .45), 1.1], [side * (half - .38), 3.3, z], surfaces.detail);
    fin.rotation.y = side * (.14 + (i % 3) * .025);
  }

  const clouds = feature(root, 'venue-concert-acoustic-clouds');
  const cloudY = Math.min(p.roofHeight - 1.4, p.rigHeight + 2.0);
  for (let i = 0; i < 4; i += 1) {
    const z = 4.5 + i * Math.min(5.4, (p.roomDepth - 8) / 4);
    const cloud = box(clouds, [p.roomWidth * .58, .16, 2.2], [0, cloudY - (i % 2) * .25, z], surfaces.wall);
    cloud.rotation.x = (i - 1.5) * .035;
    for (const x of [-p.roomWidth * .2, p.roomWidth * .2])
      rod(clouds, [x, cloud.position.y + .08, z], [x, p.roofHeight - .2, z], .014, palette.steel);
  }

  const balcony = feature(root, 'venue-concert-balcony-front');
  const balconyY = Math.min(p.roofHeight * .55, 6.8);
  for (const side of [-1, 1] as const) {
    box(balcony, [2.6, .26, p.roomDepth * .58], [side * (half - 1.45), balconyY, p.roomDepth * .47], surfaces.detail);
    rod(balcony, [side * (half - 2.65), balconyY + .95, 2.3], [side * (half - 2.65), balconyY + .95, p.roomDepth * .75], .035, palette.brass);
  }

  const entry = feature(root, 'venue-concert-hall-entry-doors');
  for (const side of [-1, 1] as const) {
    const x = side * (half - .15);
    for (const z of [7, 15].filter(value => value < p.roomDepth - 2)) {
      box(entry, [.12, 2.5, 1.6], [x, 1.25, z], palette.timber);
      box(entry, [.14, .12, 1.78], [x, 2.53, z], palette.brass);
    }
  }

  const lights = feature(root, 'venue-concert-warm-house-lights');
  for (const side of [-1, 1] as const) for (const z of [6, 14].filter(value => value < p.roomDepth - 1))
    practical(lights, side * (half - 1.1), Math.min(p.roofHeight - 1, 4.8), z, '#edbd83', 2.5, 5.2, palette.brass, palette.warmGlow);

  root.userData.identityFeatures.push('acoustic-fins', 'acoustic-clouds', 'balcony-fronts', 'entry-doors', 'warm-house-lights');
}

function buildChurchHall(root: T.Group, p: VenueProfile, surfaces: VenueSurfaceMaterials, palette: DetailPalette) {
  const half = p.roomWidth / 2;

  const benches = feature(root, 'venue-church-hall-benches');
  for (const side of [-1, 1] as const) for (let i = 0; i < 3; i += 1) {
    const x = side * (half - 1.25);
    const z = 6 + i * 2.35;
    box(benches, [1.65, .12, .58], [x, .62, z], palette.timber);
    box(benches, [1.65, .65, .12], [x, .96, z + .22], palette.timber);
    for (const dx of [-.66, .66]) rod(benches, [x + dx, .05, z], [x + dx, .58, z], .035, palette.timber);
  }

  const honours = feature(root, 'venue-church-hall-honours-board');
  box(honours, [.06, 2.1, 2.8], [half - .16, 2.3, 4.8], palette.timber);
  for (let row = 0; row < 6; row += 1)
    box(honours, [.02, .035, 2.2], [half - .205, 2.95 - row * .24, 4.8], palette.brass);
  const clock = cylinder(honours, .42, .42, .05, [-half + .18, 2.85, 5.4], palette.pale, 24);
  clock.rotation.z = Math.PI / 2;

  const radiators = feature(root, 'venue-church-hall-radiators');
  for (const side of [-1, 1] as const) for (const z of [5, 12].filter(value => value < p.roomDepth - 1)) {
    for (let i = 0; i < 7; i += 1)
      box(radiators, [.06, .7, .12], [side * (half - .2), .55, z - .48 + i * .16], palette.pale);
    rod(radiators, [side * (half - .2), .2, z - .6], [side * (half - .2), .2, z + .6], .018, palette.steel);
  }

  const kitchen = feature(root, 'venue-church-hall-serving-hatch');
  box(kitchen, [.05, 1.65, 3.1], [-half + .16, 1.85, 10], palette.dark);
  box(kitchen, [.32, .12, 3.3], [-half + .32, 1.05, 10], surfaces.detail);
  for (const z of [9.1, 9.7, 10.3, 10.9])
    cylinder(kitchen, .075, .065, .11, [-half + .5, 1.18, z], palette.pale, 10);

  const lights = feature(root, 'venue-church-hall-pendants');
  for (const z of [4.5, 10.5].filter(value => value < p.roomDepth - 1))
    practical(lights, 0, p.roofHeight - .85, z, '#e9bd82', 3, 5.8, palette.pale, palette.warmGlow);

  root.userData.identityFeatures.push('wood-benches', 'honours-board', 'radiators', 'serving-hatch', 'warm-pendants');
}

function buildStreetCorner(root: T.Group, p: VenueProfile, random: () => number, surfaces: VenueSurfaceMaterials, palette: DetailPalette) {
  const half = p.roomWidth / 2;

  const bollards = feature(root, 'venue-street-bollards');
  for (const side of [-1, 1] as const) for (let z = 3; z < Math.min(p.roomDepth, 17); z += 3.6)
    cylinder(bollards, .12, .15, .85, [side * (half - 1.2), .425, z], palette.steel, 12);

  const utilities = feature(root, 'venue-street-utilities');
  box(utilities, [.9, 1.25, .55], [half - 1.05, .625, 7.2], palette.dark);
  box(utilities, [.75, .72, .04], [half - 1.51, .72, 7.2], surfaces.detail);
  rod(utilities, [-half + .8, 0, 8.5], [-half + .8, 3.7, 8.5], .055, palette.steel);
  box(utilities, [.08, .72, .72], [-half + .79, 3.15, 8.5], palette.accentGlow);

  const racks = feature(root, 'venue-street-bike-rack');
  for (let i = 0; i < 4; i += 1) {
    const torus = new T.Mesh(new T.TorusGeometry(.42, .035, 8, 18, Math.PI), palette.steel);
    torus.rotation.z = Math.PI / 2;
    torus.position.set(-half + 1.5 + i * .72, .05, 12.8);
    racks.add(torus);
  }

  const graffiti = feature(root, 'venue-street-graffiti-panels');
  for (let i = 0; i < 4; i += 1) {
    const mat = i % 2 ? palette.accentGlow : palette.red;
    const panel = box(graffiti, [.025, .32 + random() * .25, .65 + random() * .5], [half - .12, 1.1 + i * .42, 12 + i * .95], mat);
    panel.rotation.x = (random() - .5) * .2;
  }

  root.userData.identityFeatures.push('bollards', 'utility-boxes', 'bike-rack', 'street-sign', 'graffiti');
}

function buildCitySquare(root: T.Group, p: VenueProfile, surfaces: VenueSurfaceMaterials, palette: DetailPalette) {
  const half = p.roomWidth / 2;

  const seating = feature(root, 'venue-square-benches');
  bench(seating, -half + 2.5, 7, Math.PI / 2, palette.timber, palette.steel);
  bench(seating, half - 2.5, 13, -Math.PI / 2, palette.timber, palette.steel);

  const planters = feature(root, 'venue-square-planters');
  for (const side of [-1, 1] as const) {
    planter(planters, side * (half - 2), 4.2, surfaces.stone, palette.green, 1.05);
    planter(planters, side * (half - 2), 16.5, surfaces.stone, palette.green, 1.05);
  }

  const kiosks = feature(root, 'venue-square-kiosks');
  for (const side of [-1, 1] as const) {
    const x = side * (half - 3.2), z = 10;
    box(kiosks, [2.6, 1.4, 2.0], [x, .7, z], surfaces.wall);
    const roof = new T.Mesh(new T.ConeGeometry(1.8, .9, 4), palette.red);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(x, 1.85, z);
    kiosks.add(roof);
    box(kiosks, [2.0, .5, .05], [x, 1.05, z - 1.02], palette.accentGlow);
  }

  const lamps = feature(root, 'venue-square-lampposts');
  for (const side of [-1, 1] as const) for (const z of [5, 15]) {
    rod(lamps, [side * (half - 1), 0, z], [side * (half - 1), 4.4, z], .055, palette.steel);
    box(lamps, [.45, .22, .45], [side * (half - 1), 4.35, z], palette.warmGlow);
  }

  root.userData.identityFeatures.push('benches', 'stone-planters', 'market-kiosks', 'lampposts');
}

function buildRooftop(root: T.Group, p: VenueProfile, surfaces: VenueSurfaceMaterials, palette: DetailPalette) {
  const half = p.roomWidth / 2;

  const hvac = feature(root, 'venue-rooftop-hvac');
  for (const side of [-1, 1] as const) for (let i = 0; i < 2; i += 1) {
    const x = side * (half - 1.7), z = 5.5 + i * 5.1;
    box(hvac, [2.1, 1.15, 1.6], [x, .575, z], surfaces.detail);
    const fan = cylinder(hvac, .42, .42, .06, [x, 1.18, z], palette.dark, 20);
    for (let blade = 0; blade < 4; blade += 1) {
      const b = box(hvac, [.5, .025, .11], [x, 1.22, z], palette.steel);
      b.rotation.y = blade * Math.PI / 2;
    }
    fan.rotation.x = 0;
  }

  const vents = feature(root, 'venue-rooftop-vents');
  for (const x of [-half * .45, 0, half * .45]) {
    cylinder(vents, .24, .28, 1.1, [x, .55, p.roomDepth - 3], palette.steel, 12);
    const cap = cylinder(vents, .4, .26, .18, [x, 1.18, p.roomDepth - 3], palette.steel, 12);
    cap.rotation.x = 0;
  }

  const terrace = feature(root, 'venue-rooftop-lounge');
  for (const side of [-1, 1] as const) {
    planter(terrace, side * (half - 1.25), 3.8, palette.timber, palette.green, .82);
    bench(terrace, side * (half - 1.4), 8.8, side > 0 ? -Math.PI / 2 : Math.PI / 2, palette.timber, palette.steel);
  }

  const strings = feature(root, 'venue-rooftop-string-lights');
  for (const z of [4.2, 9.4, 14.6].filter(value => value < p.roomDepth - 1)) {
    rod(strings, [-half + .8, 3.6, z], [half - .8, 3.9, z], .009, palette.dark);
    for (let i = 0; i < 8; i += 1) {
      const x = -half + 1.1 + i * (p.roomWidth - 2.2) / 7;
      cylinder(strings, .055, .055, .08, [x, 3.58 + i * .04, z], palette.warmGlow, 8);
    }
  }

  const lights = feature(root, 'venue-rooftop-ambient-lights');
  for (const x of [-half * .42, half * .42])
    practical(lights, x, 3.05, Math.min(12, p.roomDepth - 3), '#e3b17e', 2.4, 4.8, palette.dark, palette.warmGlow);

  root.userData.identityFeatures.push('hvac', 'roof-vents', 'planters', 'lounge-benches', 'string-lights');
}

export function buildVenueDetailDressing(
  parent: T.Group,
  p: VenueProfile,
  seed: number,
  surfaces: VenueSurfaceMaterials,
) {
  if (!DETAIL_VENUES.has(p.kind)) return null;

  const root = new T.Group();
  root.name = `venue-detail-dressing-${p.kind}`;
  root.userData.identityFeatures = [] as string[];
  root.userData.venueKind = p.kind;
  parent.add(root);

  const random = seededRandom(seed + 1777);
  const palette = paletteFor(p);

  if (p.kind === 'warehouse') buildWarehouse(root, p, random, surfaces, palette);
  if (p.kind === 'theatre') buildTheatre(root, p, surfaces, palette);
  if (p.kind === 'concert_hall') buildConcertHall(root, p, surfaces, palette);
  if (p.kind === 'church_hall') buildChurchHall(root, p, surfaces, palette);
  if (p.kind === 'street_corner') buildStreetCorner(root, p, random, surfaces, palette);
  if (p.kind === 'city_square') buildCitySquare(root, p, surfaces, palette);
  if (p.kind === 'rooftop_terrace') buildRooftop(root, p, surfaces, palette);

  return root;
}
