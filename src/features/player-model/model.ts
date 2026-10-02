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
import { fabricNormalTexture, fabricTexture, fabricUVs } from './fabrics';
import { curatedAlbedoTexture, curatedBumpScale, curatedNormalTexture, curatedReliefTexture, curatedRoughnessTexture, curatedTartanTexture, curatedTextureForQuality, type CuratedFinish } from './curatedSurfaceMaps';
import { attachSurfaceGraphic, curvedGraphicGeometry, findFrontSurfaceAttachment } from './curatedSurfaceAttachment';
import { applyCuratedMacroShading } from './curatedMacroShading';
import { curatedMaterialProfile } from './curatedMaterialProfile';
import { applyAvatarEyeQuality, applyAvatarHairQuality, applyAvatarSkinQuality, createAvatarHairTextureCache, createAvatarSkinTextureCache } from './avatarMaterialQuality';
import type { AvatarVisualQuality } from './avatarVisualQuality';
import { applyAvatarSkinMacroShading } from './avatarSkinMacroShading';
import { createCorneaOverlay, upgradeCuratedGarmentMaterial, upgradeSkinMaterial, upgradeStarterFabricMaterial } from './avatarPhysicalMaterials';
import { buildProceduralGarment, type GarmentRigAnchor } from '@/features/clothing-preview/proceduralGarmentRenderer';
import type { ClothingItem } from '@/hooks/useSkinStore';

export type ModelLibrary = Map<string, T.Object3D>;
export type PlayerModelPresentation = 'stage' | 'tattoo';
export function requiredModelFiles(appearances: PlayerAppearance[]) {
  return [...new Set(appearances.flatMap(a => [headModelStyle(a), ...(['top', 'bottom', 'footwear'] as const).map(slot => equipmentStyle(a, slot))].map(style => modelFile(a.body.frame, style))))];
}
export async function loadModelLibrary(files: string[], manager?: T.LoadingManager): Promise<ModelLibrary> {
  const loader = new GLTFLoader(manager), library: ModelLibrary = new Map();
  // Wait for every in-flight asset before releasing on failure.
  const results = await Promise.allSettled([...new Set(files)].map(async file => {
    const url = demoAssetUrl(file);
    const gltf = await loader.loadAsync(url);
    library.set(file, gltf.scene);
  }));
  const failed = results.find(result => result.status === 'rejected');
  if (failed?.status === 'rejected') { library.forEach(disposeModel); throw failed.reason; }
  return library;
}

const cleanBoneName = (value: string) => value.replace(/[_.]/g, '').toLowerCase();
function findPlayerBone(bones: Map<string, T.Bone>, names: string[]) {
  for (const bone of bones.values()) if (names.some(name => cleanBoneName(bone.name) === cleanBoneName(name))) return bone;
}

