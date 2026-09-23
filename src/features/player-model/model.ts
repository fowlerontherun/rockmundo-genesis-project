import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { demoAssetUrl } from '@/features/gig-demo-3d/assets';
import { headModelStyle, equipmentItem, equipmentStyle, modelFile, type PlayerAppearance } from './appearance';

import { addHair, isScalpHair } from './hair';
import { addAccessories } from './accessories';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import { richGarmentSlot } from '@/features/clothing-preview/richGarmentVisuals';
import { curatedDonorForSlot } from '@/features/clothing-preview/curatedDonorGarments';
import { addCuratedSkinDetails } from '@/features/clothing-preview/curatedSkinDetails';
import { addFaceDetails, skinRoughness } from './faceDetails';
import { addTattoos, type ResolvedTattooVisual } from './tattoos';
import { fabricTexture, fabricUVs } from './fabrics';

export type ModelLibrary = Map<string, T.Object3D>;
export function requiredModelFiles(appearances: PlayerAppearance[]) {
  return [...new Set(appearances.flatMap(a => [headModelStyle(a), ...(['top', 'bottom', 'footwear'] as const).map(slot => equipmentStyle(a, slot))].map(style => modelFile(a.body.frame, style))))];
}
export async function loadModelLibrary(files: string[], manager?: T.LoadingManager): Promise<ModelLibrary> {
  const loader = new GLTFLoader(manager), library: ModelLibrary = new Map();
  // Wait for every in-flight asset before releasing on failure.
  const results = await Promise.allSettled([...new Set(files)].map(async file => { const gltf = await loader.loadAsync(demoAssetUrl(file)); library.set(file, gltf.scene); }));
  const failed = results.find(result => result.status === 'rejected');
  if (failed?.status === 'rejected') { library.forEach(disposeModel); throw failed.reason; }
  return library;
}

const cleanBoneName = (value: string) => value.replace(/[_.]/g, '').toLowerCase();
function findPlayerBone(bones: Map<string, T.Bone>, names: string[]) {
  for (const bone of bones.values()) if (names.some(name => cleanBoneName(bone.name) === cleanBoneName(name))) return bone;
}

function rockmundoWordmarkTexture() {
  const glyphs: Record<string, string[]> = {
    R:['110','101','110','101','101'], O:['111','101','101','101','111'], C:['111','100','100','100','111'],
    K:['101','101','110','101','101'], M:['101','111','111','101','101'], U:['101','101','101','101','111'],
    N:['101','111','111','111','101'], D:['110','101','101','101','110'],
  };
  const word='ROCKMUNDO', scale=2, gap=1, glyphW=3, glyphH=5;
  const width=(word.length*(glyphW+gap)-gap)*scale, height=glyphH*scale;
  const data=new Uint8Array(width*height*4);
  for(let i=0;i<word.length;i++) {
    const glyph=glyphs[word[i]];
    for(let y=0;y<glyphH;y++) for(let x=0;x<glyphW;x++) if(glyph[y][x]==='1') {
      for(let sy=0;sy<scale;sy++) for(let sx=0;sx<scale;sx++) {
        const px=(i*(glyphW+gap)+x)*scale+sx, py=(glyphH-1-y)*scale+sy, index=(py*width+px)*4;
        data[index]=238; data[index+1]=232; data[index+2]=219; data[index+3]=255;
      }
    }
  }
  const texture=new T.DataTexture(data,width,height,T.RGBAFormat);
  texture.name='RockmundoWordmark'; texture.colorSpace=T.SRGBColorSpace; texture.magFilter=T.NearestFilter; texture.minFilter=T.LinearFilter; texture.needsUpdate=true;
  return texture;
}

function addStarterLogoTee(root: T.Object3D, appearance: PlayerAppearance, bones: Map<string, T.Bone>, richClothing: ResolvedEquippedClothing[]) {
  const curatedLogo = richClothing.some(row => row.item.curated_asset_key === 'clothing.starter.logo-tee');
  const hasOtherTop = richClothing.some(row => richGarmentSlot(row.item) === 'top' && row.item.curated_asset_key !== 'clothing.starter.logo-tee');
  if (!curatedLogo && (appearance.equipment.top.itemId !== 'starter.top.casual' || hasOtherTop)) return;
  const chest=findPlayerBone(bones,['Spine2','Spine.002','Chest','UpperChest']) ?? findPlayerBone(bones,['Spine1','Spine.001']);
  if(!chest) return;
  root.updateMatrixWorld(true);
  const texture=rockmundoWordmarkTexture();
  const material=new T.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.08,roughness:.78,metalness:0,side:T.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  material.name='RockmundoLogoPrint';
  const mark=new T.Mesh(new T.PlaneGeometry(.34,.072),material);
  mark.name='avatar-rockmundo-logo';
  mark.position.copy(chest.getWorldPosition(new T.Vector3())).add(new T.Vector3(0,.02,.155));
  root.add(mark); root.updateMatrixWorld(true); chest.attach(mark);
}

