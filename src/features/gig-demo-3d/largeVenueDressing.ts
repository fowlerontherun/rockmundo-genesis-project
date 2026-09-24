import * as T from 'three';
import { box, cylinder, matte, metal, rod } from './stage';
import type { VenueProfile } from './venueProfile';
import type { VenueSurfaceMaterials } from './venueSurfaceMaterials';

const LARGE_EVENT_VENUES = new Set([
  'indoor_arena',
  'ice_arena',
  'stadium',
  'amphitheatre',
  'festival_stage',
  'festival_tent',
  'beach_stage',
]);

interface LargeVenuePalette {
  dark: T.MeshStandardMaterial;
  steel: T.MeshStandardMaterial;
  pale: T.MeshStandardMaterial;
  timber: T.MeshStandardMaterial;
  green: T.MeshStandardMaterial;
  sand: T.MeshStandardMaterial;
  warmGlow: T.MeshStandardMaterial;
  coolGlow: T.MeshStandardMaterial;
  accentGlow: T.MeshStandardMaterial;
}

function paletteFor(p: VenueProfile): LargeVenuePalette {
  return {
    dark: matte('#171c22', .86),
    steel: metal('#66727d', .5),
    pale: matte('#d1c8b6', .82),
    timber: matte('#5a4432', .78),
    green: matte('#456044', .86),
    sand: matte('#a98f68', .9),
    warmGlow: new T.MeshStandardMaterial({ color: '#e4aa70', emissive: '#d98a49', emissiveIntensity: 1.05, roughness: .38 }),
    coolGlow: new T.MeshStandardMaterial({ color: '#8fb8c8', emissive: '#497f96', emissiveIntensity: .9, roughness: .34 }),
    accentGlow: new T.MeshStandardMaterial({ color: p.accent, emissive: p.accent, emissiveIntensity: 1.0, roughness: .42 }),
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
  position: [number, number, number],
  color: string,
  intensity: number,
  distance: number,
  fixture: T.Material,
  bulb: T.Material,
) {
  const [x, y, z] = position;
  box(parent, [.48, .18, .48], [x, y, z], fixture);
  box(parent, [.3, .06, .3], [x, y - .12, z], bulb);
  const light = new T.PointLight(color, intensity, distance, 2);
  light.position.set(x, y - .2, z);
  light.castShadow = false;
  light.name = 'venue-large-practical-light';
  parent.add(light);
}

function barrierRun(
  parent: T.Object3D,
  from: [number, number, number],
  to: [number, number, number],
  material: T.Material,
  segments = 8,
) {
  const a = new T.Vector3(...from);
  const b = new T.Vector3(...to);
  rod(parent, from, to, .03, material);
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const point = a.clone().lerp(b, t);
    rod(parent, [point.x, point.y - .9, point.z], [point.x, point.y, point.z], .02, material);
  }
}

function portal(
  parent: T.Object3D,
  x: number,
  z: number,
  side: -1 | 1,
  height: number,
  width: number,
  dark: T.Material,
  trim: T.Material,
) {
  box(parent, [.34, height, width], [x, height / 2, z], dark);
  box(parent, [.4, .16, width + .28], [x + side * .02, height + .08, z], trim);
  box(parent, [.42, height, .16], [x + side * .02, height / 2, z - width / 2 - .08], trim);
  box(parent, [.42, height, .16], [x + side * .02, height / 2, z + width / 2 + .08], trim);
}

function kiosk(
  parent: T.Object3D,
  x: number,
  z: number,
  width: number,
  surfaces: VenueSurfaceMaterials,
  palette: LargeVenuePalette,
) {
  box(parent, [width, 1.5, 1.35], [x, .75, z], surfaces.detail);
  box(parent, [width + .2, .14, 1.55], [x, 1.57, z], palette.dark);
  box(parent, [width * .7, .5, .04], [x, 1.05, z - .7], palette.accentGlow);
  for (let i = 0; i < 4; i += 1)
    box(parent, [.25, .16, .04], [x - width * .28 + i * width * .19, .58, z - .71], i % 2 ? palette.warmGlow : palette.coolGlow);
}

function tower(
  parent: T.Object3D,
  x: number,
  z: number,
  height: number,
  material: T.Material,
  deck: T.Material,
) {
  for (const dx of [-.55, .55]) for (const dz of [-.55, .55])
    rod(parent, [x + dx, 0, z + dz], [x + dx, height, z + dz], .045, material);
  for (let y = 1; y < height; y += 1.2) {
    rod(parent, [x - .55, y, z - .55], [x + .55, y + .75, z - .55], .022, material);
    rod(parent, [x - .55, y, z + .55], [x + .55, y + .75, z + .55], .022, material);
  }
  box(parent, [1.45, .12, 1.45], [x, height, z], deck);
}

