import * as T from 'three';
import type { ClothingItem } from '@/hooks/useSkinStore';
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

function addDetail(group: T.Group, detail: any, index: number, spec: RichGarmentVisualSpec) {
  const color = /^#[0-9a-fA-F]{6}$/.test(String(detail?.color || '')) ? detail.color : spec.secondaryColor;
  const scale = Math.max(.45, Math.min(1.8, Number(detail?.scale || 1)));
  const x = Math.max(-.33, Math.min(.33, Number(detail?.offsetX ?? detail?.offset_x ?? ((index % 3) - 1) * .16)));
  const yOffset = Math.max(-.34, Math.min(.34, Number(detail?.offsetY ?? detail?.offset_y ?? .14 - Math.floor(index / 3) * .12)));
  const z = spec.scaleZ / 2 + .025 + index * .0005;
  const type = String(detail?.type || 'badge').toLowerCase();
  let mesh: T.Mesh;

  if (/stud|button/.test(type)) {
    mesh = new T.Mesh(new T.SphereGeometry(.025 * scale, 10, 8), new T.MeshStandardMaterial({ color, roughness: .28, metalness: .7 }));
  } else if (/zip|trim|stitch/.test(type)) {
    mesh = new T.Mesh(new T.BoxGeometry(.025 * scale, .22 * scale, .012), new T.MeshStandardMaterial({ color, roughness: .4, metalness: /zip/.test(type) ? .65 : .08 }));
  } else {
    mesh = new T.Mesh(new T.BoxGeometry(.16 * scale, .1 * scale, .012), new T.MeshStandardMaterial({ color, roughness: /embroidery|patch/.test(type) ? .88 : .5, metalness: 0 }));
  }

  mesh.position.set(x, spec.y + yOffset, z + spec.z);
  mesh.rotation.z = T.MathUtils.degToRad(Number(detail?.rotation || 0));
  mesh.castShadow = true;
  markRigAnchor(mesh, defaultAnchor(spec));
  group.add(mesh);
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
    const body = new T.Mesh(new T.CapsuleGeometry(spec.scaleX * .48, spec.scaleY * .78, 8, 18), material);
    body.scale.set(1, 1, spec.scaleZ / Math.max(.01, spec.scaleX * .48));
    body.position.set(0, spec.y, spec.z);
    add(body, 'Torso');
    const garment = (item.garment_config || {}) as Record<string, any>;
    const sleeves = String(garment.sleeve || garment.sleeveStyle || garment.sleeve_style || 'short').toLowerCase();
    if (sleeves !== 'sleeveless' && sleeves !== 'none') {
      const sleeveLength = /long|full/.test(sleeves) ? .58 : .28;
      for (const side of [-1, 1]) {
        const sleeve = new T.Mesh(new T.CapsuleGeometry(.105 * spec.scaleX, sleeveLength, 6, 12), material);
        sleeve.position.set(side * spec.scaleX * .55, spec.y + .08, spec.z);
        sleeve.rotation.z = side * -.18;
        add(sleeve, side > 0 ? 'UpperArm.L' : 'UpperArm.R');
      }
    }
  } else if (spec.slot === 'bottom') {
    const garment = (item.garment_config || {}) as Record<string, any>;
    const skirtLike = /skirt|dress|a-line|wide/.test(`${item.category} ${garment.silhouette || ''}`.toLowerCase());
    if (skirtLike) {
      const skirt = new T.Mesh(new T.CylinderGeometry(spec.scaleX * .42, spec.scaleX * (.5 + spec.flare), spec.scaleY, 28, 1, false), material);
      skirt.position.set(0, spec.y, spec.z);
      add(skirt, 'Hips');
    } else {
      for (const side of [-1, 1]) {
        const leg = new T.Mesh(new T.CapsuleGeometry(spec.scaleX * .22, spec.scaleY, 6, 14), material);
        leg.position.set(side * spec.scaleX * .25, spec.y, spec.z);
        add(leg, side > 0 ? 'UpperLeg.L' : 'UpperLeg.R');
      }
    }
  } else if (spec.slot === 'footwear') {
    for (const side of [-1, 1]) {
      const shoe = new T.Mesh(new T.BoxGeometry(spec.scaleX, spec.scaleY, spec.scaleZ), material);
      shoe.position.set(side * .2, spec.y, .09 + spec.z);
      shoe.rotation.x = -.08;
      add(shoe, side > 0 ? 'Foot.L' : 'Foot.R');
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
    });
  };
  return group;
}

export function disposeProceduralGarment(group: T.Group | null | undefined) {
  if (!group) return;
  group.userData.dispose?.();
}