function polishV1CrewTeeGeometry(mesh: T.SkinnedMesh, materials: T.Material[]) {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position') as T.BufferAttribute | undefined;
  const skinIndex = geometry.getAttribute('skinIndex') as T.BufferAttribute | undefined;
  const skinWeight = geometry.getAttribute('skinWeight') as T.BufferAttribute | undefined;
  if (!position || !skinIndex || !skinWeight || !geometry.groups.length || !materials.length) return;

  const garmentMaterialIndices = new Set<number>();
  materials.forEach((material, index) => {
    const name = material.name.toLowerCase();
    if (!/skin|eye|earring|metal|hair/.test(name)) garmentMaterialIndices.add(index);
  });
  if (!garmentMaterialIndices.size) return;

  const garmentVertices = new Set<number>();
  const index = geometry.index;
  for (const group of geometry.groups) {
    if (!garmentMaterialIndices.has(group.materialIndex ?? 0)) continue;
    const end = group.start + group.count;
    for (let i = group.start; i < end; i += 1) {
      garmentVertices.add(index ? index.getX(i) : i);
    }
  }
  if (!garmentVertices.size) return;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const vertex of garmentVertices) {
    const x = position.getX(vertex), y = position.getY(vertex), z = position.getZ(vertex);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  const centreX = (minX + maxX) * .5;
  const centreZ = (minZ + maxZ) * .5;
  const height = Math.max(.001, maxY - minY);
  let sleeveVertices = 0;

  for (const vertex of garmentVertices) {
    const y = position.getY(vertex);
    const yNorm = (y - minY) / height;
    let armWeight = 0;
    for (let channel = 0; channel < 4; channel += 1) {
      const weight = skinWeight.getComponent(vertex, channel);
      if (weight <= 0) continue;
      const boneIndex = skinIndex.getComponent(vertex, channel);
      const boneName = mesh.skeleton.bones[boneIndex]?.name ?? '';
      if (/upperarm/i.test(boneName)) armWeight += weight;
    }

    const x = position.getX(vertex);
    const z = position.getZ(vertex);
    // Keep the proven donor skinning but make the casual body read as a fitted
    // short-sleeve crew tee rather than the bulkier source top. These are small
    // bind-space edits only; no bones, weights or inverse binds are replaced.
    const torsoXScale = yNorm < .24 ? .94 : .965;
    const topDepthScale = yNorm > .68 ? .86 : .93;
    const xScale = armWeight > .42 ? .84 : torsoXScale;
    const zScale = armWeight > .42 ? .89 : topDepthScale;
    if (armWeight > .42) sleeveVertices += 1;
    position.setXYZ(
      vertex,
      centreX + (x - centreX) * xScale,
      y,
      centreZ + (z - centreZ) * zScale,
    );
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.userData.avatarV1CrewTeePolished = true;
  mesh.userData.avatarV1CrewTeeVertexCount = garmentVertices.size;
  mesh.userData.avatarV1CrewTeeSleeveVertexCount = sleeveVertices;
}

function rockmundoWordmarkTexture() {
  const glyphs: Record<string, string[]> = {
    R:['11110','10001','10001','11110','10100','10010','10001'],
    O:['01110','10001','10001','10001','10001','10001','01110'],
    C:['01111','10000','10000','10000','10000','10000','01111'],
    K:['10001','10010','10100','11000','10100','10010','10001'],
    M:['10001','11011','10101','10101','10001','10001','10001'],
    U:['10001','10001','10001','10001','10001','10001','01110'],
    N:['10001','11001','11001','10101','10011','10011','10001'],
    D:['11110','10001','10001','10001','10001','10001','11110'],
  };
  const word='ROCKMUNDO', scale=4, gap=1, glyphW=5, glyphH=7;
  const width=(word.length*(glyphW+gap)-gap)*scale, height=glyphH*scale;
  const data=new Uint8Array(width*height*4);
  for(let i=0;i<word.length;i++) {
    const glyph=glyphs[word[i]];
    for(let y=0;y<glyphH;y++) for(let x=0;x<glyphW;x++) if(glyph[y][x]==='1') {
      for(let sy=0;sy<scale;sy++) for(let sx=0;sx<scale;sx++) {
        const px=(i*(glyphW+gap)+x)*scale+sx, py=(glyphH-1-y)*scale+sy, index=(py*width+px)*4;
        data[index]=244; data[index+1]=239; data[index+2]=226; data[index+3]=255;
      }
    }
  }
  const texture=new T.DataTexture(data,width,height,T.RGBAFormat);
  texture.name='RockmundoWordmarkHD';
  texture.colorSpace=T.SRGBColorSpace;
  texture.magFilter=T.LinearFilter;
  texture.minFilter=T.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;
  texture.needsUpdate=true;
  return texture;
}

function addStarterLogoTee(root: T.Object3D, appearance: PlayerAppearance, bones: Map<string, T.Bone>, richClothing: ResolvedEquippedClothing[]) {
  const curatedLogo = richClothing.some(row => row.item.curated_asset_key === 'clothing.starter.logo-tee');
  const hasOtherTop = richClothing.some(row => richGarmentSlot(row.item) === 'top' && row.item.curated_asset_key !== 'clothing.starter.logo-tee');
  if (!curatedLogo && (appearance.equipment.top.itemId !== 'starter.top.casual' || hasOtherTop)) return;

  const chest = findPlayerBone(bones, ['Spine2','Spine.002','Chest','UpperChest'])
    ?? findPlayerBone(bones, ['Spine1','Spine.001']);
  if (!chest) return;

  const attachment = findFrontSurfaceAttachment(
    root,
    'body',
    chest.getWorldPosition(new T.Vector3()),
    appearance.body.frame === 'feminine' ? .018 : .025,
  );
  // Never fall back to an arbitrary forward offset: if the fitted shirt surface
  // cannot be resolved, omitting the print is safer than showing a floating logo.
  if (!attachment) {
    console.warn('[curated-clothing] Rockmundo logo surface could not be resolved');
    return;
  }

  const texture = rockmundoWordmarkTexture();
  const material = new T.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: .12,
    roughness: .86,
    metalness: 0,
    side: T.DoubleSide,
    depthWrite: false,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  material.name = 'RockmundoLogoPrint';

  const mark = new T.Mesh(
    curvedGraphicGeometry(appearance.body.frame === 'feminine' ? .305 : .33, .07, .0025),
    material,
  );
  mark.name = 'avatar-rockmundo-logo';
  mark.renderOrder = 3;
  attachSurfaceGraphic(root, chest, mark, attachment, .00045);
}

function applyV1HandProportionPolish(bones: Map<string, T.Bone>) {
  const joint = (digit: string, index: number, side: 'L' | 'R') =>
    findPlayerBone(bones, [`${digit}${index}.${side}`, `${digit}${index}_${side}`, `${digit}${index}${side}`]);

  // The legacy donor rigs have intentionally chunky stage hands, but the finger
  // chains read too long and spider-like in the fitting-room close-up. Shorten
  // each digit from its base instead of editing vertices, which keeps the
  // existing weights, IK and instrument finger animation fully compatible.
  const baseScale: Record<string, number> = {
    Thumb: .94,
    Index: .955,
    Middle: .95,
    Ring: .925,
    Pinky: .89,
  };
  for (const side of ['L', 'R'] as const) {
    for (const digit of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
      const proximal = joint(digit, 1, side);
      if (!proximal) continue;
      proximal.scale.multiplyScalar(baseScale[digit]);
      proximal.userData.avatarV1FingerScale = baseScale[digit];
    }
  }
}

function applyRelaxedV1HandPose(bones: Map<string, T.Bone>) {
  const joint = (digit: string, index: number, side: 'L' | 'R') =>
    findPlayerBone(bones, [`${digit}${index}.${side}`, `${digit}${index}_${side}`, `${digit}${index}${side}`]);

  for (const side of ['L', 'R'] as const) {
    const sideSign = side === 'L' ? 1 : -1;
    const curls: Record<string, number> = { Index: .10, Middle: .14, Ring: .17, Pinky: .20, Thumb: .08 };
    const splays: Record<string, number> = { Index: -.018, Middle: -.006, Ring: .008, Pinky: .018, Thumb: -.025 };
    for (const digit of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
      for (const index of [1, 2, 3] as const) {
        const bone = joint(digit, index, side);
        if (!bone) continue;
        const curl = curls[digit] * (index === 1 ? .55 : index === 2 ? .82 : 1);
        bone.rotateX(curl);
        if (index === 1) bone.rotateZ(splays[digit] * sideSign);
      }
    }
  }
}

// Hotfix guard: the procedural starter garment meshes are preview-grade and
// attach too rigidly to the V1 skeleton in the live fitting room (flat torso
// panels / T-pose sleeves). Keep their definitions available for isolated
// development, but ship stable donor-skinned garments until each replacement
// has proper skin weights and visual acceptance coverage.
const USE_PROCEDURAL_STARTER_GARMENTS = false;

const PROCEDURAL_STARTER_TOPS = new Set([
  'starter.top.casual',
  'starter.top.stripe',
  'starter.top.plain-black',
  'starter.top.plain-white',
  'starter.top.vintage-charcoal',
  'starter.top.v-neck',
  'starter.top.long-sleeve',
  'starter.top.tank',
  'starter.top.hoodie',
  'starter.top.zip-hoodie',
  'starter.top.denim-jacket',
  'starter.top.flannel-shirt',
]);

function starterTopVisualItem(appearance: PlayerAppearance): ClothingItem | null {
  const id = appearance.equipment.top.itemId;
  if (!PROCEDURAL_STARTER_TOPS.has(id)) return null;

  const common = {
    id,
    name: equipmentItem(appearance, 'top').label,
    description: 'Built-in Avatar V1 starter garment',
    category: 'top',
    wearable_slot: 'top',
    price: 0,
    is_premium: false,
    rarity: 'common',
    color_variants: [],
    collection_id: null,
    release_date: null,
    expiry_date: null,
    is_limited_edition: false,
    featured: false,
    rpm_asset_id: null,
    material_config: {
      fabric: id === 'starter.top.denim-jacket' ? 'denim' : 'cotton',
      primaryColor: appearance.equipment.top.color,
      secondaryColor: id === 'starter.top.denim-jacket' ? '#b8b2a5' : '#e9e4db',
      roughness: id === 'starter.top.denim-jacket' ? .86 : .9,
      thickness: id.includes('hoodie') || id.includes('jacket') ? .72 : .46,
    },
    pattern_config: { type: id === 'starter.top.stripe' ? 'stripe' : id === 'starter.top.flannel-shirt' ? 'plaid' : 'solid' },
    fit_config: { fit: id.includes('hoodie') ? 'relaxed' : id === 'starter.top.vintage-charcoal' ? 'slim' : 'regular', drape: .42, taper: .28 },
    wear_config: id === 'starter.top.vintage-charcoal' ? { condition: 'stage-worn', distress: .28 } : {},
    detail_layers: [],
    render_config: {},
    curated_asset_key: null,
    curated_asset_status: 'legacy' as const,
    supported_frames: ['masculine', 'feminine'],
    validation_notes: null,
    bonus_enabled: false,
    bonus_config: null,
    customization_zones: null,
    variant_matrix: null,
    external_key: null,
    schema_version: 1,
    import_source: 'avatar-v1-starter',
    import_batch_id: null,
    preview_status: null,
    preview_manifest: null,
    preview_generated_at: null,
    last_preview_error: null,
    shape_config: null,
  };

  const garment_config: Record<string, unknown> = {
    templateKey: 't-shirt',
    silhouette: 'classic',
    cut: 'regular',
    sleeve: 'short',
    collar: 'crew',
    closure: 'none',
    length: 'standard',
    waistScale: 1,
    sleeveLengthScale: .82,
    sleeveWidthScale: .95,
  };

  if (id === 'starter.top.v-neck') garment_config.collar = 'v-neck';
  if (id === 'starter.top.long-sleeve') {
    garment_config.templateKey = 'long-sleeve';
    garment_config.sleeve = 'long';
    garment_config.sleeveLengthScale = 1.04;
  }
  if (id === 'starter.top.tank') {
    garment_config.templateKey = 'vest';
    garment_config.sleeve = 'none';
    garment_config.cut = 'fitted';
    garment_config.waistScale = .94;
  }
  if (id === 'starter.top.hoodie' || id === 'starter.top.zip-hoodie') {
    garment_config.templateKey = 'hoodie';
    garment_config.sleeve = 'long';
    garment_config.collar = 'hood';
    garment_config.silhouette = 'relaxed';
    garment_config.sleeveLengthScale = 1.08;
    garment_config.sleeveWidthScale = 1.08;
    if (id === 'starter.top.zip-hoodie') garment_config.closure = 'zip';
  }
  if (id === 'starter.top.denim-jacket') {
    garment_config.templateKey = 'jacket';
    garment_config.sleeve = 'long';
    garment_config.collar = 'shirt';
    garment_config.closure = 'button';
    garment_config.cut = 'structured';
    garment_config.sleeveLengthScale = 1.04;
  }
  if (id === 'starter.top.flannel-shirt') {
    garment_config.templateKey = 'shirt';
    garment_config.sleeve = 'long';
    garment_config.collar = 'shirt';
    garment_config.closure = 'button';
    garment_config.sleeveLengthScale = 1.02;
  }

  return { ...common, garment_config } as ClothingItem;
}

const PROCEDURAL_STARTER_BOTTOMS = new Set([
  'starter.bottom.denim-shorts',
  'starter.bottom.cargo-shorts',
  'starter.bottom.athletic-shorts',
  'starter.bottom.boxer-briefs',
  'starter.bottom.briefs',
  'starter.bottom.chinos',
  'starter.bottom.wide-leg',
  'starter.bottom.pleated-skirt',
  'starter.bottom.mini-skirt',
]);

function starterBottomVisualItem(appearance: PlayerAppearance): ClothingItem | null {
  const id = appearance.equipment.bottom.itemId;
  if (!PROCEDURAL_STARTER_BOTTOMS.has(id)) return null;
  const underwear = id === 'starter.bottom.boxer-briefs' || id === 'starter.bottom.briefs';
  const denim = id === 'starter.bottom.denim-shorts';
  const cargo = id === 'starter.bottom.cargo-shorts';
  const athletic = id === 'starter.bottom.athletic-shorts';
  const skirt = id === 'starter.bottom.pleated-skirt' || id === 'starter.bottom.mini-skirt';
  const wideLeg = id === 'starter.bottom.wide-leg';
  const chinos = id === 'starter.bottom.chinos';
  return {
    id,
    name: equipmentItem(appearance, 'bottom').label,
    description: 'Built-in Avatar V1 starter garment',
    category: underwear ? 'underwear' : skirt ? 'skirt' : (id.includes('shorts') ? 'shorts' : 'trousers'),
    wearable_slot: 'bottom',
    price: 0,
    is_premium: false,
    rarity: 'common',
    color_variants: [],
    collection_id: null,
    release_date: null,
    expiry_date: null,
    is_limited_edition: false,
    featured: false,
    rpm_asset_id: null,
    material_config: {
      fabric: denim ? 'denim' : 'cotton',
      primaryColor: appearance.equipment.bottom.color,
      secondaryColor: underwear ? '#e9e4db' : denim ? '#d6c5a4' : '#b8b2a5',
      roughness: denim ? .86 : .9,
      thickness: underwear ? .28 : skirt ? .4 : wideLeg ? .5 : .48,
    },
    pattern_config: { type: 'solid' },
    fit_config: {
      fit: underwear || athletic ? 'slim' : cargo || wideLeg ? 'relaxed' : 'regular',
      drape: underwear ? .22 : skirt ? .55 : wideLeg ? .62 : .4,
      taper: underwear ? .44 : wideLeg ? .05 : chinos ? .34 : .25,
    },
    wear_config: {},
    garment_config: {
      templateKey: underwear ? 'underwear' : skirt ? 'skirt' : wideLeg ? 'wide-leg' : (id.includes('shorts') ? 'shorts' : 'trousers'),
      silhouette: underwear ? 'fitted' : skirt ? (id === 'starter.bottom.pleated-skirt' ? 'a-line' : 'fitted') : cargo || wideLeg ? 'relaxed' : 'classic',
      cut: underwear ? 'fitted' : cargo || wideLeg ? 'relaxed' : chinos ? 'tapered' : 'regular',
      length: underwear ? 'mini' : id === 'starter.bottom.mini-skirt' ? 'mini' : skirt ? 'short' : id.includes('shorts') ? 'short' : 'standard',
      waistScale: underwear ? .94 : skirt ? .98 : 1,
      construction: denim ? 'denim-shorts' : cargo ? 'cargo-shorts' : athletic ? 'athletic-shorts' : id === 'starter.bottom.pleated-skirt' ? 'pleated-skirt' : id === 'starter.bottom.mini-skirt' ? 'mini-skirt' : chinos ? 'chinos' : wideLeg ? 'wide-leg' : underwear ? 'underwear' : 'plain',
    },
    detail_layers: [],
    render_config: {},
    curated_asset_key: null,
    curated_asset_status: 'legacy',
    supported_frames: ['masculine', 'feminine'],
    validation_notes: null,
    bonus_enabled: false,
    bonus_config: null,
    customization_zones: null,
    variant_matrix: null,
    external_key: null,
    schema_version: 1,
    import_source: 'avatar-v1-starter',
    import_batch_id: null,
    preview_status: null,
    preview_manifest: null,
    preview_generated_at: null,
    last_preview_error: null,
    shape_config: null,
  } as ClothingItem;
}

function starterBottomExposesLegs(item: ClothingItem) {
  const garment = (item.garment_config || {}) as Record<string, unknown>;
  const templateKey = String(garment.templateKey || garment.template_key || '').toLowerCase();
  return templateKey === 'shorts' || templateKey === 'underwear' || templateKey === 'skirt';
}

function addStarterProceduralGarment(
  root: T.Object3D,
  bones: Map<string, T.Bone>,
  item: ClothingItem,
  prefix: 'Body' | 'Legs',
) {
  const garment = buildProceduralGarment(item);
  root.add(garment);
  root.updateMatrixWorld(true);

  const pieces: T.Mesh[] = [];
  garment.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    node.name = `Starter_${prefix}_${node.name || 'garment-piece'}`;
    pieces.push(node);
  });

  for (const piece of pieces) {
    const anchorName = String(piece.userData.rigAnchor || (prefix === 'Body' ? 'Torso' : 'Hips')) as GarmentRigAnchor;
    const anchor = bones.get(anchorName)
      ?? (anchorName === 'Torso' ? findPlayerBone(bones, ['Spine2','Spine.002','Chest','UpperChest','Spine1','Spine.001']) : undefined)
      ?? (anchorName === 'Hips' ? findPlayerBone(bones, ['Hips','Pelvis']) : undefined);
    if (anchor) anchor.attach(piece);
    else root.attach(piece);
  }
  garment.removeFromParent();
}