function buildIndoorArena(root: T.Group, p: VenueProfile, surfaces: VenueSurfaceMaterials, palette: LargeVenuePalette) {
  const half = p.roomWidth / 2;

  const concourse = feature(root, 'venue-arena-concourse-portals');
  for (const side of [-1, 1] as const) {
    const x = side * (half - .28);
    for (const z of [7, 18, 29, 40].filter(value => value < p.roomDepth - 5))
      portal(concourse, x, z, side, 3.0, 3.2, palette.dark, surfaces.detail);
  }

  const ribbon = feature(root, 'venue-arena-ribbon-board');
  for (const side of [-1, 1] as const) {
    box(ribbon, [.1, .8, Math.min(p.roomDepth - 6, 46)], [side * (half - .36), 6.8, p.roomDepth * .42], palette.accentGlow);
    for (let z = 5; z < p.roomDepth - 5; z += 5.5)
      box(ribbon, [.11, .12, 2.4], [side * (half - .37), 6.8, z], palette.coolGlow);
  }

  const videoCube = feature(root, 'venue-arena-video-cube');
  const y = Math.min(p.roofHeight - 3.5, 12.5);
  box(videoCube, [5.8, 2.8, 5.8], [0, y, p.crowdDepth * .52], palette.dark);
  for (const side of [-1, 1] as const) {
    box(videoCube, [5.2, 2.2, .05], [0, y, p.crowdDepth * .52 + side * 2.92], palette.accentGlow);
    box(videoCube, [.05, 2.2, 5.2], [side * 2.92, y, p.crowdDepth * .52], palette.accentGlow);
  }
  for (const x of [-1.9, 1.9])
    rod(videoCube, [x, y + 1.5, p.crowdDepth * .52], [x, p.roofHeight - .2, p.crowdDepth * .52], .04, palette.steel);

  const concessions = feature(root, 'venue-arena-concessions');
  kiosk(concessions, -half + 2.4, p.roomDepth - 7.5, 3.2, surfaces, palette);
  kiosk(concessions, half - 2.4, p.roomDepth - 7.5, 3.2, surfaces, palette);

  const lights = feature(root, 'venue-arena-concourse-lighting');
  practical(lights, [-half + 3.3, 3.6, p.roomDepth - 5.5], '#a8cad4', 3.3, 7.5, palette.steel, palette.coolGlow);
  practical(lights, [half - 3.3, 3.6, p.roomDepth - 5.5], '#a8cad4', 3.3, 7.5, palette.steel, palette.coolGlow);

  root.userData.identityFeatures.push('concourse-portals', 'ribbon-board', 'video-cube', 'concessions', 'concourse-lighting');
}

function buildIceArena(root: T.Group, p: VenueProfile, surfaces: VenueSurfaceMaterials, palette: LargeVenuePalette) {
  const half = p.roomWidth / 2;

  const tunnels = feature(root, 'venue-ice-arena-team-tunnels');
  for (const side of [-1, 1] as const) {
    const x = side * (half - .3);
    portal(tunnels, x, 7.5, side, 2.65, 2.5, palette.dark, surfaces.detail);
    portal(tunnels, x, p.roomDepth - 8.2, side, 2.65, 2.5, palette.dark, surfaces.detail);
  }

  const boards = feature(root, 'venue-ice-arena-board-details');
  for (const side of [-1, 1] as const) {
    for (let z = 3; z < p.crowdDepth + 3; z += 4.5)
      box(boards, [.035, .45, 3.3], [side * (p.crowdWidth / 2 + .78), .72, z], z % 2 ? palette.accentGlow : palette.coolGlow);
  }
  for (const x of [-p.crowdWidth * .3, p.crowdWidth * .3])
    box(boards, [1.8, 1.05, .1], [x, .58, p.crowdDepth + 3.35], surfaces.detail);

  const concourse = feature(root, 'venue-ice-arena-concourse');
  kiosk(concourse, -half + 2.4, p.roomDepth - 6.8, 3.0, surfaces, palette);
  kiosk(concourse, half - 2.4, p.roomDepth - 6.8, 3.0, surfaces, palette);
  for (const side of [-1, 1] as const)
    box(concourse, [.12, .65, Math.min(34, p.roomDepth - 10)], [side * (half - .42), 5.8, p.roomDepth * .46], palette.coolGlow);

  const service = feature(root, 'venue-ice-arena-service-bays');
  for (const side of [-1, 1] as const) {
    box(service, [2.3, 1.1, 1.55], [side * (half - 1.5), .55, 12], palette.dark);
    for (let i = 0; i < 5; i += 1)
      box(service, [.18, .55, .05], [side * (half - 1.5) - .65 + i * .32, .75, 11.2], palette.pale);
  }

  const lights = feature(root, 'venue-ice-arena-cool-practicals');
  practical(lights, [-half + 3, 4.0, 15], '#b4d3db', 3.2, 7.2, palette.steel, palette.coolGlow);
  practical(lights, [half - 3, 4.0, 15], '#b4d3db', 3.2, 7.2, palette.steel, palette.coolGlow);

  root.userData.identityFeatures.push('team-tunnels', 'board-details', 'concourse', 'service-bays', 'cool-practicals');
}

