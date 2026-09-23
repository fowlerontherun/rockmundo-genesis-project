import * as T from 'three';
import type { ResolvedEquippedClothing } from './equippedClothing';

const clean = (value: string) => value.replace(/[_.]/g, '').toLowerCase();

function findBone(bones: Map<string, T.Bone>, names: string[]) {
  for (const bone of bones.values()) {
    if (names.some(name => clean(bone.name) === clean(name))) return bone;
  }
}

function metalMaterial(color = '#a7adb5') {
  return new T.MeshStandardMaterial({ color, roughness: .34, metalness: .82 });
}

function clothMaterial(color: string) {
  return new T.MeshStandardMaterial({ color, roughness: .9, metalness: 0, side: T.DoubleSide });
}

function attachAtWorld(root: T.Object3D, bone: T.Bone, object: T.Object3D, position: T.Vector3) {
  root.add(object);
  object.position.copy(position);
  root.updateMatrixWorld(true);
  bone.attach(object);
}

function addSafetyPins(root: T.Object3D, bones: Map<string, T.Bone>) {
  const chest = findBone(bones, ['Spine2','Spine.002','Chest','UpperChest']) ?? findBone(bones, ['Spine1','Spine.001']);
  if (!chest) return;
  const base = chest.getWorldPosition(new T.Vector3());
  for (const [x, y, angle] of [[-.11,.09,-.22],[.08,.03,.18],[-.03,-.08,.08]] as const) {
    const group = new T.Group();
    group.name = 'curated-safety-pin';
    const hoop = new T.Mesh(new T.TorusGeometry(.027,.004,6,20,Math.PI*1.72), metalMaterial());
    hoop.rotation.z = angle;
    group.add(hoop);
    const shaft = new T.Mesh(new T.CylinderGeometry(.0035,.0035,.052,6), metalMaterial());
    shaft.rotation.z = Math.PI/2 + angle;
    shaft.position.x = .017;
    group.add(shaft);
    attachAtWorld(root, chest, group, base.clone().add(new T.Vector3(x,y,.166)));
  }
}

function addPatchJacketDetails(root: T.Object3D, bones: Map<string, T.Bone>) {
  const chest = findBone(bones, ['Spine2','Spine.002','Chest','UpperChest']) ?? findBone(bones, ['Spine1','Spine.001']);
  if (!chest) return;
  const base = chest.getWorldPosition(new T.Vector3());
  const patches = [
    { x:-.115, y:.08, w:.09, h:.07, color:'#b52f3f', rot:-.08 },
    { x:.105, y:.035, w:.075, h:.075, color:'#d8ad49', rot:.12 },
    { x:-.035, y:-.09, w:.12, h:.055, color:'#426baa', rot:.04 },
  ];
  for (const patch of patches) {
    const mesh = new T.Mesh(new T.BoxGeometry(patch.w,patch.h,.006), clothMaterial(patch.color));
    mesh.name = 'curated-jacket-patch';
    mesh.rotation.z = patch.rot;
    attachAtWorld(root, chest, mesh, base.clone().add(new T.Vector3(patch.x,patch.y,.172)));
  }
  for (const x of [-.15,-.10,-.05,.05,.10,.15]) {
    const stud = new T.Mesh(new T.ConeGeometry(.009,.018,6), metalMaterial('#c1c5ca'));
    stud.name='curated-jacket-stud';
    stud.rotation.x=Math.PI/2;
    attachAtWorld(root,chest,stud,base.clone().add(new T.Vector3(x,.15,.18)));
  }
}

function addEyeletBelt(root: T.Object3D, bones: Map<string, T.Bone>) {
  const hips = findBone(bones,['Hips','Pelvis']);
  if (!hips) return;
  const base = hips.getWorldPosition(new T.Vector3());
  const belt = new T.Mesh(new T.TorusGeometry(.205,.018,8,32), clothMaterial('#111111'));
  belt.name='curated-double-eyelet-belt';
  belt.rotation.x=Math.PI/2;
  belt.scale.z=.62;
  attachAtWorld(root,hips,belt,base.clone().add(new T.Vector3(0,.055,0)));
  for (let i=0;i<8;i++) {
    const angle=(i/8)*Math.PI*2;
    for (const row of [-.009,.009]) {
      const eyelet=new T.Mesh(new T.TorusGeometry(.006,.0025,5,12),metalMaterial());
      eyelet.name='curated-belt-eyelet';
      eyelet.position.set(Math.cos(angle)*.195,row,Math.sin(angle)*.12);
      eyelet.rotation.x=Math.PI/2;
      belt.add(eyelet);
    }
  }
}

function addWristCuffs(root: T.Object3D, bones: Map<string, T.Bone>) {
  for (const side of ['L','R'] as const) {
    const hand=findBone(bones,[`Hand.${side}`,`Hand_${side}`,`Wrist.${side}`,`Wrist_${side}`]);
    if(!hand) continue;
    const base=hand.getWorldPosition(new T.Vector3());
    const cuff=new T.Mesh(new T.CylinderGeometry(.055,.06,.052,12),clothMaterial('#111111'));
    cuff.name=`curated-wrist-cuff-${side.toLowerCase()}`;
    attachAtWorld(root,hand,cuff,base.clone().add(new T.Vector3(0,.03,0)));
    for(let i=0;i<6;i++){
      const angle=(i/6)*Math.PI*2;
      const stud=new T.Mesh(new T.ConeGeometry(.007,.015,5),metalMaterial());
      stud.position.set(Math.cos(angle)*.056,0,Math.sin(angle)*.056);
      stud.rotation.x=Math.PI/2;
      cuff.add(stud);
    }
  }
}

export function addCuratedSkinDetails(
  root: T.Object3D,
  bones: Map<string, T.Bone>,
  clothing: ResolvedEquippedClothing[],
) {
  const keys = new Set(clothing
    .filter(row => row.item.curated_asset_status === 'published')
    .map(row => row.item.curated_asset_key)
    .filter(Boolean));
  if (keys.has('clothing.punk.safety-pin-tee')) addSafetyPins(root,bones);
  if (keys.has('clothing.punk.patch-jacket')) addPatchJacketDetails(root,bones);
  if (keys.has('clothing.punk.double-eyelet-belt')) addEyeletBelt(root,bones);
  if (keys.has('clothing.punk.wrist-cuffs')) addWristCuffs(root,bones);
}
