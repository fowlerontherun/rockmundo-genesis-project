import * as T from 'three';
import { box, cylinder, matte, metal, rod } from './stage';
import { seededRandom } from './config';
import type { VenueProfile } from './venueProfile';
import type { VenueSurfaceMaterials } from './venueSurfaceMaterials';

const MICRODETAIL_VENUES = new Set([
  'street_corner',
  'cafe_stage',
  'dive_bar',
  'jazz_lounge',
  'rock_club',
  'live_house',
  'warehouse',
  'university_union',
  'church_hall',
  'concert_hall',
  'theatre',
  'indoor_arena',
  'ice_arena',
  'stadium',
  'amphitheatre',
  'park_bandstand',
  'city_square',
  'rooftop_terrace',
  'festival_tent',
  'beach_stage',
  'festival_stage',
]);

interface MicroPalette {
  dark: T.MeshStandardMaterial;
  steel: T.MeshStandardMaterial;
  safety: T.MeshStandardMaterial;
  grime: T.MeshStandardMaterial;
  pale: T.MeshStandardMaterial;
  accent: T.MeshStandardMaterial;
}

function paletteFor(p: VenueProfile): MicroPalette {
  return {
    dark: matte('#171a1e', .9),
    steel: metal('#5d6871', .54),
    safety: new T.MeshStandardMaterial({ color: '#c7a33d', emissive: '#5d4814', emissiveIntensity: .18, roughness: .78 }),
    grime: new T.MeshStandardMaterial({ color: '#272521', transparent: true, opacity: .72, roughness: .98, depthWrite: false }),
    pale: matte('#c7c1b3', .86),
    accent: new T.MeshStandardMaterial({ color: p.accent, emissive: p.accent, emissiveIntensity: .28, roughness: .7 }),
  };
}

function feature(parent: T.Object3D, name: string) {
  const group = new T.Group();
  group.name = name;
  parent.add(group);
  return group;
}

function addBin(parent: T.Object3D, x: number, z: number, material: T.Material, lid: T.Material) {
  box(parent, [.52, .72, .52], [x, .36, z], material);
  box(parent, [.58, .08, .58], [x, .76, z], lid);
  box(parent, [.26, .07, .025], [x, .54, z - .27], lid);
}

function addCase(parent: T.Object3D, x: number, z: number, shell: T.Material, edge: T.Material, scale = 1) {
  const w = .95 * scale, h = .62 * scale, d = .62 * scale;
  box(parent, [w, h, d], [x, h / 2, z], shell);
  for (const sx of [-1, 1])
    box(parent, [.035, h + .025, d + .04], [x + sx * w * .48, h / 2, z], edge);
  for (const sy of [-1, 1])
    box(parent, [w + .04, .035, d + .04], [x, h / 2 + sy * h * .48, z], edge);
}

function addExtinguisher(parent: T.Object3D, x: number, z: number, side: -1 | 1, dark: T.Material) {
  const red = new T.MeshStandardMaterial({ color: '#9b2f31', roughness: .62, metalness: .12 });
  cylinder(parent, .1, .12, .52, [x, .42, z], red, 12);
  cylinder(parent, .045, .07, .12, [x, .74, z], dark, 10);
  rod(parent, [x, .72, z], [x + side * .18, .82, z], .018, dark);
}

function addSafetyChevrons(
  parent: T.Object3D,
  x: number,
  z: number,
  alongZ: boolean,
  span: number,
  safety: T.Material,
  dark: T.Material,
) {
  const count = 7;
  for (let i = 0; i < count; i += 1) {
    const offset = -span / 2 + (i + .5) * span / count;
    const mat = i % 2 === 0 ? safety : dark;
    if (alongZ) box(parent, [.42, .018, span / count * .9], [x, .02, z + offset], mat);
    else box(parent, [span / count * .9, .018, .42], [x + offset, .02, z], mat);
  }
}

function addPosterCluster(
  parent: T.Object3D,
  x: number,
  z: number,
  onSideWall: boolean,
  random: () => number,
  mats: readonly T.Material[],
) {
  for (let i = 0; i < 5; i += 1) {
    const y = 1.35 + (i % 3) * .58 + (random() - .5) * .1;
    const lateral = -.85 + Math.floor(i / 3) * .9 + (random() - .5) * .1;
    const poster = box(
      parent,
      onSideWall ? [.018, .72, .48] : [.48, .72, .018],
      onSideWall ? [x, y, z + lateral] : [x + lateral, y, z],
      mats[i % mats.length],
    );
    if (onSideWall) poster.rotation.x = (random() - .5) * .08;
    else poster.rotation.z = (random() - .5) * .08;
  }
}