function buildStadium(root: T.Group, p: VenueProfile, surfaces: VenueSurfaceMaterials, palette: LargeVenuePalette) {
  const half = p.roomWidth / 2;

  const tunnels = feature(root, 'venue-stadium-access-tunnels');
  for (const side of [-1, 1] as const) {
    const x = side * (half - .4);
    for (const z of [10, 28, 46, 64].filter(value => value < p.roomDepth - 8))
      portal(tunnels, x, z, side, 3.8, 4.8, palette.dark, surfaces.concrete);
  }

  const hospitality = feature(root, 'venue-stadium-hospitality-ring');
  for (const side of [-1, 1] as const) {
    const x = side * (half - .65);
    box(hospitality, [.28, 3.0, Math.min(54, p.roomDepth - 18)], [x, 10.2, p.roomDepth * .46], surfaces.detail);
    for (let z = 10; z < p.roomDepth - 10; z += 7.2)
      box(hospitality, [.05, 1.65, 3.8], [x - side * .18, 10.25, z], palette.coolGlow);
  }

  const screens = feature(root, 'venue-stadium-end-screens');
  const screenZ = p.crowdDepth + 13;
  box(screens, [11.5, 6.0, .38], [0, 12.5, screenZ], palette.dark);
  box(screens, [10.8, 5.2, .06], [0, 12.5, screenZ - .22], palette.accentGlow);
  for (const x of [-5.1, 5.1])
    rod(screens, [x, 0, screenZ], [x, 15.5, screenZ], .09, palette.steel);

  const service = feature(root, 'venue-stadium-service-compound');
  for (const side of [-1, 1] as const) {
    const x = side * (p.crowdWidth / 2 + 8);
    box(service, [6.5, 2.8, 4.0], [x, 1.4, 16], surfaces.wall);
    box(service, [6.9, .15, 4.3], [x, 2.85, 16], palette.dark);
    kiosk(service, x, 23, 3.4, surfaces, palette);
  }

  const towers = feature(root, 'venue-stadium-light-towers');
  for (const side of [-1, 1] as const) {
    tower(towers, side * (half - 4), p.crowdDepth + 9, 13.5, palette.steel, palette.dark);
    for (let i = 0; i < 5; i += 1)
      box(towers, [.65, .28, .18], [side * (half - 4) - 1.2 + i * .6, 13.65, p.crowdDepth + 9], palette.coolGlow);
  }

  root.userData.identityFeatures.push('access-tunnels', 'hospitality-ring', 'end-screen', 'service-compound', 'light-towers');
}

