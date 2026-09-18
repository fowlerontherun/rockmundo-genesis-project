import * as T from 'three';
import { box, cylinder, rod, matte, metal } from './stage';
import type { VenueProfile } from './venueProfile';
import { resolveTotpPresenter } from '@/features/top-of-the-pops/presenters';

const presenterSceneName = (key: string) => `totp-presenter-${key.replaceAll('_', '-')}`;

function namedMat(name: string, color: string) {
  const material = matte(color);
  material.name = name;
  return material;
}

function buildCameraBody(root: T.Group, x: number, z: number, yaw = 0, handheld = false) {
  const dark = matte('#151a20');
  const steel = metal('#5f6b76');
  const glass = new T.MeshStandardMaterial({ color: '#263645', metalness: .3, roughness: .2 });
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
  box(camera, [.58, .38, .66], [0, bodyY, 0], dark);
  cylinder(camera, .12, .16, .38, [0, bodyY, -.48], glass, 18).rotation.x = Math.PI / 2;
  box(camera, [.34, .22, .05], [.34, bodyY + .08, .05], glass);
  root.add(camera);
  return camera;
}

function buildOperator(root: T.Group, x: number, z: number, yaw = 0, name = 'totp-camera-operator') {
  const skin = matte('#b98968');
  const clothes = matte('#252a31');
  const operator = new T.Group();
  operator.name = name;
  operator.position.set(x, 0, z);
  operator.rotation.y = yaw;
  cylinder(operator, .18, .22, 1.0, [0, .8, 0], clothes, 14);
  cylinder(operator, .18, .18, .34, [0, 1.47, 0], skin, 14);
  rod(operator, [-.15, 1.15, 0], [-.38, .85, -.25], .055, clothes);
  rod(operator, [.15, 1.15, 0], [.38, .85, -.25], .055, clothes);
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
  rod(presenter, [-.18, 1.15, 0], [-.42, .96, -.08], .06, suit);
  rod(presenter, [.18, 1.15, 0], [.38, 1.02, -.2], .06, suit);
  cylinder(presenter, .035, .045, .28, [.42, 1.08, -.24], matte('#111318'), 10).rotation.x = Math.PI / 2;
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
  const dark = matte('#12161c');
  const black = matte('#080a0e');
  const steel = metal('#46505b');
  const magenta = new T.MeshStandardMaterial({ color: '#9a164f', emissive: '#5a0a2b', emissiveIntensity: .7, roughness: .5 });
  const blue = new T.MeshStandardMaterial({ color: '#233f69', emissive: '#142c51', emissiveIntensity: .55, roughness: .5 });
  const amber = new T.MeshStandardMaterial({ color: '#7c3f1f', emissive: '#4b2411', emissiveIntensity: .45, roughness: .55 });

  const mainDeck = box(root, [p.stageWidth + .7, .12, p.stageDepth + .45], [0, p.stageHeight - .06, .65 - p.stageDepth / 2], dark);
  mainDeck.name = 'totp-zone-main-stage';
  box(root, [p.stageWidth * .82, 2.4, .12], [0, p.stageHeight + 2.0, .65 - p.stageDepth - .32], magenta).name = 'totp-main-stage-backdrop';
  for (const x of [-p.stageWidth * .38, 0, p.stageWidth * .38]) rod(root, [x, p.stageHeight, .5 - p.stageDepth], [x, p.rigHeight - .7, .5 - p.stageDepth], .04, steel);

  const stageB = box(root, [4.9, .22, 3.7], [5.4, .11, 2.05], blue);
  stageB.name = 'totp-zone-stage-b';
  box(root, [4.4, 1.7, .12], [5.4, 1.45, .28], blue).name = 'totp-stage-b-backdrop';
  for (const x of [3.55, 4.45, 5.35, 6.25, 7.15]) {
    const strip = box(root, [.055, 2.25, .07], [x, 1.65, .38], x === 5.35 ? magenta : blue);
    strip.name = 'totp-stage-b-light-strip';
  }
  const stageBRing = new T.Mesh(new T.TorusGeometry(1.45, .055, 10, 48), magenta);
  stageBRing.position.set(5.4, 1.75, .2);
  stageBRing.name = 'totp-stage-b-ring';
  root.add(stageBRing);

  const rock = box(root, [6.2, .28, 4.7], [-4.5, .14, 4.05], black);
  rock.name = 'totp-zone-rock-stage';
  for (const x of [-6.4, -4.5, -2.6]) rod(root, [x, .28, 2.2], [x, 4.5, 2.2], .055, steel);
  box(root, [5.8, 1.5, .14], [-4.5, 2.0, 1.72], amber).name = 'totp-rock-stage-backdrop';
  for (const side of [-1, 1]) {
    const towerX = -4.5 + side * 2.25;
    for (let level = 0; level < 3; level += 1) {
      const amp = box(root, [.85, .62, .42], [towerX, .62 + level * .67, 2.55], black);
      amp.name = 'totp-rock-amp-stack';
      box(amp, [.74, .5, .025], [0, 0, .225], steel);
    }
  }
  for (let index = 0; index < 7; index += 1) {
    const bar = box(root, [.055, 2.0 + (index % 3) * .35, .06], [-6.0 + index * .5, 2.15, 1.82], amber);
    bar.rotation.z = (index - 3) * .035;
  }

  const floorDisc = cylinder(root, 2.85, 3.05, .08, [1.4, .04, 5.65], magenta, 40);
  floorDisc.name = 'totp-zone-studio-floor';
  const floorRingOuter = new T.Mesh(new T.TorusGeometry(2.65, .045, 10, 56), blue);
  floorRingOuter.rotation.x = Math.PI / 2;
  floorRingOuter.position.set(1.4, .1, 5.65);
  floorRingOuter.name = 'totp-studio-floor-ring-outer';
  root.add(floorRingOuter);
  const floorRingInner = new T.Mesh(new T.TorusGeometry(1.75, .035, 10, 48), amber);
  floorRingInner.rotation.x = Math.PI / 2;
  floorRingInner.position.set(1.4, .105, 5.65);
  floorRingInner.name = 'totp-studio-floor-ring-inner';
  root.add(floorRingInner);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    cylinder(root, .045, .045, .06, [1.4 + Math.cos(a) * 2.65, .11, 5.65 + Math.sin(a) * 2.65], blue, 10);
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

function buildSpecialEditionDecor(root: T.Group, p: VenueProfile) {
  if (p.showVariant === 'christmas') buildChristmasSpecialDecor(root, p);
  if (p.showVariant === 'anniversary') buildAnniversarySpecialDecor(root, p);
}

export function buildTvStudioProduction(root: T.Group, p: VenueProfile) {
  if (p.kind !== 'tv_studio') return;

  const dark = matte('#11151c');
  const steel = metal('#4f5965');
  const accent = new T.MeshStandardMaterial({ color: '#b41945', emissive: '#7a0d2d', emissiveIntensity: .55, roughness: .55 });
  const floor = matte('#242830');

  buildPerformanceZones(root, p);
  buildStudioSetVariant(root, p);
  buildSpecialEditionDecor(root, p);

  const presenterX = -p.stageWidth * .66;
  const presenterZ = -.35;
  const rostrum = box(root, [2.7, .2, 2.0], [presenterX, .1, presenterZ], floor);
  rostrum.name = 'totp-presenter-rostrum';
  box(root, [2.5, 1.25, .12], [presenterX, .9, presenterZ - .95], accent).name = 'totp-presenter-backdrop';
  buildPresenter(root, presenterX, presenterZ - .12, p.presenterKey);

  const pedestalLeft = buildCameraBody(root, -p.crowdWidth * .42, 4.5, -.18);
  pedestalLeft.name = 'totp-camera-pedestal-left';
  buildOperator(root, -p.crowdWidth * .42 - .45, 4.9, -.18, 'totp-operator-left');

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
  head.position.copy(armEnd);
  box(head, [.48, .3, .56], [0, 0, 0], dark);
  cylinder(head, .11, .14, .32, [0, 0, -.39], matte('#203447'), 16).rotation.x = Math.PI / 2;
  jib.add(head);
  root.add(jib);

  for (const x of [-p.stageWidth * .46, 0, p.stageWidth * .46]) {
    const tower = new T.Group();
    tower.name = 'totp-studio-monitor';
    tower.position.set(x, p.stageHeight + 2.4, .65 - p.stageDepth - .18);
    box(tower, [2.0, 1.15, .14], [0, 0, 0], dark);
    box(tower, [1.8, .95, .04], [0, 0, .09], accent);
    root.add(tower);
  }
}
