import * as T from 'three';
import type { ResolvedEquippedClothing } from './equippedClothing';
import { attachSurfaceGraphic, curvedGraphicGeometry, findFrontSurfaceAttachment } from '@/features/player-model/curatedSurfaceAttachment';
import { buildCompositeGarmentSurfaceTexture } from './garmentSurfaceTextures';
import { richGarmentSlot } from './richGarmentVisuals';
import { avatarQualityProfile, type AvatarVisualQuality } from '@/features/player-model/avatarVisualQuality';

const clean = (value: string) => value.replace(/[_.]/g, '').toLowerCase();

function findBone(bones: Map<string, T.Bone>, names: string[]) {
  for (const bone of bones.values()) {
    if (names.some(name => clean(bone.name) === clean(name))) return bone;
  }
}

function metalMaterial(color = '#a7adb5') {
  return new T.MeshPhysicalMaterial({
    color,
    roughness: .2,
    metalness: .88,
    clearcoat: .6,
    clearcoatRoughness: .08,
    envMapIntensity: 1.65,
  });
}

function clothMaterial(color: string) {
  return new T.MeshStandardMaterial({ color, roughness: .9, metalness: 0, side: T.DoubleSide });
}

function patchStitchGeometry(width: number, height: number, curve = .0035) {
  const points: T.Vector3[] = [];
  const steps = 6;
  const zAt = (x: number) => -curve * Math.pow(Math.min(1, Math.abs(x / (width / 2 || 1))), 2) + .0012;
  const insetX = width * .42;
  const insetY = height * .39;
  for (let index = 0; index <= steps; index++) {
    const x = T.MathUtils.lerp(-insetX, insetX, index / steps);
    points.push(new T.Vector3(x, insetY, zAt(x)));
  }
  for (let index = 1; index <= steps; index++) {
    const y = T.MathUtils.lerp(insetY, -insetY, index / steps);
    points.push(new T.Vector3(insetX, y, zAt(insetX)));
  }
  for (let index = 1; index <= steps; index++) {
    const x = T.MathUtils.lerp(insetX, -insetX, index / steps);
    points.push(new T.Vector3(x, -insetY, zAt(x)));
  }
  for (let index = 1; index < steps; index++) {
    const y = T.MathUtils.lerp(-insetY, insetY, index / steps);
    points.push(new T.Vector3(-insetX, y, zAt(-insetX)));
  }
  return new T.BufferGeometry().setFromPoints(points);
}

function attachAtWorld(root: T.Object3D, bone: T.Bone, object: T.Object3D, position: T.Vector3) {
  root.add(object);
  object.position.copy(position);
  root.updateMatrixWorld(true);
  bone.attach(object);
}

function attachToBodySurface(
  root: T.Object3D,
  bone: T.Bone,
  object: T.Object3D,
  around: T.Vector3,
  offset = .0022,
) {
  const attachment = findFrontSurfaceAttachment(root, 'body', around);
  if (!attachment) {
    object.traverse(node => {
      if (!(node instanceof T.Mesh) && !(node instanceof T.Line)) return;
      node.geometry.dispose();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach(material => material.dispose());
    });
    return false;
  }
  attachSurfaceGraphic(root, bone, object, attachment, offset);
  return true;
}

function attachToFootSurface(
  root: T.Object3D,
  bone: T.Bone,
  object: T.Object3D,
  around: T.Vector3,
  yOffset = .012,
  offset = .002,
) {
  const attachment = findFrontSurfaceAttachment(root, 'feet', around, yOffset);
  if (!attachment) {
    object.traverse(node => {
      if (!(node instanceof T.Mesh) && !(node instanceof T.Line)) return;
      node.geometry.dispose();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach(material => material.dispose());
    });
    return false;
  }
  attachSurfaceGraphic(root, bone, object, attachment, offset);
  return true;
}

function laceMaterial(color: string) {
  return new T.MeshStandardMaterial({
    color,
    roughness: .86,
    metalness: 0,
  });
}

