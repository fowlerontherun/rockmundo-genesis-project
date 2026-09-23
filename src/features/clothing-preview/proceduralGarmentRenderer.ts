import * as T from 'three';
import type { ClothingDetailLayer, ClothingItem } from '@/hooks/useSkinStore';
import type { ClothingPreviewVariant } from './clothingPreview';
import { buildRichGarmentVisualSpec } from './richGarmentVisuals';

export type RichGarmentVisualSpec = ReturnType<typeof buildRichGarmentVisualSpec>;
export type GarmentRigAnchor = 'Torso' | 'Hips' | 'UpperArm.L' | 'UpperArm.R' | 'UpperLeg.L' | 'UpperLeg.R' | 'Foot.L' | 'Foot.R' | 'Head';

export function makeGarmentPatternTexture(spec: RichGarmentVisualSpec) {
  if (typeof document === 'undefined' || spec.pattern === 'solid' || spec.pattern === 'none') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = spec.primaryColor;
  ctx.fillRect(0, 0, 256, 256);
  ctx.globalAlpha = spec.opacity;
  ctx.fillStyle = spec.secondaryColor;
  ctx.strokeStyle = spec.secondaryColor;
  ctx.lineWidth = Math.max(4, 18 / spec.patternScale);

  const pattern = spec.pattern.toLowerCase();
  const step = Math.max(18, 54 / spec.patternScale);
  if (/stripe|pinstripe/.test(pattern)) {
    for (let x = -256; x < 512; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 180, 256);
      ctx.stroke();
    }
  } else if (/check|tartan|plaid/.test(pattern)) {
    for (let x = 0; x < 256; x += step) ctx.fillRect(x, 0, step * .34, 256);
    for (let y = 0; y < 256; y += step) ctx.fillRect(0, y, 256, step * .34);
  } else if (/dot|polka|star/.test(pattern)) {
    for (let y = step / 2; y < 256; y += step) {
      for (let x = step / 2; x < 256; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, step * .14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (/gradient|tie-dye/.test(pattern)) {
    const gradient = ctx.createLinearGradient(0, 0, 256, 256);
    gradient.addColorStop(0, spec.primaryColor);
    gradient.addColorStop(.5, spec.secondaryColor);
    gradient.addColorStop(1, spec.primaryColor);
    ctx.globalAlpha = 1;
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
  } else {
    for (let i = 0; i < 36; i++) {
      const x = (i * 73) % 256;
      const y = (i * 47) % 256;
      const r = 7 + (i % 5) * 3;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.5, r, (i % 8) * .35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(spec.patternScale, spec.patternScale);
  texture.rotation = T.MathUtils.degToRad(spec.patternRotation);
  texture.center.set(.5, .5);
  return texture;
}

function garmentMaterial(spec: RichGarmentVisualSpec, texture: T.Texture | null) {
  return new T.MeshPhysicalMaterial({
    color: texture ? '#ffffff' : spec.primaryColor,
    map: texture,
    roughness: spec.roughness,
    metalness: spec.metalness,
    sheen: spec.sheen,
    sheenColor: new T.Color(spec.secondaryColor),
    clearcoat: /vinyl|latex|patent|sequins|metallic/i.test(spec.material) ? .42 : .06,
    clearcoatRoughness: Math.min(.8, spec.roughness),
  });
}

function defaultAnchor(spec: RichGarmentVisualSpec): GarmentRigAnchor {
  if (spec.slot === 'bottom') return 'Hips';
  if (spec.slot === 'footwear') return 'Hips';
  if (spec.slot === 'headwear' || spec.slot === 'eyewear') return 'Head';
  return 'Torso';
}

function markRigAnchor(mesh: T.Mesh, anchor: GarmentRigAnchor) {
  mesh.userData.rigAnchor = anchor;
  return mesh;
}

function garmentConstructionMaterial(spec: RichGarmentVisualSpec, lighten = false) {
  const color = new T.Color(lighten ? spec.secondaryColor : spec.primaryColor);
  if (!lighten) color.offsetHSL(0, 0, -.055);
  return new T.MeshStandardMaterial({
    color,
    roughness: Math.min(1, spec.roughness + .08),
    metalness: Math.max(0, spec.metalness * .25),
  });
}

function addTopConstructionDetails(
  spec: RichGarmentVisualSpec,
  bodyHeight: number,
  halfShoulder: number,
  halfHem: number,
  torsoDepth: number,
  add: (mesh: T.Mesh, anchor: GarmentRigAnchor) => void,
) {
  const seamMaterial = garmentConstructionMaterial(spec, true);
  const foldMaterial = garmentConstructionMaterial(spec);
  const frontZ = spec.z + torsoDepth * .515;

  for (const side of [-1, 1]) {
    const seam = new T.Mesh(new T.BoxGeometry(halfShoulder * .34, .009, .009), seamMaterial.clone());
    seam.name = `garment-shoulder-seam-${side < 0 ? 'left' : 'right'}`;
    seam.position.set(side * halfShoulder * .67, spec.y + bodyHeight * .405, frontZ);
    seam.rotation.z = side * .14;
    add(seam, 'Torso');
  }

  const hem = new T.Mesh(new T.BoxGeometry(halfHem * 1.72, .009, .01), seamMaterial.clone());
  hem.name = 'garment-hem-seam';
  hem.position.set(0, spec.y - bodyHeight * .47, frontZ);
  add(hem, 'Torso');

  for (const [index, x] of [-.16, 0, .16].entries()) {
    const fold = new T.Mesh(new T.BoxGeometry(.008, bodyHeight * (.2 + index * .025), .007), foldMaterial.clone());
    fold.name = `garment-front-fold-${index + 1}`;
    fold.position.set(x * spec.scaleX, spec.y - bodyHeight * (.16 + (index % 2) * .035), frontZ + .004);
    fold.rotation.z = (index - 1) * .055;
    add(fold, 'Torso');
  }
}

function makeDetailTexture(detail: ClothingDetailLayer, color: string) {
  if (typeof document === 'undefined') return null;
  const type = String(detail.type || '').toLowerCase();
  const label = type === 'text' ? String(detail.text || '').trim() : '';
  if (!label) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 92px Arial, sans-serif';
  const words = label.slice(0, 32);
  ctx.fillText(words, canvas.width / 2, canvas.height / 2, canvas.width * .92);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function addDetail(group: T.Group, detail: ClothingDetailLayer, index: number, spec: RichGarmentVisualSpec) {
  const color = /^#[0-9a-fA-F]{6}$/.test(String(detail.color || '')) ? detail.color : spec.secondaryColor;
  const rawScale = Number(detail.scale ?? 100);
  const scale = Math.max(.15, Math.min(3, Number.isFinite(rawScale) ? (Math.abs(rawScale) > 10 ? rawScale / 100 : rawScale) : 1));
  const rawX = Number(detail.offsetX ?? ((index % 3) - 1) * 18);
  const rawY = Number(detail.offsetY ?? (18 - Math.floor(index / 3) * 16));
  const xUnit = Math.abs(rawX) > 1 ? rawX / 100 : rawX;
  const yUnit = Math.abs(rawY) > 1 ? rawY / 100 : rawY;
  const x = T.MathUtils.clamp(xUnit, -.9, .9) * spec.scaleX * .42;
  const yOffset = T.MathUtils.clamp(yUnit, -.9, .9) * spec.scaleY * .42;
  const z = spec.scaleZ * .38 + .014 + index * .00035;
  const type = String(detail.type || 'badge').toLowerCase();
  const rawOpacity = Number(detail.opacity ?? 1);
  const opacity = T.MathUtils.clamp(rawOpacity > 1 ? rawOpacity / 100 : rawOpacity, .05, 1);
  let mesh: T.Mesh;
  const detailTexture = makeDetailTexture(detail, color);

  if (/stud|button/.test(type)) {
    mesh = new T.Mesh(
      new T.SphereGeometry(.018 * scale, 12, 8),
      new T.MeshStandardMaterial({ color, roughness: .28, metalness: .7, transparent: opacity < 1, opacity }),
    );
  } else if (/zip|trim|stitch/.test(type)) {
    mesh = new T.Mesh(
      new T.BoxGeometry(.014 * scale, .14 * scale, .007),
      new T.MeshStandardMaterial({ color, roughness: .4, metalness: /zip/.test(type) ? .65 : .08, transparent: opacity < 1, opacity }),
    );
  } else {
    // Graphics/patches are intentionally thin surface layers. The previous
    // implementation used chunky boxes at editor scale=100, which produced
    // giant floating diamonds/rectangles in the fitting room.
    mesh = new T.Mesh(
      new T.PlaneGeometry(.12 * scale, .075 * scale),
      new T.MeshStandardMaterial({
        color: detailTexture ? '#ffffff' : color,
        map: detailTexture,
        roughness: /embroidery|patch/.test(type) ? .88 : .58,
        metalness: 0,
        side: T.DoubleSide,
        transparent: true,
        opacity,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    if (detailTexture) mesh.userData.detailTexture = detailTexture;
  }

  mesh.position.set(x, spec.y + yOffset, z + spec.z);
  mesh.rotation.z = T.MathUtils.degToRad(Number(detail?.rotation || 0));
  mesh.castShadow = true;
  markRigAnchor(mesh, defaultAnchor(spec));
  group.add(mesh);
}

function topNeckProfile(collar: string) {
  const value = collar.toLowerCase();
  if (/v-neck/.test(value)) return { width: .16, drop: .19, curve: false };
  if (/scoop/.test(value)) return { width: .2, drop: .17, curve: true };
  if (/polo|shirt|mandarin/.test(value)) return { width: .14, drop: .105, curve: true };
  if (/turtle/.test(value)) return { width: .13, drop: .055, curve: true };
  if (/hood/.test(value)) return { width: .17, drop: .105, curve: true };
  if (/none/.test(value)) return { width: .14, drop: .085, curve: true };
  return { width: .155, drop: .095, curve: true };
}

function buildTopBodyGeometry(
  halfShoulder: number,
  halfHem: number,
  height: number,
  depth: number,
  collar: string,
  isCropped: boolean,
) {
  const shape = new T.Shape();
  const top = height / 2;
  const bottom = -height / 2;
  const shoulderSlope = Math.min(.075, height * .085);
  const neck = topNeckProfile(collar);
  const neckWidth = Math.min(halfShoulder * .52, Math.max(.105, neck.width));
  const neckDrop = Math.min(height * .32, neck.drop + (isCropped ? -.012 : 0));

  shape.moveTo(-halfHem, bottom);
  shape.lineTo(-halfShoulder * .94, top - shoulderSlope * 1.45);
  shape.lineTo(-halfShoulder * .72, top - shoulderSlope * .35);
  shape.lineTo(-neckWidth, top);

  if (neck.curve) {
    shape.quadraticCurveTo(-neckWidth * .72, top - neckDrop * .72, 0, top - neckDrop);
    shape.quadraticCurveTo(neckWidth * .72, top - neckDrop * .72, neckWidth, top);
  } else {
    shape.lineTo(0, top - neckDrop);
    shape.lineTo(neckWidth, top);
  }

  shape.lineTo(halfShoulder * .72, top - shoulderSlope * .35);
  shape.lineTo(halfShoulder * .94, top - shoulderSlope * 1.45);
  shape.lineTo(halfHem, bottom);
  shape.closePath();

  const geometry = new T.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: Math.min(.018, depth * .12),
    bevelThickness: Math.min(.014, depth * .1),
    curveSegments: 8,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function addTopGarment(
  item: ClothingItem,
  spec: RichGarmentVisualSpec,
  material: T.Material,
  add: (mesh: T.Mesh, anchor: GarmentRigAnchor) => void,
) {
  const category = String(item.category || '').toLowerCase();
  const isDress = /dress/.test(category);
  const isOuterwear = /hoodie|jacket|coat|vest/.test(category);
  const isBoxy = /boxy|oversized|structured/.test(`${spec.silhouette} ${spec.cut}`);
  const isFitted = /slim|skinny|fitted|tailored/.test(`${spec.silhouette} ${spec.cut}`);
  const isCropped = /crop/.test(spec.length);
  const bodyHeight = spec.scaleY * (isDress ? .92 : 1.02);
  const drapeSpread = T.MathUtils.lerp(.96, 1.06, spec.drape);
  const taper = T.MathUtils.lerp(1.02, .76, spec.taper);
  const halfShoulder = spec.scaleX * (isBoxy ? .52 : isFitted ? .46 : .49) * drapeSpread;
  const halfHem = halfShoulder * (isDress ? 1.04 + spec.customFlare * .24 : isBoxy ? .94 : isFitted ? .84 : taper) * spec.waistScale;
  const torsoDepth = Math.max(.105, spec.scaleZ * (isOuterwear ? .76 : .64) * T.MathUtils.lerp(.9, 1.12, spec.thickness));

  const torso = new T.Mesh(
    buildTopBodyGeometry(halfShoulder, halfHem, bodyHeight, torsoDepth, spec.collar, isCropped),
    material,
  );
  torso.position.set(0, spec.y, spec.z);
  add(torso, 'Torso');
  addTopConstructionDetails(spec, bodyHeight, halfShoulder, halfHem, torsoDepth, add);

  if (isDress) {
    const skirtHeight = Math.max(.52, spec.scaleY * .96);
    const skirt = new T.Mesh(
      new T.CylinderGeometry(halfHem * .92, halfHem * 1.34, skirtHeight, 24, 2, false),
      material,
    );
    skirt.scale.z = torsoDepth / Math.max(.01, halfHem * 1.02);
    skirt.position.set(0, spec.y - bodyHeight * .48 - skirtHeight * .44, spec.z);
    add(skirt, 'Hips');
  }

  const sleeves = spec.sleeve;
  if (sleeves !== 'sleeveless' && sleeves !== 'none') {
    const sleeveLength = (
      /long|full/.test(sleeves) ? .64 :
      /three-quarter/.test(sleeves) ? .5 :
      /elbow/.test(sleeves) ? .39 :
      /cap/.test(sleeves) ? .18 : .29
    ) * spec.sleeveLengthScale;
    const sleeveRadius = spec.scaleX * (isOuterwear ? .082 : .068) * T.MathUtils.lerp(.92, 1.08, spec.drape) * spec.sleeveWidthScale;
    const shoulderY = spec.y + bodyHeight * .35;
    const sleeveDepthScale = Math.max(.72, torsoDepth / Math.max(.01, sleeveRadius * 2.25));
    for (const side of [-1, 1]) {
      const sleeve = new T.Mesh(
        new T.CylinderGeometry(sleeveRadius * .84, sleeveRadius, sleeveLength, 16, 3, false),
        material,
      );
      sleeve.rotation.z = Math.PI / 2;
      sleeve.scale.z = sleeveDepthScale;
      sleeve.position.set(side * (halfShoulder + sleeveLength * .46), shoulderY - (spec.asymmetry && side > 0 ? .025 : 0), spec.z);
      add(sleeve, side > 0 ? 'UpperArm.L' : 'UpperArm.R');
    }
  }

  if (/turtle/.test(spec.collar)) {
    const neck = new T.Mesh(
      new T.CylinderGeometry(.145, .155, .12, 24, 1, true),
      material,
    );
    neck.scale.z = .72;
    neck.position.set(0, spec.y + bodyHeight * .49, spec.z);
    add(neck, 'Torso');
  } else if (/polo|shirt|mandarin/.test(spec.collar)) {
    const collarMaterial = new T.MeshStandardMaterial({ color: spec.secondaryColor, roughness: spec.roughness, metalness: spec.metalness });
    for (const side of [-1, 1]) {
      const flap = new T.Mesh(new T.BoxGeometry(.13, .07, .018), collarMaterial);
      flap.rotation.z = side * .34;
      flap.position.set(side * .075, spec.y + bodyHeight * .45, spec.z + torsoDepth * .52);
      add(flap, 'Torso');
    }
  }

  if (/hood/.test(spec.collar) || /hoodie/.test(category)) {
    const hood = new T.Mesh(new T.TorusGeometry(.23, .065, 10, 32, Math.PI * 1.55), material);
    hood.rotation.x = Math.PI / 2;
    hood.rotation.z = Math.PI * .22;
    hood.position.set(0, spec.y + bodyHeight * .47, spec.z - torsoDepth * .42);
    add(hood, 'Torso');
  }

  const frontZ = spec.z + torsoDepth * .54;
  if (/zip/.test(spec.closure)) {
    const zip = new T.Mesh(
      new T.BoxGeometry(.014, bodyHeight * .78, .012),
      new T.MeshStandardMaterial({ color: spec.secondaryColor, roughness: .35, metalness: .65 }),
    );
    zip.position.set(0, spec.y - bodyHeight * .03, frontZ);
    add(zip, 'Torso');
  } else if (/button|snap/.test(spec.closure)) {
    for (let i = -2; i <= 2; i++) {
      const button = new T.Mesh(
        new T.CylinderGeometry(.018, .018, .008, 12),
        new T.MeshStandardMaterial({ color: spec.secondaryColor, roughness: .36, metalness: .2 }),
      );
      button.rotation.x = Math.PI / 2;
      button.position.set(0, spec.y + i * bodyHeight * .13, frontZ);
      add(button, 'Torso');
    }
  }
}


export function buildProceduralGarment(item: ClothingItem, variant?: ClothingPreviewVariant) {
  const spec = buildRichGarmentVisualSpec(item, variant);
  const group = new T.Group();
  group.name = `rich-garment-${item.id}`;
  const texture = makeGarmentPatternTexture(spec);
  const material = garmentMaterial(spec, texture);
  const add = (mesh: T.Mesh, anchor: GarmentRigAnchor) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    markRigAnchor(mesh, anchor);
    group.add(mesh);
  };

  if (spec.slot === 'top') {
    addTopGarment(item, spec, material, add);
  } else if (spec.slot === 'bottom') {
    const garment = (item.garment_config || {}) as Record<string, unknown>;
    const category = String(item.category || '').toLowerCase();
    const skirtLike = /skirt|dress|a-line|wide/.test(`${category} ${garment.silhouette || ''}`.toLowerCase());
    if (skirtLike) {
      const waist = spec.scaleX * .39 * spec.waistScale;
      const hem = spec.scaleX * (.48 + spec.flare + spec.customFlare * .24);
      const skirt = new T.Mesh(new T.CylinderGeometry(waist, hem, spec.scaleY, 40, 4, false), material);
      skirt.scale.z = .7;
      skirt.position.set(0, spec.y, spec.z);
      add(skirt, 'Hips');
    } else {
      const shortFactor = /short/.test(category) ? .52 : 1;
      const legHeight = spec.scaleY * shortFactor;
      const topRadius = spec.scaleX * .18 * spec.waistScale;
      const bottomRadius = topRadius * T.MathUtils.lerp(1.02, .74, spec.taper);
      for (const side of [-1, 1]) {
        const anchor = side > 0 ? 'UpperLeg.L' : 'UpperLeg.R';
        const leg = new T.Mesh(new T.CylinderGeometry(bottomRadius, topRadius, legHeight, 22, 4, false), material);
        leg.scale.z = .72;
        leg.position.set(side * spec.scaleX * .22, spec.y + (spec.scaleY - legHeight) * .24, spec.z);
        add(leg, anchor);
        const crease = new T.Mesh(new T.BoxGeometry(.007, legHeight * .72, .006), garmentConstructionMaterial(spec));
        crease.name = `garment-trouser-crease-${side > 0 ? 'left' : 'right'}`;
        crease.position.set(side * spec.scaleX * .22, leg.position.y, spec.z + spec.scaleZ * .27);
        add(crease, anchor);
      }
    }
  } else if (spec.slot === 'footwear') {
    const category = String(item.category || '').toLowerCase();
    const isBoot = /boot/.test(category);
    const isTrainer = /trainer|sneaker/.test(category);
    for (const side of [-1, 1]) {
      const anchor = side > 0 ? 'Foot.L' : 'Foot.R';
      const upper = new T.Mesh(
        new T.CapsuleGeometry(spec.scaleY * (isBoot ? .52 : .42), spec.scaleZ * (isBoot ? .58 : .38), 6, 16),
        material,
      );
      upper.rotation.x = Math.PI / 2;
      upper.scale.set(1, isBoot ? 1.08 : .92, .78);
      upper.position.set(side * .2, spec.y + (isBoot ? .06 : .015), .11 + spec.z);
      add(upper, anchor);

      const toe = new T.Mesh(new T.SphereGeometry(spec.scaleY * (isTrainer ? .52 : .46), 18, 12), material);
      toe.scale.set(1.35, .55, 1.6);
      toe.position.set(side * .2, spec.y - .015, .24 + spec.z);
      add(toe, anchor);

      const sole = new T.Mesh(new T.BoxGeometry(spec.scaleX * .78, Math.max(.018, spec.scaleY * .11), spec.scaleZ * .86), garmentConstructionMaterial(spec, true));
      sole.name = `garment-shoe-sole-${side > 0 ? 'left' : 'right'}`;
      sole.position.set(side * .2, spec.y - spec.scaleY * .34, .14 + spec.z);
      add(sole, anchor);
    }
  } else if (spec.slot === 'headwear') {
    const crown = new T.Mesh(new T.CylinderGeometry(spec.scaleX * .55, spec.scaleX * .62, spec.scaleY, 28), material);
    crown.position.set(0, spec.y, spec.z);
    add(crown, 'Head');
    const brim = new T.Mesh(new T.CylinderGeometry(spec.scaleX * .82, spec.scaleX * .82, .025, 32), material);
    brim.position.set(0, spec.y - spec.scaleY * .48, spec.z);
    add(brim, 'Head');
  } else if (spec.slot === 'eyewear') {
    const frameMaterial = new T.MeshStandardMaterial({ color: spec.primaryColor, roughness: .28, metalness: .45 });
    for (const side of [-1, 1]) {
      const lens = new T.Mesh(new T.TorusGeometry(.105, .012, 8, 20), frameMaterial);
      lens.position.set(side * .13, spec.y, .18 + spec.z);
      add(lens, 'Head');
    }
    const bridge = new T.Mesh(new T.BoxGeometry(.08, .012, .012), frameMaterial);
    bridge.position.set(0, spec.y, .18 + spec.z);
    add(bridge, 'Head');
  } else {
    const accessory = new T.Mesh(new T.TorusGeometry(.22, .025, 10, 28), material);
    accessory.position.set(0, spec.y, .2 + spec.z);
    accessory.rotation.x = Math.PI / 2;
    add(accessory, 'Torso');
  }

  group.position.x = spec.bodyOffsetX;
  // Keep all generated clothing in avatar proportions even when older records
  // contain out-of-range render controls.
  group.scale.set(
    T.MathUtils.clamp(group.scale.x, .75, 1.25),
    T.MathUtils.clamp(group.scale.y, .75, 1.25),
    T.MathUtils.clamp(group.scale.z, .75, 1.25),
  );

  const details = Array.isArray(item.detail_layers) ? item.detail_layers.slice(0, 18) : [];
  details.forEach((detail, index) => addDetail(group, detail, index, spec));
  if (spec.distress > .05) {
    const distressMaterial = new T.MeshBasicMaterial({ color: '#151515', transparent: true, opacity: Math.min(.5, .12 + spec.distress * .35), wireframe: true });
    const distress = new T.Mesh(new T.SphereGeometry(Math.max(.3, spec.scaleX * .58), 12, 8), distressMaterial);
    distress.scale.set(1.15, 1.3, .58);
    distress.position.set(0, spec.y, spec.z + .04);
    add(distress, defaultAnchor(spec));
  }

  group.userData.dispose = () => {
    texture?.dispose();
    group.traverse(object => {
      if (!(object instanceof T.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(entry => entry.dispose());
      const detailTexture = object.userData.detailTexture as T.Texture | undefined;
      detailTexture?.dispose();
    });
  };
  return group;
}

export function disposeProceduralGarment(group: T.Group | null | undefined) {
  if (!group) return;
  group.userData.dispose?.();
}