function addV1BareLegUnderlay(
  root: T.Object3D,
  appearance: PlayerAppearance,
  bones: Map<string, T.Bone>,
  quality: AvatarVisualQuality,
) {
  root.updateMatrixWorld(true);
  const muscle = appearance.body.muscle ?? 'natural';
  const muscleScale = { natural: 1, toned: 1.035, athletic: 1.075, muscular: 1.13, bodybuilder: 1.2 }[muscle];
  const frameScale = appearance.body.frame === 'feminine' ? .92 : 1;
  const material = upgradeSkinMaterial(
    Object.assign(new T.MeshStandardMaterial({
      color: appearance.body.skin,
      roughness: skinRoughness(appearance),
      metalness: 0,
    }), { name: 'Skin_Underlay' }),
    appearance,
    quality,
  );
  material.name = 'Skin_Underlay';

  const bone = (...names: string[]) => findPlayerBone(bones, names);
  const addSegment = (name: string, driver: T.Bone | undefined, from: T.Bone | undefined, to: T.Bone | undefined, radiusX: number, radiusZ: number) => {
    if (!driver || !from || !to) return;
    const start = from.getWorldPosition(new T.Vector3());
    const end = to.getWorldPosition(new T.Vector3());
    const direction = end.clone().sub(start);
    const length = direction.length();
    if (!Number.isFinite(length) || length < .015) return;
    const geometry = new T.SphereGeometry(1, quality === 'cinematic' ? 26 : 18, quality === 'cinematic' ? 18 : 12);
    geometry.applyMatrix4(new T.Matrix4().compose(
      start.clone().add(end).multiplyScalar(.5),
      new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize()),
      new T.Vector3(radiusX, length * .54, radiusZ),
    ));
    const count = geometry.attributes.position.count;
    const weights = new Float32Array(count * 4);
    for (let i = 0; i < count; i += 1) weights[i * 4] = 1;
    geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
    geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
    geometry.computeVertexNormals();
    const mesh = new T.SkinnedMesh(geometry, material);
    mesh.name = `avatar-v1-short-leg-underlay-${name}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    mesh.bind(new T.Skeleton([driver], [driver.matrixWorld.clone().invert()]), new T.Matrix4());
  };

  for (const side of ['L', 'R'] as const) {
    const upperLeg = bone(`UpperLeg.${side}`, `UpperLeg_${side}`, `UpperLeg${side}`);
    const lowerLeg = bone(`LowerLeg.${side}`, `LowerLeg_${side}`, `LowerLeg${side}`);
    const foot = bone(`Foot.${side}`, `Foot_${side}`, `Foot${side}`);
    addSegment(`upper-${side.toLowerCase()}`, upperLeg, upperLeg, lowerLeg, .083 * frameScale * muscleScale, .078 * muscleScale);
    addSegment(`lower-${side.toLowerCase()}`, lowerLeg, lowerLeg, foot, .059 * frameScale * muscleScale, .057 * muscleScale);
  }
}

function addLegacyBareBodyUnderlay(
  root: T.Object3D,
  appearance: PlayerAppearance,
  bones: Map<string, T.Bone>,
  quality: AvatarVisualQuality,
  fullBody: boolean,
) {
  root.updateMatrixWorld(true);
  const muscle = appearance.body.muscle ?? 'natural';
  const muscleScale = {
    natural: 1,
    toned: 1.035,
    athletic: 1.075,
    muscular: 1.13,
    bodybuilder: 1.2,
  }[muscle];
  const frameScale = appearance.body.frame === 'feminine' ? .92 : 1;
  const skin = upgradeSkinMaterial(
    Object.assign(new T.MeshStandardMaterial({
      color: appearance.body.skin,
      roughness: skinRoughness(appearance),
      metalness: 0,
    }), { name: 'Skin_Underlay' }),
    appearance,
    quality,
  );
  skin.name = 'Skin_Underlay';

  const bone = (...names: string[]) => findPlayerBone(bones, names);
  const addEllipsoid = (
    name: string,
    driver: T.Bone | undefined,
    from: T.Bone | undefined,
    to: T.Bone | undefined,
    radiusX: number,
    radiusZ: number,
    lengthScale = 1.08,
  ) => {
    if (!driver || !from || !to) return;
    const start = from.getWorldPosition(new T.Vector3());
    const end = to.getWorldPosition(new T.Vector3());
    const direction = end.clone().sub(start);
    const length = direction.length();
    if (!Number.isFinite(length) || length < .015) return;
    const rotation = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize());
    const midpoint = start.clone().add(end).multiplyScalar(.5);
    const geometry = new T.SphereGeometry(1, quality === 'cinematic' ? 28 : 20, quality === 'cinematic' ? 20 : 14);
    geometry.applyMatrix4(new T.Matrix4().compose(
      midpoint,
      rotation,
      new T.Vector3(radiusX, Math.max(.025, length * .5 * lengthScale), radiusZ),
    ));
    const count = geometry.attributes.position.count;
    const indices = new Uint16Array(count * 4);
    const weights = new Float32Array(count * 4);
    for (let i = 0; i < count; i += 1) weights[i * 4] = 1;
    geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
    geometry.computeVertexNormals();

    const mesh = new T.SkinnedMesh(geometry, skin);
    mesh.name = `avatar-v1-skin-underlay-${name}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    mesh.bind(new T.Skeleton([driver], [driver.matrixWorld.clone().invert()]), new T.Matrix4());
  };

  const hips = bone('Hips', 'Pelvis');
  const spine1 = bone('Spine1', 'Spine.001', 'Spine');
  const spine2 = bone('Spine2', 'Spine.002', 'Chest', 'UpperChest');
  const neck = bone('Neck');
  const torsoTop = neck ?? spine2;
  const torsoDriver = spine1 ?? spine2 ?? hips;
  if (hips && torsoTop && torsoDriver) {
    addEllipsoid('torso', torsoDriver, hips, torsoTop, .185 * frameScale * muscleScale, .112 * (1 + (muscleScale - 1) * .55), 1.02);
  }

  for (const side of ['L', 'R'] as const) {
    const upperArm = bone(`UpperArm.${side}`, `UpperArm_${side}`, `UpperArm${side}`);
    const lowerArm = bone(`LowerArm.${side}`, `LowerArm_${side}`, `LowerArm${side}`);
    const hand = bone(`Hand.${side}`, `Hand_${side}`, `Hand${side}`);
    addEllipsoid(`upper-arm-${side.toLowerCase()}`, upperArm, upperArm, lowerArm, .062 * frameScale * muscleScale, .061 * muscleScale);
    // Topless stage avatars hide the donor shirt material, including the sleeve/forearm
    // geometry on some V1 exports. Always rebuild the complete arm so hands never
    // appear detached. Tattoo mode still extends the same underlay to the legs/feet.
    addEllipsoid(
      `lower-arm-${side.toLowerCase()}`,
      lowerArm,
      lowerArm,
      hand,
      .047 * frameScale * (1 + (muscleScale - 1) * .7),
      .046 * (1 + (muscleScale - 1) * .7),
      1.1,
    );

    // A small elbow bridge softens the seam between the two skinned ellipsoids in
    // close-up creator/profile views while remaining driven by the lower-arm bone.
    if (lowerArm) {
      const elbow = lowerArm.getWorldPosition(new T.Vector3());
      const geometry = new T.SphereGeometry(
        .052 * frameScale * (1 + (muscleScale - 1) * .78),
        quality === 'cinematic' ? 24 : 16,
        quality === 'cinematic' ? 16 : 12,
      );
      geometry.translate(elbow.x, elbow.y, elbow.z);
      const count = geometry.attributes.position.count;
      const indices = new Uint16Array(count * 4);
      const weights = new Float32Array(count * 4);
      for (let i = 0; i < count; i += 1) weights[i * 4] = 1;
      geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(indices, 4));
      geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
      geometry.computeVertexNormals();
      const elbowMesh = new T.SkinnedMesh(geometry, skin);
      elbowMesh.name = `avatar-v1-skin-underlay-elbow-${side.toLowerCase()}`;
      elbowMesh.castShadow = true;
      elbowMesh.receiveShadow = true;
      root.add(elbowMesh);
      elbowMesh.bind(new T.Skeleton([lowerArm], [lowerArm.matrixWorld.clone().invert()]), new T.Matrix4());
    }

    if (!fullBody) continue;
    const upperLeg = bone(`UpperLeg.${side}`, `UpperLeg_${side}`, `UpperLeg${side}`);
    const lowerLeg = bone(`LowerLeg.${side}`, `LowerLeg_${side}`, `LowerLeg${side}`);
    const foot = bone(`Foot.${side}`, `Foot_${side}`, `Foot${side}`);
    const toe = bone(`ToeBase.${side}`, `ToeBase_${side}`, `ToeBase${side}`);
    addEllipsoid(`upper-leg-${side.toLowerCase()}`, upperLeg, upperLeg, lowerLeg, .083 * frameScale * muscleScale, .078 * (1 + (muscleScale - 1) * .8));
    addEllipsoid(`lower-leg-${side.toLowerCase()}`, lowerLeg, lowerLeg, foot, .059 * frameScale * (1 + (muscleScale - 1) * .75), .057 * (1 + (muscleScale - 1) * .75));
    addEllipsoid(`foot-${side.toLowerCase()}`, foot, foot, toe, .058 * frameScale, .075 * frameScale, .95);
  }
}