function addShoeLaces(
  root: T.Object3D,
  bones: Map<string, T.Bone>,
  quality: AvatarVisualQuality,
  rows: number,
  color: string,
  prefix: string,
) {
  const profile = avatarQualityProfile(quality);
  for (const side of ['L', 'R'] as const) {
    const foot = findBone(bones, [`Foot.${side}`, `Foot_${side}`, side === 'L' ? 'LeftFoot' : 'RightFoot']);
    if (!foot) continue;
    const base = foot.getWorldPosition(new T.Vector3());
    const group = new T.Group();
    group.name = `${prefix}-laces-${side.toLowerCase()}`;

    const width = .056;
    const spacing = .025;
    for (let row = 0; row < rows; row++) {
      const y = (row - (rows - 1) / 2) * spacing;
      for (const direction of [-1, 1] as const) {
        const from = new T.Vector3(direction * -width, y - spacing * .38, 0);
        const to = new T.Vector3(direction * width, y + spacing * .38, 0);
        const curve = new T.LineCurve3(from, to);
        const lace = new T.Mesh(
          new T.TubeGeometry(
            curve,
            quality === 'cinematic' ? 8 : quality === 'ultra' ? 6 : 4,
            .0025,
            Math.max(5, Math.floor(profile.accessorySegments / 3)),
            false,
          ),
          laceMaterial(color),
        );
        lace.name = `${prefix}-lace`;
        group.add(lace);
      }

      for (const x of [-width, width]) {
        const eyelet = new T.Mesh(
          new T.TorusGeometry(
            .006,
            .0018,
            Math.max(5, Math.floor(profile.accessorySegments / 3)),
            Math.max(10, profile.accessorySegments),
          ),
          metalMaterial('#aeb4bc'),
        );
        eyelet.name = `${prefix}-eyelet`;
        eyelet.position.set(x, y, .001);
        group.add(eyelet);
      }
    }

    attachToFootSurface(root, foot, group, base, rows >= 5 ? .035 : .018, .0025);
  }
}

function addSafetyPins(root: T.Object3D, bones: Map<string, T.Bone>, quality: AvatarVisualQuality) {
  const profile = avatarQualityProfile(quality);
  const chest = findBone(bones, ['Spine2','Spine.002','Chest','UpperChest']) ?? findBone(bones, ['Spine1','Spine.001']);
  if (!chest) return;
  const base = chest.getWorldPosition(new T.Vector3());
  for (const [x, y, angle] of [[-.11,.09,-.22],[.08,.03,.18],[-.03,-.08,.08]] as const) {
    const group = new T.Group();
    group.name = 'curated-safety-pin';
    const hoop = new T.Mesh(new T.TorusGeometry(.027, .004, Math.max(6, Math.floor(profile.accessorySegments / 2)), Math.max(20, profile.accessorySegments * 2), Math.PI * 1.72), metalMaterial());
    hoop.rotation.z = angle;
    group.add(hoop);
    const shaft = new T.Mesh(new T.CylinderGeometry(.0035, .0035, .052, Math.max(6, profile.accessorySegments)), metalMaterial());
    shaft.rotation.z = Math.PI/2 + angle;
    shaft.position.x = .017;
    group.add(shaft);
    const clasp = new T.Mesh(
      new T.SphereGeometry(.007, Math.max(8, profile.accessorySegments), Math.max(5, Math.floor(profile.accessorySegments / 2))),
      metalMaterial(),
    );
    clasp.name = 'curated-safety-pin-clasp';
    clasp.position.set(-.019, .003, .001);
    group.add(clasp);
    const point = new T.Mesh(
      new T.ConeGeometry(.0038, .014, Math.max(6, Math.floor(profile.accessorySegments / 2))),
      metalMaterial('#d4d7dc'),
    );
    point.name = 'curated-safety-pin-point';
    point.rotation.z = Math.PI / 2 + angle;
    point.position.set(.043, -.003, .001);
    group.add(point);
    attachToBodySurface(root, chest, group, base.clone().add(new T.Vector3(x, y, 0)), .0025);
  }
}