function addCableRun(
  parent: T.Object3D,
  x: number,
  z0: number,
  z1: number,
  material: T.Material,
  variant: number,
) {
  const offset = (variant - 1.5) * .08;
  rod(parent, [x + offset, .035, z0], [x + offset, .035, z1], .018, material);
  rod(parent, [x + offset + .08, .035, z0 + .25], [x + offset + .08, .035, z1 - .35], .012, material);
}

function addWearPatches(
  parent: T.Object3D,
  p: VenueProfile,
  random: () => number,
  material: T.Material,
  count: number,
) {
  const half = p.roomWidth / 2;
  const crowdLimit = Math.min(p.roomDepth - 1.5, Math.max(6, p.crowdDepth + 2));
  for (let i = 0; i < count; i += 1) {
    const side = random() > .5 ? 1 : -1;
    const w = .45 + random() * 1.0;
    const d = .35 + random() * .85;
    const x = side * (half - .7 - random() * Math.max(.4, half * .14));
    const z = 2.1 + random() * Math.max(1, crowdLimit - 2.5);
    const patch = box(parent, [w, .012, d], [x, .018, z], material);
    patch.rotation.y = (random() - .5) * .55;
  }
}

function addUtilityConduit(
  parent: T.Object3D,
  p: VenueProfile,
  side: -1 | 1,
  z: number,
  steel: T.Material,
  dark: T.Material,
) {
  const x = side * (p.roomWidth / 2 - .2);
  rod(parent, [x, .35, z], [x, Math.min(3.1, p.roofHeight - .7), z], .025, steel);
  box(parent, [.16, .5, .42], [x - side * .03, 1.35, z], dark);
  box(parent, [.17, .12, .5], [x - side * .035, 1.7, z], steel);
}

function addServiceTable(
  parent: T.Object3D,
  x: number,
  z: number,
  surfaces: VenueSurfaceMaterials,
  palette: MicroPalette,
  variant: number,
) {
  box(parent, [2.5, .12, .75], [x, .83, z], variant % 2 ? surfaces.detail : palette.dark);
  for (const dx of [-.95, .95])
    rod(parent, [x + dx, .05, z], [x + dx, .77, z], .03, palette.steel);
  box(parent, [2.15, .78, .035], [x, 1.55, z + .39], variant % 2 ? palette.accent : surfaces.wall);
  for (let i = 0; i < 4; i += 1)
    box(parent, [.34, .12, .34], [x - .75 + i * .5, .97, z], i % 2 ? palette.pale : palette.accent);
}

function familyFeatures(p: VenueProfile) {
  const rough = ['dive_bar', 'rock_club', 'warehouse', 'street_corner', 'festival_stage'].includes(p.kind);
  const formal = ['jazz_lounge', 'theatre', 'concert_hall', 'church_hall'].includes(p.kind);
  const large = ['indoor_arena', 'ice_arena', 'stadium', 'amphitheatre', 'festival_stage', 'festival_tent'].includes(p.kind);
  const outdoor = p.outdoor || p.kind === 'festival_tent';
  return { rough, formal, large, outdoor };
}