/** Each part keeps its donor inverse binds and local transform. This matters for
 * the small body offset in the original casual/suit assets. Rig families never mix. */
export function assemblePlayerModel(library: ModelLibrary, appearance: PlayerAppearance, tattoos: ResolvedTattooVisual[] = [], richClothing: ResolvedEquippedClothing[] = []): T.Object3D {
  const source = (style: Parameters<typeof modelFile>[1]) => {
    const model = library.get(modelFile(appearance.body.frame, style));
    if (!model) throw new Error('The selected character model could not load.');
    return model;
  };
  const result = clone(source(headModelStyle(appearance)));
  const bones = new Map<string, T.Bone>(), remove: T.Object3D[] = [];
  result.traverse(node => { if (node instanceof T.Bone) bones.set(node.name, node); if (node instanceof T.SkinnedMesh) remove.push(node); });
  remove.forEach(node => { const parent = node.parent; node.removeFromParent(); if (parent && parent.children.length === 0 && /_(body|head|legs|feet)$/i.test(parent.name)) parent.removeFromParent(); });
  // The women's export has independent foot controls. Our shared two-bone leg
  // solver requires a connected FK chain; attach preserves the rest world pose
  // and hence the original inverse binds, including the meshes' foot weights.
  if (appearance.body.frame === 'feminine') {
    result.updateMatrixWorld(true);
    for (const side of ['L', 'R']) {
      const bone = (name: string) => [...bones.values()].find(value => value.name.replace(/[_.]/g, '') === `${name}${side}`);
      const lower = bone('LowerLeg'), foot = bone('Foot');
      if (lower && foot && foot.parent !== lower) lower.attach(foot);
    }
  }
  const curatedTop = curatedDonorForSlot(richClothing, 'top');
  const curatedBottom = curatedDonorForSlot(richClothing, 'bottom');
  const curatedFootwear = curatedDonorForSlot(richClothing, 'footwear');
  const choices = [
    { part: 'head', style: headModelStyle(appearance), dye: appearance.head.hair, fabric: 'plain' as const },
    {
      part: 'body',
      style: curatedTop?.source.style ?? equipmentStyle(appearance, 'top'),
      dye: curatedTop?.source.color ?? appearance.equipment.top.color,
      fabric: curatedTop?.source.fabric ?? equipmentItem(appearance, 'top').fabric,
    },
    {
      part: 'legs',
      style: curatedBottom?.source.style ?? equipmentStyle(appearance, 'bottom'),
      dye: curatedBottom?.source.color ?? appearance.equipment.bottom.color,
      fabric: curatedBottom?.source.fabric ?? equipmentItem(appearance, 'bottom').fabric,
    },
    {
      part: 'feet',
      style: curatedFootwear?.source.style ?? equipmentStyle(appearance, 'footwear'),
      dye: curatedFootwear?.source.color ?? appearance.equipment.footwear.color,
      fabric: curatedFootwear?.source.fabric ?? equipmentItem(appearance, 'footwear').fabric,
    },
  ];
  for (const choice of choices) {
    const matches = (node: T.Object3D) => !(node instanceof T.Bone) && new RegExp(`_${choice.part}(?:_|$)`, 'i').test(node.name);
    const containers: T.Object3D[] = [];
    source(choice.style).traverse(node => { if (matches(node) && (!node.parent || !matches(node.parent))) containers.push(node); });
    if (!containers.length) throw new Error(`Missing character part: ${choice.part}`);
    for (const container of containers) {
      const part = container.clone(true), removeHair: T.Object3D[] = [];
      part.traverse(clonedNode => {
        if (!(clonedNode instanceof T.SkinnedMesh)) return;
        const original = (container === clonedNode ? container : container.getObjectByName(clonedNode.name)) as T.SkinnedMesh;
        if (!original?.isSkinnedMesh) throw new Error('Incompatible character geometry');
        clonedNode.geometry = original.geometry.clone();
        if (choice.fabric !== 'plain') fabricUVs(clonedNode.geometry, choice.part === 'feet');
        const dyeMaterial = (originalMaterial: T.Material) => {
          const material = originalMaterial.clone() as T.MeshStandardMaterial;
          if (!material.isMeshStandardMaterial) return material;
          const name = material.name.toLowerCase();
          material.roughness = /skin/.test(name) ? skinRoughness(appearance) : .84;
          material.metalness = /earring|metal/.test(name) ? .65 : 0;
          if (/skin/.test(name)) material.color.set(appearance.body.skin);
          else if (choice.part === 'head') {
            // The source rigs use slightly different material names. Keep iris,
            // brows and hair independently tintable while preserving eye whites.
            const isFeminineIris = appearance.body.frame === 'feminine' && name === 'brown';
            if (/iris|pupil/.test(name) || isFeminineIris) material.color.set(appearance.head.eyeColor ?? '#65442d');
            else if (/eyebrow|brow|hair_brown/.test(name)) material.color.set(appearance.head.eyebrowColor ?? appearance.head.hair);
            else if (/hair|pink|red/.test(name)) material.color.set(appearance.head.hair);
          } else if (!/earring|metal/.test(name) && !(name === 'white' && (choice.style !== 'casual' || choice.part === 'feet'))) {
            material.color.set(choice.dye);
            if (choice.fabric !== 'plain') {
              material.map = fabricTexture(choice.fabric);
              material.roughness = choice.fabric === 'patent' ? .2 : choice.fabric === 'canvas' || choice.fabric === 'denim' ? .95 : .84;
            }
          }
          return material;
        };
        if (choice.part === 'head' && appearance.head.hairStyle && appearance.head.hairStyle !== 'original' && !Array.isArray(original.material) && isScalpHair(original.material, appearance.body.frame)) removeHair.push(clonedNode);
        clonedNode.material = Array.isArray(original.material) ? original.material.map(dyeMaterial) : dyeMaterial(original.material);
        const boundBones = original.skeleton.bones.map(bone => {
          const match = bones.get(bone.name); if (!match) throw new Error(`Incompatible character part: ${bone.name}`); return match;
        });
        clonedNode.bind(new T.Skeleton(boundBones, original.skeleton.boneInverses.map(matrix => matrix.clone())), original.bindMatrix.clone());
      });
      removeHair.forEach(disposeModel);
      const parent = container.parent?.name ? result.getObjectByName(container.parent.name) : result;
      (parent ?? result).add(part);
    }
  }
  // Punk trousers were authored to meet tall boots. A skinned calf beneath
  // them closes the exposed ankle when a player equips low shoes instead.
  if (appearance.body.frame === 'feminine' && equipmentStyle(appearance, 'bottom') === 'punk' && equipmentStyle(appearance, 'footwear') !== 'punk') {
    result.updateMatrixWorld(true);
    for (const side of ['L', 'R']) {
      const bone = (name: string) => [...bones.values()].find(value => value.name.replace(/[_.]/g, '') === `${name}${side}`);
      const lower = bone('LowerLeg'), foot = bone('Foot'); if (!lower || !foot) continue;
      const start = lower.getWorldPosition(new T.Vector3()), end = foot.getWorldPosition(new T.Vector3());
      const geometry = new T.CylinderGeometry(.058, .039, start.distanceTo(end), 12, 3);
      geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), start.clone().sub(end).normalize()));
      geometry.translate(...start.clone().add(end).multiplyScalar(.5).toArray());
      const count = geometry.attributes.position.count, weights = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) weights[i * 4] = 1;
      geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(new Uint16Array(count * 4), 4)); geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
      const material = new T.MeshStandardMaterial({ color: appearance.body.skin, roughness: .69 }); material.name = 'Skin';
      const calf = new T.SkinnedMesh(geometry, material); calf.name = `Punk_Legs_SkinBacking_${side}`;
      result.add(calf); calf.bind(new T.Skeleton([lower], [lower.matrixWorld.clone().invert()]), new T.Matrix4());
    }
  }
  const headBone = bones.get('Head');
  if (headBone) {
    addFaceDetails(result, appearance, headBone);
    addHair(result, appearance, headBone);
    addAccessories(result, appearance, headBone, richClothing);
  }
  addStarterLogoTee(result, appearance, bones, richClothing);
  addCuratedSkinDetails(result, bones, richClothing);
  addTattoos(result, tattoos, bones);
  result.updateMatrixWorld(true);
  return result;
}

export function disposeModel(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>(), skeletons = new Set<T.Skeleton>();
  root.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(material); Object.values(material).forEach(value => { if (value instanceof T.Texture) textures.add(value); });
    }
    if (node instanceof T.SkinnedMesh) skeletons.add(node.skeleton);
  });
  geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose()); skeletons.forEach(value => value.dispose());
  root.removeFromParent(); root.clear();
}