function addPatchJacketDetails(root: T.Object3D, bones: Map<string, T.Bone>, quality: AvatarVisualQuality) {
  const profile = avatarQualityProfile(quality);
  const chest = findBone(bones, ['Spine2','Spine.002','Chest','UpperChest']) ?? findBone(bones, ['Spine1','Spine.001']);
  if (!chest) return;
  const base = chest.getWorldPosition(new T.Vector3());
  const patches = [
    { x:-.115, y:.08, w:.09, h:.07, color:'#b52f3f', rot:-.08 },
    { x:.105, y:.035, w:.075, h:.075, color:'#d8ad49', rot:.12 },
    { x:-.035, y:-.09, w:.12, h:.055, color:'#426baa', rot:.04 },
  ];
  for (const patch of patches) {
    const group = new T.Group();
    group.name = 'curated-jacket-patch';
    group.rotation.z = patch.rot;
    const mesh = new T.Mesh(curvedGraphicGeometry(patch.w, patch.h, .0035), clothMaterial(patch.color));
    mesh.name = 'curated-jacket-patch-cloth';
    group.add(mesh);
    const stitchMaterial = new T.LineBasicMaterial({ color: '#e7dfd2', transparent: true, opacity: .78 });
    const stitches = new T.LineLoop(patchStitchGeometry(patch.w, patch.h), stitchMaterial);
    stitches.name = 'curated-jacket-patch-stitching';
    group.add(stitches);
    attachToBodySurface(root, chest, group, base.clone().add(new T.Vector3(patch.x, patch.y, 0)), .0028);
  }
  for (const x of [-.15,-.10,-.05,.05,.10,.15]) {
    const stud = new T.Mesh(new T.ConeGeometry(.009, .018, Math.max(6, profile.accessorySegments)), metalMaterial('#c1c5ca'));
    stud.name='curated-jacket-stud';
    stud.rotation.x=Math.PI/2;
    attachToBodySurface(root, chest, stud, base.clone().add(new T.Vector3(x, .15, 0)), .003);
  }
}

function addBikerJacketHardware(root: T.Object3D, bones: Map<string, T.Bone>, quality: AvatarVisualQuality) {
  const profile = avatarQualityProfile(quality);
  const chest = findBone(bones, ['Spine2','Spine.002','Chest','UpperChest']) ?? findBone(bones, ['Spine1','Spine.001']);
  if (!chest) return;
  const base = chest.getWorldPosition(new T.Vector3());

  const zipper = new T.Group();
  zipper.name = 'curated-biker-zipper-pull';
  const slider = new T.Mesh(
    new T.BoxGeometry(.014, .026, .006),
    metalMaterial('#b9bec6'),
  );
  slider.name = 'curated-biker-zipper-slider';
  zipper.add(slider);
  const pull = new T.Mesh(
    new T.TorusGeometry(
      .012,
      .0024,
      Math.max(6, Math.floor(profile.accessorySegments / 3)),
      Math.max(16, profile.accessorySegments),
    ),
    metalMaterial('#c8ccd2'),
  );
  pull.name = 'curated-biker-zipper-ring';
  pull.position.y = -.024;
  zipper.add(pull);
  attachToBodySurface(root, chest, zipper, base.clone().add(new T.Vector3(0, -.025, 0)), .0032);

  for (const [x, y] of [[-.115,.105],[.115,.105],[-.145,.02],[.145,.02]] as const) {
    const snap = new T.Mesh(
      new T.CylinderGeometry(
        .008,
        .008,
        .004,
        Math.max(10, profile.accessorySegments),
      ),
      metalMaterial('#c3c7cd'),
    );
    snap.name = 'curated-biker-lapel-snap';
    snap.rotation.x = Math.PI / 2;
    attachToBodySurface(root, chest, snap, base.clone().add(new T.Vector3(x, y, 0)), .003);
  }
}