function buildAmphitheatre(root: T.Group, p: VenueProfile, surfaces: VenueSurfaceMaterials, palette: LargeVenuePalette) {
  const half = p.roomWidth / 2;

  const arches = feature(root, 'venue-amphitheatre-stone-arches');
  for (const side of [-1, 1] as const) for (let i = 0; i < 4; i += 1) {
    const z = 8 + i * 7.2;
    box(arches, [1.0, 4.2, .9], [side * (half - 1.0), 2.1, z], surfaces.stone);
    box(arches, [1.0, 4.2, .9], [side * (half - 4.0), 2.1, z], surfaces.stone);
    box(arches, [3.0, .75, .9], [side * (half - 2.5), 4.05, z], surfaces.stone);
  }

  const aisles = feature(root, 'venue-amphitheatre-aisles');
  for (const side of [-1, 1] as const) {
    const x = side * p.crowdWidth * .32;
    for (let z = 6; z < p.crowdDepth + 4; z += 3.0)
      box(aisles, [1.2, .08, 2.2], [x, .04 + (z / Math.max(1, p.crowdDepth)) * 2.0, z], palette.pale);
    barrierRun(aisles, [x - .6, 1.1, 5.0], [x - .6, 2.5, p.crowdDepth + 4], palette.steel, 10);
  }

  const tech = feature(root, 'venue-amphitheatre-tech-platform');
  box(tech, [5.2, .32, 4.2], [0, .16, p.crowdDepth + 8], palette.dark);
  tower(tech, -3.7, p.crowdDepth + 8, 6.5, palette.steel, palette.dark);
  tower(tech, 3.7, p.crowdDepth + 8, 6.5, palette.steel, palette.dark);

  const concessions = feature(root, 'venue-amphitheatre-concessions');
  kiosk(concessions, -half + 3.1, p.roomDepth - 7, 3.0, surfaces, palette);
  kiosk(concessions, half - 3.1, p.roomDepth - 7, 3.0, surfaces, palette);

  root.userData.identityFeatures.push('stone-arches', 'aisles', 'tech-platform', 'lighting-towers', 'concessions');
}

function buildFestivalStage(root: T.Group, p: VenueProfile, surfaces: VenueSurfaceMaterials, palette: LargeVenuePalette) {
  const half = p.roomWidth / 2;

  const delayTowers = feature(root, 'venue-festival-delay-towers');
  for (const side of [-1, 1] as const)
    tower(delayTowers, side * (p.crowdWidth / 2 + 6), Math.min(p.crowdDepth * .62, 25), 8.5, palette.steel, palette.dark);

  const compound = feature(root, 'venue-festival-backstage-compound');
  for (const side of [-1, 1] as const) {
    const x = side * (half - 4);
    box(compound, [6.0, 2.8, 3.1], [x, 1.4, 4.5], surfaces.wall);
    box(compound, [6.3, .16, 3.4], [x, 2.86, 4.5], palette.dark);
    for (let i = 0; i < 3; i += 1)
      box(compound, [1.45, .08, .7], [x - 1.7 + i * 1.7, .04, 7.0], palette.steel);
  }

  const service = feature(root, 'venue-festival-service-lane');
  for (const side of [-1, 1] as const) {
    barrierRun(service, [side * (p.crowdWidth / 2 + 2), 1.0, 3], [side * (p.crowdWidth / 2 + 2), 1.0, p.crowdDepth + 7], palette.steel, 11);
    for (let z = 8; z < p.crowdDepth; z += 10)
      box(service, [2.0, .08, 1.0], [side * (p.crowdWidth / 2 + 3.2), .04, z], palette.dark);
  }

  const village = feature(root, 'venue-festival-village');
  kiosk(village, -half + 4, p.crowdDepth + 8, 3.4, surfaces, palette);
  kiosk(village, 0, p.crowdDepth + 9, 3.6, surfaces, palette);
  kiosk(village, half - 4, p.crowdDepth + 8, 3.4, surfaces, palette);

  const lights = feature(root, 'venue-festival-site-lights');
  practical(lights, [-half + 5, 4.6, p.crowdDepth + 5], '#e4b175', 3.0, 8.5, palette.steel, palette.warmGlow);
  practical(lights, [half - 5, 4.6, p.crowdDepth + 5], '#e4b175', 3.0, 8.5, palette.steel, palette.warmGlow);

  root.userData.identityFeatures.push('delay-towers', 'backstage-compound', 'service-lane', 'festival-village', 'site-lights');
}