export function buildVenueMicroDetail(
  parent: T.Group,
  p: VenueProfile,
  seed: number,
  surfaces: VenueSurfaceMaterials,
) {
  if (!MICRODETAIL_VENUES.has(p.kind)) return null;

  const root = new T.Group();
  root.name = `venue-microdetail-${p.kind}`;
  parent.add(root);

  const random = seededRandom(seed + 4099);
  const palette = paletteFor(p);
  const family = familyFeatures(p);
  const variant = Math.floor(random() * 4);
  const fixtureSide: -1 | 1 = random() > .5 ? 1 : -1;
  const wearBand = Math.floor(random() * 3);
  const clutterCount = 1 + Math.floor(random() * 3);
  const half = p.roomWidth / 2;
  const backServiceZ = Math.min(p.roomDepth - 2.2, Math.max(7, p.crowdDepth + 3));

  root.userData.venueKind = p.kind;
  root.userData.variantIndex = variant;
  root.userData.variationSignature = `${p.kind}:${variant}:${fixtureSide}:${wearBand}:${clutterCount}`;
  root.userData.identityFeatures = [] as string[];

  const utility = feature(root, 'venue-micro-utilities');
  if (!family.outdoor) {
    addUtilityConduit(utility, p, fixtureSide, Math.min(p.roomDepth - 3, 5.5 + variant * 1.1), palette.steel, palette.dark);
    addExtinguisher(
      utility,
      fixtureSide * (half - .34),
      Math.min(p.roomDepth - 2.4, 8.2 + variant),
      -fixtureSide as -1 | 1,
      palette.dark,
    );
  } else {
    addCase(utility, fixtureSide * (half - 1.4), backServiceZ, palette.dark, palette.steel, .82);
    addCase(utility, fixtureSide * (half - 2.35), backServiceZ + .45, surfaces.detail, palette.steel, .7);
  }
  root.userData.identityFeatures.push('utilities');

  const waste = feature(root, 'venue-micro-waste-stations');
  addBin(waste, -fixtureSide * (half - 1.0), Math.min(p.roomDepth - 2, 5.5 + variant * 1.8), palette.dark, surfaces.detail);
  if (family.large || p.capacity > 1500)
    addBin(waste, fixtureSide * (half - 1.2), backServiceZ, palette.dark, palette.accent);
  root.userData.identityFeatures.push('waste-stations');

  const wear = feature(root, 'venue-micro-wear');
  addWearPatches(wear, p, random, palette.grime, family.formal ? 2 : family.rough ? 6 : 4);
  root.userData.identityFeatures.push('wear');

  const safety = feature(root, 'venue-micro-safety-markings');
  const safetyX = fixtureSide * Math.min(half - .8, p.crowdWidth / 2 + .65);
  addSafetyChevrons(
    safety,
    safetyX,
    Math.min(p.roomDepth - 2.5, Math.max(4, p.crowdDepth * .32)),
    true,
    Math.min(5.5, Math.max(2.8, p.crowdDepth * .22)),
    palette.safety,
    palette.dark,
  );
  root.userData.identityFeatures.push('safety-markings');

  const cables = feature(root, 'venue-micro-cable-runs');
  addCableRun(
    cables,
    -fixtureSide * Math.min(half - .65, p.stageWidth / 2 + .8),
    1.4,
    Math.min(p.roomDepth - 2, 5.5 + variant),
    palette.dark,
    variant,
  );
  root.userData.identityFeatures.push('cable-runs');

  const service = feature(root, 'venue-micro-service-point');
  const serviceX = fixtureSide * (half - Math.min(2.0, Math.max(1.25, half * .14)));
  addServiceTable(service, serviceX, backServiceZ, surfaces, palette, variant);
  root.userData.identityFeatures.push('service-point');

  const variantDetail = feature(root, `venue-micro-variant-${variant}`);
  const posterMats = [palette.pale, palette.accent, surfaces.detail] as const;
  if (variant === 0) {
    if (!family.outdoor)
      addPosterCluster(variantDetail, -fixtureSide * (half - .14), Math.min(p.roomDepth - 2.5, 10), true, random, posterMats);
    else
      for (let i = 0; i < 4; i += 1)
        box(variantDetail, [.6, .025, .32], [-half + 1.2 + i * .72, .04, backServiceZ], i % 2 ? palette.accent : palette.pale);
  } else if (variant === 1) {
    for (let i = 0; i < clutterCount + 1; i += 1)
      addCase(
        variantDetail,
        -fixtureSide * (half - 1.1 - i * .62),
        Math.min(p.roomDepth - 2, 3.4 + i * .7),
        i % 2 ? surfaces.detail : palette.dark,
        palette.steel,
        .62 + i * .08,
      );
  } else if (variant === 2) {
    for (let i = 0; i < 5; i += 1)
      box(
        variantDetail,
        family.outdoor ? [.8, .03, .18] : [.035, .25, .8],
        family.outdoor
          ? [-1.6 + i * .8, .035, backServiceZ + .8]
          : [fixtureSide * (half - .16), 1.15 + i * .32, 4.4 + i * .68],
        i % 2 ? palette.safety : palette.dark,
      );
  } else {
    const z = Math.min(p.roomDepth - 2.4, 7.5);
    for (let i = 0; i < 3; i += 1) {
      const x = -fixtureSide * (half - 1.1 - i * .7);
      cylinder(variantDetail, .16, .2, .5 + i * .12, [x, .25 + i * .06, z], i % 2 ? palette.steel : palette.dark, 10);
    }
  }
  root.userData.identityFeatures.push(`variant-${variant}`);

  return root;
}