function addEyeletBelt(root: T.Object3D, bones: Map<string, T.Bone>, quality: AvatarVisualQuality) {
  const profile = avatarQualityProfile(quality);
  const hips = findBone(bones,['Hips','Pelvis']);
  if (!hips) return;
  const base = hips.getWorldPosition(new T.Vector3());
  const belt = new T.Mesh(new T.TorusGeometry(.205, .018, Math.max(8, Math.floor(profile.accessorySegments / 2)), Math.max(32, profile.accessorySegments * 2)), clothMaterial('#111111'));
  belt.name='curated-double-eyelet-belt';
  belt.rotation.x=Math.PI/2;
  belt.scale.z=.62;
  attachAtWorld(root,hips,belt,base.clone().add(new T.Vector3(0,.055,0)));
  for (let i=0;i<8;i++) {
    const angle=(i/8)*Math.PI*2;
    for (const row of [-.009,.009]) {
      const eyelet=new T.Mesh(new T.TorusGeometry(.006, .0025, Math.max(5, Math.floor(profile.accessorySegments / 3)), Math.max(12, profile.accessorySegments)),metalMaterial());
      eyelet.name='curated-belt-eyelet';
      eyelet.position.set(Math.cos(angle)*.195,row,Math.sin(angle)*.12);
      eyelet.rotation.x=Math.PI/2;
      belt.add(eyelet);
    }
  }
}

function addWristCuffs(root: T.Object3D, bones: Map<string, T.Bone>, quality: AvatarVisualQuality) {
  const profile = avatarQualityProfile(quality);
  for (const side of ['L','R'] as const) {
    const hand=findBone(bones,[`Hand.${side}`,`Hand_${side}`,`Wrist.${side}`,`Wrist_${side}`]);
    if(!hand) continue;
    const base=hand.getWorldPosition(new T.Vector3());
    const cuff=new T.Mesh(new T.CylinderGeometry(.055, .06, .052, Math.max(12, profile.accessorySegments)),clothMaterial('#111111'));
    cuff.name=`curated-wrist-cuff-${side.toLowerCase()}`;
    attachAtWorld(root,hand,cuff,base.clone().add(new T.Vector3(0,.03,0)));
    for(let i=0;i<6;i++){
      const angle=(i/6)*Math.PI*2;
      const stud=new T.Mesh(new T.ConeGeometry(.007, .015, Math.max(5, Math.floor(profile.accessorySegments / 2))),metalMaterial());
      stud.position.set(Math.cos(angle)*.056,0,Math.sin(angle)*.056);
      stud.rotation.x=Math.PI/2;
      cuff.add(stud);
    }
  }
}

/**
 * Base print slot for every curated top: any front "graphic", "text", "decal" or uploaded
 * image layer in the item's detail_layers is drawn onto the chest, so admins can add logos
 * or wording to a base garment without new 3D work.
 */
function addCuratedFrontPrint(root: T.Object3D, bones: Map<string, T.Bone>, row: ResolvedEquippedClothing) {
  const layers = Array.isArray(row.item.detail_layers) ? row.item.detail_layers : [];
  if (!layers.length) return;
  const texture = buildCompositeGarmentSurfaceTexture(layers, 'front', 512);
  if (!texture) return;
  const chest = findBone(bones, ['Spine2','Spine.002','Chest','UpperChest']) ?? findBone(bones, ['Spine1','Spine.001']);
  if (!chest) { texture.dispose(); return; }
  const material = new T.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: .04, roughness: .88, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const print = new T.Mesh(curvedGraphicGeometry(.3, .3, .02), material);
  print.name = `curated-front-print-${row.item.id}`;
  print.renderOrder = 2;
  const base = chest.getWorldPosition(new T.Vector3());
  attachToBodySurface(root, chest, print, base.clone().add(new T.Vector3(0, .02, 0)), .003);
}

function stripeTexture(colors: string[], bands: number) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const h = canvas.height / bands;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(0, i * h, canvas.width, Math.ceil(h));
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