/** Each part keeps its donor inverse binds and local transform. This matters for
 * the small body offset in the original casual/suit assets. Rig families never mix. */
export function assemblePlayerModel(
  library: ModelLibrary,
  appearance: PlayerAppearance,
  tattoos: ResolvedTattooVisual[] = [],
  richClothing: ResolvedEquippedClothing[] = [],
  quality: AvatarVisualQuality = 'balanced',
  presentation: PlayerModelPresentation = 'stage',
): T.Object3D {
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
  const skinTextureCache = createAvatarSkinTextureCache(appearance, quality);
  const hairTextureCache = createAvatarHairTextureCache(quality);
  const starterFabricCache = new Map<string, { map: T.DataTexture; normal: T.DataTexture }>();
  const curatedSurfaceCache = new Map<string, {
    map: T.DataTexture;
    normal: T.DataTexture;
    bump: T.DataTexture;
    roughness: T.DataTexture;
  }>();
  const starterFabricMaps = (fabric: Parameters<typeof fabricTexture>[0]) => {
    const key = `${fabric}:${quality}`;
    const cached = starterFabricCache.get(key);
    if (cached) return cached;
    const created = {
      map: fabricTexture(fabric, quality),
      normal: fabricNormalTexture(fabric, quality),
    };
    starterFabricCache.set(key, created);
    return created;
  };
  const curatedSurfaceMaps = (
    assetKey: string,
    finish: CuratedFinish,
    dye: string,
    secondaryColor?: string,
  ) => {
    const key = [assetKey, finish, dye, secondaryColor ?? '', quality].join(':');
    const cached = curatedSurfaceCache.get(key);
    if (cached) return cached;
    const map = finish === 'tartan'
      ? curatedTextureForQuality(curatedTartanTexture(assetKey, dye, secondaryColor || '#171717'), quality, 'color')
      : curatedTextureForQuality(curatedAlbedoTexture(assetKey, finish), quality, 'color');
    const created = {
      map,
      normal: curatedTextureForQuality(curatedNormalTexture(assetKey, finish), quality, 'normal'),
      bump: curatedTextureForQuality(curatedReliefTexture(assetKey, finish), quality, 'height'),
      roughness: curatedTextureForQuality(curatedRoughnessTexture(assetKey, finish), quality, 'roughness'),
    };
    curatedSurfaceCache.set(key, created);
    return created;
  };

  const curatedTop = presentation === 'tattoo' ? undefined : curatedDonorForSlot(richClothing, 'top');
  const curatedBottom = presentation === 'tattoo' ? undefined : curatedDonorForSlot(richClothing, 'bottom');
  const curatedFootwear = presentation === 'tattoo' ? undefined : curatedDonorForSlot(richClothing, 'footwear');
  const topless = presentation === 'stage' && appearance.equipment.top.itemId === 'starter.top.topless' && !curatedTop;
  const proceduralStarterTop = USE_PROCEDURAL_STARTER_GARMENTS && presentation === 'stage' && !curatedTop
    ? starterTopVisualItem(appearance)
    : null;
  const proceduralStarterBottom = USE_PROCEDURAL_STARTER_GARMENTS && presentation === 'stage' && !curatedBottom
    ? starterBottomVisualItem(appearance)
    : null;
  const choices = [
    { part: 'head', style: headModelStyle(appearance), dye: appearance.head.hair, fabric: 'plain' as const },
    {
      part: 'body',
      style: curatedTop?.source.style ?? equipmentStyle(appearance, 'top'),
      dye: curatedTop?.source.color ?? appearance.equipment.top.color,
      secondaryColor: curatedTop?.source.secondaryColor,
      fabric: curatedTop?.source.fabric ?? equipmentItem(appearance, 'top').fabric,
      finish: curatedTop?.source.finish,
      assetKey: curatedTop?.source.assetKey,
    },
    {
      part: 'legs',
      style: curatedBottom?.source.style ?? equipmentStyle(appearance, 'bottom'),
      dye: curatedBottom?.source.color ?? appearance.equipment.bottom.color,
      secondaryColor: curatedBottom?.source.secondaryColor,
      fabric: curatedBottom?.source.fabric ?? equipmentItem(appearance, 'bottom').fabric,
      finish: curatedBottom?.source.finish,
      assetKey: curatedBottom?.source.assetKey,
    },
    {
      part: 'feet',
      style: curatedFootwear?.source.style ?? equipmentStyle(appearance, 'footwear'),
      dye: curatedFootwear?.source.color ?? appearance.equipment.footwear.color,
      secondaryColor: curatedFootwear?.source.secondaryColor,
      fabric: curatedFootwear?.source.fabric ?? equipmentItem(appearance, 'footwear').fabric,
      finish: curatedFootwear?.source.finish,
      assetKey: curatedFootwear?.source.assetKey,
    },
  ];
  for (const choice of choices) {
    const matches = (node: T.Object3D) => !(node instanceof T.Bone) && new RegExp(`_${choice.part}(?:_|$)`, 'i').test(node.name);
    const containers: T.Object3D[] = [];
    source(choice.style).traverse(node => { if (matches(node) && (!node.parent || !matches(node.parent))) containers.push(node); });
    if (!containers.length) throw new Error(`Missing character part: ${choice.part}`);
    for (const container of containers) {
      const part = container.clone(true), removeHair: T.Object3D[] = [];
      const corneaOverlays: Array<{ parent: T.Object3D; overlay: T.SkinnedMesh }> = [];
      part.traverse(clonedNode => {
        if (!(clonedNode instanceof T.SkinnedMesh)) return;
        const original = (container === clonedNode ? container : container.getObjectByName(clonedNode.name)) as T.SkinnedMesh;
        if (!original?.isSkinnedMesh) throw new Error('Incompatible character geometry');
        clonedNode.geometry = original.geometry.clone();
        if (
          choice.part === 'body' &&
          !choice.assetKey &&
          appearance.equipment.top.itemId === 'starter.top.casual'
        ) {
          polishV1CrewTeeGeometry(
            clonedNode,
            Array.isArray(original.material) ? original.material : [original.material],
          );
        }
        if (choice.fabric !== 'plain' || choice.finish) fabricUVs(clonedNode.geometry, choice.part === 'feet');
        if (choice.assetKey) applyCuratedMacroShading(clonedNode.geometry, choice.assetKey, choice.finish as CuratedFinish | undefined);
        if (choice.part === 'head' || (choice.part === 'body' && !choice.assetKey)) {
          applyAvatarSkinMacroShading(clonedNode.geometry, choice.part, appearance, quality);
        }
        const dyeMaterial = (originalMaterial: T.Material) => {
          const material = originalMaterial.clone() as T.MeshStandardMaterial;
          if (!material.isMeshStandardMaterial) return material;
          const name = material.name.toLowerCase();
          const skinMaterial = /skin/.test(name);
          const hideForTattooView = presentation === 'tattoo' && choice.part !== 'head' && !skinMaterial;
          const hideForTopless = topless && choice.part === 'body' && !skinMaterial;
          const hideForProceduralStarterTop = !!proceduralStarterTop && choice.part === 'body' && !skinMaterial;
          const hideForProceduralStarterBottom = !!proceduralStarterBottom && choice.part === 'legs' && !skinMaterial;
          if (hideForTattooView || hideForTopless || hideForProceduralStarterTop || hideForProceduralStarterBottom) {
            material.visible = false;
            material.transparent = true;
            material.opacity = 0;
            material.depthWrite = false;
            return material;
          }
          material.roughness = skinMaterial ? skinRoughness(appearance) : .84;
          material.metalness = /earring|metal/.test(name) ? .65 : 0;
          if (!/skin|earring|metal/.test(name) && choice.finish) {
            if (choice.finish === 'cotton') material.roughness = .9;
            if (choice.finish === 'vintage-cotton') material.roughness = .97;
            if (choice.finish === 'denim') material.roughness = .96;
            if (choice.finish === 'tartan') material.roughness = .91;
            if (choice.finish === 'canvas') material.roughness = .94;
            if (choice.finish === 'leather') { material.roughness = .38; material.metalness = .03; }
            if (choice.finish === 'polished-leather') { material.roughness = .24; material.metalness = .04; }
          }
          if (/skin/.test(name)) {
            material.color.set(appearance.body.skin);
            if (clonedNode.geometry.getAttribute('color') && (choice.part === 'head' || !choice.assetKey)) material.vertexColors = true;
            applyAvatarSkinQuality(material, appearance, quality, skinTextureCache);
          } else if (choice.part === 'head') {
            // The source rigs use slightly different material names. Keep iris,
            // brows and hair independently tintable while preserving eye whites.
            const isFeminineIris = appearance.body.frame === 'feminine' && name === 'brown';
            if (/iris|pupil/.test(name) || isFeminineIris) {
              material.color.set(appearance.head.eyeColor ?? '#65442d');
              applyAvatarEyeQuality(material, quality);
            } else if (/white|eye/.test(name) && !/eyebrow/.test(name)) {
              applyAvatarEyeQuality(material, quality);
            } else if (/eyebrow|brow|hair_brown/.test(name)) {
              material.color.set(appearance.head.eyebrowColor ?? appearance.head.hair);
              applyAvatarHairQuality(material, quality, hairTextureCache);
            } else if (/hair|pink|red/.test(name)) {
              material.color.set(appearance.head.hair);
              applyAvatarHairQuality(material, quality, hairTextureCache);
            }
          } else if (!/earring|metal/.test(name) && !(name === 'white' && (choice.style !== 'casual' || choice.part === 'feet'))) {
            material.color.set(choice.dye);
            if (choice.fabric !== 'plain' && !choice.assetKey) {
              const fabricMaps = starterFabricMaps(choice.fabric);
              material.map = fabricMaps.map;
              material.normalMap = fabricMaps.normal;
              const starterNormal = choice.fabric === 'canvas' ? .42 : choice.fabric === 'denim' ? .36 : .2;
              material.normalScale.set(starterNormal, starterNormal);
              material.roughness = choice.fabric === 'patent' ? .2 : choice.fabric === 'canvas' || choice.fabric === 'denim' ? .95 : .84;
            }
            if (choice.assetKey) material.vertexColors = true;
            if (choice.assetKey && choice.finish) {
              const finish = choice.finish as CuratedFinish;
              const maps = curatedSurfaceMaps(choice.assetKey, finish, choice.dye, choice.secondaryColor);
              material.map = maps.map;
              if (finish === 'tartan') material.color.set('#ffffff');
              const profile = curatedMaterialProfile(choice.assetKey, finish);
              material.normalMap = maps.normal;
              material.normalScale.set(profile.normalStrength, profile.normalStrength);
              material.bumpMap = maps.bump;
              material.bumpScale = curatedBumpScale(finish) * profile.bumpMultiplier;
              material.roughnessMap = maps.roughness;
              material.roughness = profile.roughness;
              material.metalness = profile.metalness;
              material.envMapIntensity = profile.envMapIntensity;
              material.needsUpdate = true;
            }
          }
          if (/skin/.test(name)) {
            return upgradeSkinMaterial(material, appearance, quality);
          }
          if (!choice.assetKey && choice.fabric !== 'plain' && !/earring|metal/.test(name)) {
            const upgraded = upgradeStarterFabricMaterial(material, choice.fabric, quality);
            if (upgraded !== material) return upgraded;
          }
          if (
            choice.assetKey &&
            choice.finish &&
            (choice.finish === 'leather' || choice.finish === 'polished-leather') &&
            !/earring|metal/.test(name)
          ) {
            return upgradeCuratedGarmentMaterial(
              material,
              choice.finish as CuratedFinish,
              curatedMaterialProfile(choice.assetKey, choice.finish as CuratedFinish),
              quality,
            );
          }
          return material;
        };
        if (choice.part === 'head' && appearance.head.hairStyle && appearance.head.hairStyle !== 'original' && !Array.isArray(original.material) && isScalpHair(original.material, appearance.body.frame)) removeHair.push(clonedNode);
        clonedNode.material = Array.isArray(original.material) ? original.material.map(dyeMaterial) : dyeMaterial(original.material);
        const boundBones = original.skeleton.bones.map(bone => {
          const match = bones.get(bone.name); if (!match) throw new Error(`Incompatible character part: ${bone.name}`); return match;
        });
        clonedNode.bind(new T.Skeleton(boundBones, original.skeleton.boneInverses.map(matrix => matrix.clone())), original.bindMatrix.clone());
        if (choice.part === 'head' && clonedNode.parent) {
          const overlay = createCorneaOverlay(clonedNode, appearance.body.frame, quality);
          if (overlay) corneaOverlays.push({ parent: clonedNode.parent, overlay });
        }
      });
      corneaOverlays.forEach(({ parent, overlay }) => parent.add(overlay));
      removeHair.forEach(disposeModel);
      const parent = container.parent?.name ? result.getObjectByName(container.parent.name) : result;
      (parent ?? result).add(part);
    }
  }
  if (proceduralStarterTop) {
    addStarterProceduralGarment(result, bones, proceduralStarterTop, 'Body');
  }
  if (proceduralStarterBottom) {
    addStarterProceduralGarment(result, bones, proceduralStarterBottom, 'Legs');
    if (starterBottomExposesLegs(proceduralStarterBottom)) addV1BareLegUnderlay(result, appearance, bones, quality);
  }

  if (topless || presentation === 'tattoo') {
    // The live avatar donor meshes are clothing-first, so this neutral skinned
    // underlay prevents holes for topless and tattoo presentation modes.
    addLegacyBareBodyUnderlay(result, appearance, bones, quality, presentation === 'tattoo');
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
    addFaceDetails(result, appearance, headBone, quality);
    addHair(result, appearance, headBone, quality, hairTextureCache);
    addAccessories(result, appearance, headBone, richClothing, quality);
  }
  if (presentation === 'stage') {
    addStarterLogoTee(result, appearance, bones, richClothing);
    addCuratedSkinDetails(result, bones, richClothing, quality);
  }
  addTattoos(result, tattoos, bones);
  // V1 donor hands have long, exaggerated fingers and an open/splayed bind pose.
  // Keep the original skin weights and animation chains but improve their
  // proportions and resting silhouette for creator/profile close-ups.
  applyV1HandProportionPolish(bones);
  applyRelaxedV1HandPose(bones);
  result.userData.rockmundoAvatarPresentation = presentation;
  result.updateMatrixWorld(true);
  return result;
}

export function disposeModel(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>(), skeletons = new Set<T.Skeleton>();
  root.traverse(node => {
    if (!(node instanceof T.Mesh) && !(node instanceof T.Line)) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(material); Object.values(material).forEach(value => { if (value instanceof T.Texture) textures.add(value); });
    }
    if (node instanceof T.SkinnedMesh) skeletons.add(node.skeleton);
  });
  geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose()); skeletons.forEach(value => value.dispose());
  root.removeFromParent(); root.clear();
}