function buildFestivalTent(root: T.Group, p: VenueProfile, surfaces: VenueSurfaceMaterials, palette: LargeVenuePalette) {
  const half = p.roomWidth / 2;

  const ballast = feature(root, 'venue-festival-tent-ballast');
  for (const side of [-1, 1] as const) for (let z = 2; z < p.crowdDepth + 4; z += 6.0) {
    box(ballast, [1.2, .45, 1.2], [side * (half - .25), .225, z], surfaces.concrete);
    rod(ballast, [side * (half - .25), .45, z], [side * (half - .25), 1.25, z], .045, palette.steel);
  }

  const exits = feature(root, 'venue-festival-tent-side-exits');
  for (const side of [-1, 1] as const) for (const z of [10, 22].filter(value => value < p.roomDepth - 3)) {
    const sign = palette.accentGlow;
    box(exits, [.06, 2.4, 3.0], [side * (half - .12), 1.2, z], palette.dark);
    box(exits, [.07, .42, 1.5], [side * (half - .16), 2.7, z], sign);
  }

  const bar = feature(root, 'venue-festival-tent-bar');
  kiosk(bar, -half + 2.2, p.crowdDepth + 5.5, 3.6, surfaces, palette);
  kiosk(bar, half - 2.2, p.crowdDepth + 5.5, 3.6, surfaces, palette);

  const mats = feature(root, 'venue-festival-tent-cable-mats');
  for (let z = 3; z < p.crowdDepth; z += 7.0)
    box(mats, [p.crowdWidth + 2.5, .07, .75], [0, .035, z], palette.dark);

  const lights = feature(root, 'venue-festival-tent-practicals');
  practical(lights, [-half * .45, p.roofHeight - 1.4, p.crowdDepth * .55], '#e4b679', 3.2, 7.5, palette.steel, palette.warmGlow);
  practical(lights, [half * .45, p.roofHeight - 1.4, p.crowdDepth * .55], '#e4b679', 3.2, 7.5, palette.steel, palette.warmGlow);

  root.userData.identityFeatures.push('ballast', 'side-exits', 'tent-bar', 'cable-mats', 'warm-practicals');
}

function buildBeachStage(root: T.Group, p: VenueProfile, surfaces: VenueSurfaceMaterials, palette: LargeVenuePalette) {
  const half = p.roomWidth / 2;

  const boardwalk = feature(root, 'venue-beach-boardwalk');
  for (let z = 4; z < p.crowdDepth + 6; z += 1.2)
    box(boardwalk, [3.4, .09, .9], [-half + 2.6, .045, z], palette.timber);

  const lifeguard = feature(root, 'venue-beach-production-tower');
  tower(lifeguard, half - 3.2, 10, 5.6, palette.timber, palette.pale);
  box(lifeguard, [2.2, 1.6, 1.8], [half - 3.2, 6.3, 10], palette.pale);
  box(lifeguard, [1.8, .8, .04], [half - 3.2, 6.35, 9.08], palette.accentGlow);

  const beachBar = feature(root, 'venue-beach-bar');
  kiosk(beachBar, -half + 4.0, 12, 3.6, surfaces, palette);
  const shade = new T.Mesh(new T.ConeGeometry(2.6, 1.1, 8), palette.pale);
  shade.position.set(-half + 4.0, 3.25, 12);
  beachBar.add(shade);

  const fencing = feature(root, 'venue-beach-perimeter');
  for (const side of [-1, 1] as const)
    barrierRun(fencing, [side * (p.crowdWidth / 2 + 1.5), .95, 4], [side * (p.crowdWidth / 2 + 1.5), .95, p.crowdDepth + 5], palette.timber, 9);

  const lights = feature(root, 'venue-beach-warm-site-lights');
  practical(lights, [-half + 5, 4.0, p.crowdDepth * .7], '#e6b27b', 2.8, 7.2, palette.timber, palette.warmGlow);
  practical(lights, [half - 5, 4.0, p.crowdDepth * .7], '#e6b27b', 2.8, 7.2, palette.timber, palette.warmGlow);

  root.userData.identityFeatures.push('boardwalk', 'production-tower', 'beach-bar', 'perimeter-fencing', 'site-lights');
}

export function buildLargeVenueDressing(
  parent: T.Group,
  p: VenueProfile,
  surfaces: VenueSurfaceMaterials,
) {
  if (!LARGE_EVENT_VENUES.has(p.kind)) return null;

  const root = new T.Group();
  root.name = `venue-large-dressing-${p.kind}`;
  root.userData.identityFeatures = [] as string[];
  root.userData.venueKind = p.kind;
  parent.add(root);

  const palette = paletteFor(p);

  if (p.kind === 'indoor_arena') buildIndoorArena(root, p, surfaces, palette);
  if (p.kind === 'ice_arena') buildIceArena(root, p, surfaces, palette);
  if (p.kind === 'stadium') buildStadium(root, p, surfaces, palette);
  if (p.kind === 'amphitheatre') buildAmphitheatre(root, p, surfaces, palette);
  if (p.kind === 'festival_stage') buildFestivalStage(root, p, surfaces, palette);
  if (p.kind === 'festival_tent') buildFestivalTent(root, p, surfaces, palette);
  if (p.kind === 'beach_stage') buildBeachStage(root, p, surfaces, palette);

  return root;
}
