import * as T from 'three';
import { box, cylinder, rod, matte, metal } from './stage';
import type { VenueProfile } from './venueProfile';

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

function buildPresenter(root: T.Group, x: number, z: number) {
  const suit = matte('#171c26');
  const shirt = matte('#e8ecef');
  const skin = matte('#b98968');
  const hair = matte('#2d2119');
  const accent = matte('#c72f52');
  const presenter = new T.Group();
  presenter.name = 'totp-presenter-alex-rayne';
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

export function buildTvStudioProduction(root: T.Group, p: VenueProfile) {
  if (p.kind !== 'tv_studio') return;

  const dark = matte('#11151c');
  const steel = metal('#4f5965');
  const accent = new T.MeshStandardMaterial({ color: '#b41945', emissive: '#7a0d2d', emissiveIntensity: .55, roughness: .55 });
  const floor = matte('#242830');

  const presenterX = -p.stageWidth * .66;
  const presenterZ = -.35;
  const rostrum = box(root, [2.7, .2, 2.0], [presenterX, .1, presenterZ], floor);
  rostrum.name = 'totp-presenter-rostrum';
  box(root, [2.5, 1.25, .12], [presenterX, .9, presenterZ - .95], accent).name = 'totp-presenter-backdrop';
  buildPresenter(root, presenterX, presenterZ - .12);

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