/** Horizontal mod stripes across the chest, sitting just behind the front print. */
function addModStripes(root: T.Object3D, bones: Map<string, T.Bone>) {
  const chest = findBone(bones, ['Spine2','Spine.002','Chest','UpperChest']) ?? findBone(bones, ['Spine1','Spine.001']);
  if (!chest) return;
  const texture = stripeTexture(['#f4f1e8', '#1f3c8f', '#f4f1e8', '#c8102e'], 8);
  if (!texture) return;
  const material = new T.MeshStandardMaterial({ map: texture, roughness: .9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1 });
  const panel = new T.Mesh(curvedGraphicGeometry(.4, .24, .03), material);
  panel.name = 'curated-mod-stripes';
  panel.renderOrder = 1;
  const base = chest.getWorldPosition(new T.Vector3());
  attachToBodySurface(root, chest, panel, base.clone().add(new T.Vector3(0, -.03, 0)), .0015);
}

/** Parka details: front zip, fur-trimmed hood ring and two flap pockets. */
function addParkaDetails(root: T.Object3D, bones: Map<string, T.Bone>) {
  const chest = findBone(bones, ['Spine2','Spine.002','Chest','UpperChest']);
  const waist = findBone(bones, ['Spine','Spine1','Spine.001']);
  const neck = findBone(bones, ['Neck']);
  const zipMat = new T.MeshStandardMaterial({ color: '#2b2a24', roughness: .5, metalness: .6 });
  const pocketMat = new T.MeshStandardMaterial({ color: '#4a5232', roughness: .95 });
  if (chest) {
    const base = chest.getWorldPosition(new T.Vector3());
    const zip = new T.Mesh(curvedGraphicGeometry(.018, .42, .01), zipMat);
    zip.name = 'curated-parka-zip';
    attachToBodySurface(root, chest, zip, base.clone().add(new T.Vector3(0, -.08, 0)), .004);
  }
  if (waist) {
    const base = waist.getWorldPosition(new T.Vector3());
    for (const x of [-.09, .09]) {
      const pocket = new T.Mesh(curvedGraphicGeometry(.11, .08, .01), pocketMat);
      pocket.name = 'curated-parka-pocket';
      attachToBodySurface(root, waist, pocket, base.clone().add(new T.Vector3(x, -.02, 0)), .005);
    }
  }
  if (neck) {
    const hood = new T.Mesh(new T.TorusGeometry(.085, .022, 8, 20), new T.MeshStandardMaterial({ color: '#b9ab8e', roughness: 1 }));
    hood.name = 'curated-parka-hood-trim';
    hood.rotation.x = Math.PI / 2.4;
    hood.position.set(0, -.02, -.02);
    neck.add(hood);
  }
}

export function addCuratedSkinDetails(
  root: T.Object3D,
  bones: Map<string, T.Bone>,
  clothing: ResolvedEquippedClothing[],
  quality: AvatarVisualQuality = 'balanced',
) {
  const keys = new Set(clothing
    .filter(row => row.item.curated_asset_status === 'published')
    .map(row => row.item.curated_asset_key)
    .filter(Boolean));
  clothing
    .filter(row => richGarmentSlot(row.item) === 'top' && row.item.curated_asset_key && row.item.curated_asset_key !== 'clothing.starter.logo-tee' && row.item.render_config?.curatedSource)
    .forEach(row => addCuratedFrontPrint(root, bones, row));
  // Mod stripes overlay removed: it floated off the donor body. Stripes return with the uploaded tee model.
  if (keys.has('clothing.britpop.terrace-parka')) addParkaDetails(root, bones);
  if (keys.has('clothing.punk.safety-pin-tee')) addSafetyPins(root, bones, quality);
  if (keys.has('clothing.punk.patch-jacket')) addPatchJacketDetails(root, bones, quality);
  if (keys.has('clothing.punk.biker-jacket')) addBikerJacketHardware(root, bones, quality);
  if (keys.has('clothing.starter.canvas-trainers')) addShoeLaces(root, bones, quality, 3, '#e7e1d8', 'curated-trainer');
  if (keys.has('clothing.punk.combat-boots')) addShoeLaces(root, bones, quality, 6, '#262626', 'curated-combat-boot');
  if (keys.has('clothing.punk.double-eyelet-belt')) addEyeletBelt(root, bones, quality);
  if (keys.has('clothing.punk.wrist-cuffs')) addWristCuffs(root, bones, quality);
}
