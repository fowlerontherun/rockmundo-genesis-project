import type { ClothingItem } from '@/hooks/useSkinStore';
import type { ClothingPreviewVariant } from './clothingPreview';

export type RichGarmentSlot = 'top' | 'bottom' | 'footwear' | 'headwear' | 'eyewear' | 'accessory';

export interface RichGarmentVisualSpec {
  slot: RichGarmentSlot;
  primaryColor: string;
  secondaryColor: string;
  pattern: string;
  material: string;
  roughness: number;
  metalness: number;
  sheen: number;
  opacity: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  y: number;
  z: number;
  flare: number;
  distress: number;
  patternScale: number;
  patternRotation: number;
  detailCount: number;
  silhouette: string;
  cut: string;
  sleeve: string;
  collar: string;
  closure: string;
  length: string;
  bodyOffsetX: number;
  drape: number;
  taper: number;
  thickness: number;
  asymmetry: boolean;
  hem: string;
  sleeveLengthScale: number;
  sleeveWidthScale: number;
  waistScale: number;
  customFlare: number;
}

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
};

const hex = (value: unknown, fallback: string) => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;

const percent01 = (value: unknown, fallback: number) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number > 1 ? number / 100 : number));
};

const percentScale = (value: unknown, fallback = 1) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(.1, Math.min(4, number > 10 ? number / 100 : number));
};

const signedPercent = (value: unknown, maxWorld: number, fallback = 0) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  const normalized = Math.abs(number) > 1 ? number / 100 : number;
  return Math.max(-1, Math.min(1, normalized)) * maxWorld;
};

export function richGarmentSlot(item: ClothingItem): RichGarmentSlot {
  const slot = String(item.wearable_slot || item.category || '').toLowerCase();
  if (['bottom', 'pants', 'jeans', 'shorts', 'skirt'].includes(slot)) return 'bottom';
  if (['footwear', 'shoes', 'boots', 'trainers'].includes(slot)) return 'footwear';
  if (['headwear', 'hat'].includes(slot)) return 'headwear';
  if (['eyewear', 'glasses'].includes(slot)) return 'eyewear';
  if (['accessory'].includes(slot)) return 'accessory';
  return 'top';
}

function materialDefaults(material: string) {
  switch (material.toLowerCase()) {
    case 'leather': return { roughness: 0.32, metalness: 0.02, sheen: 0.45 };
    case 'vinyl': return { roughness: 0.16, metalness: 0.03, sheen: 0.72 };
    case 'latex': return { roughness: 0.1, metalness: 0.01, sheen: 0.85 };
    case 'silk':
    case 'satin': return { roughness: 0.22, metalness: 0, sheen: 0.82 };
    case 'sequins': return { roughness: 0.24, metalness: 0.48, sheen: 0.9 };
    case 'metallic': return { roughness: 0.24, metalness: 0.82, sheen: 0.55 };
    case 'denim': return { roughness: 0.82, metalness: 0, sheen: 0.06 };
    case 'suede': return { roughness: 0.92, metalness: 0, sheen: 0.02 };
    case 'velvet': return { roughness: 0.72, metalness: 0, sheen: 0.7 };
    case 'nylon': return { roughness: 0.4, metalness: 0, sheen: 0.42 };
    default: return { roughness: 0.7, metalness: 0, sheen: 0.12 };
  }
}

export function buildRichGarmentVisualSpec(item: ClothingItem, variant?: ClothingPreviewVariant): RichGarmentVisualSpec {
  const garment = (item.garment_config || {}) as Record<string, unknown>;
  const materialConfig = (item.material_config || {}) as Record<string, unknown>;
  const patternConfig = (item.pattern_config || {}) as Record<string, unknown>;
  const fit = (item.fit_config || {}) as Record<string, unknown>;
  const wear = (item.wear_config || {}) as Record<string, unknown>;
  const render = (item.render_config || {}) as Record<string, unknown>;
  const slot = richGarmentSlot(item);
  const material = String(variant?.material || materialConfig.fabric || 'cotton');
  const defaults = materialDefaults(material);
  const fitName = String(fit.fit || 'regular').toLowerCase();
  const silhouette = String(garment.silhouette || 'classic').toLowerCase();
  const cut = String(garment.cut || 'regular').toLowerCase();
  const sleeve = String(garment.sleeve || garment.sleeveStyle || garment.sleeve_style || 'short').toLowerCase();
  const collar = String(garment.collar || 'crew').toLowerCase();
  const closure = String(garment.closure || 'none').toLowerCase();
  const length = String(garment.length || 'standard').toLowerCase();
  const oversize =
    fitName === 'oversized' || /oversized|boxy/.test(silhouette) || /oversized/.test(cut) ? 1.16 :
    fitName === 'relaxed' || /relaxed|draped/.test(silhouette) || /relaxed|drop-shoulder/.test(cut) ? 1.08 :
    fitName === 'slim' || /slim|fitted/.test(silhouette) || /slim|tailored/.test(cut) ? 0.94 :
    fitName === 'skinny' || /skinny/.test(cut) ? 0.9 : 1;
  const flare = /flare|wide|a-line|skirt|dress/.test(`${silhouette} ${garment.hem || ''}`.toLowerCase()) ? 0.16 : 0;
  const lengthScale =
    /crop/.test(length) ? .76 :
    /long|maxi|longline/.test(length) ? 1.24 :
    /mini|short/.test(length) ? .86 : 1;
  // These are body-space dimensions, not arbitrary display dimensions. Keeping
  // them close to the underlying RockMundo avatar prevents the old "cardboard
  // poncho" effect where a procedural top could span from wrist to wrist.
  const baseScale = slot === 'top' ? [0.54, 0.68 * lengthScale, 0.30] : slot === 'bottom' ? [0.44, 0.74 * lengthScale, 0.28] : slot === 'footwear' ? [0.25, 0.16, 0.42] : slot === 'headwear' ? [0.36, 0.22, 0.30] : slot === 'eyewear' ? [0.30, 0.11, 0.12] : [0.34, 0.22, 0.24];
  const baseY = slot === 'top' ? 1.17 : slot === 'bottom' ? 0.57 : slot === 'footwear' ? 0.105 : slot === 'headwear' ? 1.82 : slot === 'eyewear' ? 1.61 : 1.08;

  return {
    slot,
    primaryColor: hex(variant?.color || materialConfig.primaryColor || materialConfig.primary_color, '#20232b'),
    secondaryColor: hex(variant?.secondaryColor || materialConfig.secondaryColor || materialConfig.secondary_color, '#d8ad49'),
    pattern: String(variant?.pattern || patternConfig.type || 'solid'),
    material,
    roughness: Math.max(.02, percent01(materialConfig.roughness, defaults.roughness)),
    metalness: percent01(materialConfig.metallic ?? materialConfig.metalness, defaults.metalness),
    sheen: percent01(materialConfig.sheen, defaults.sheen),
    opacity: Math.max(.08, percent01(patternConfig.opacity, 1)),
    scaleX: baseScale[0] * oversize * clamp(render.scale ? Number(render.scale) / 100 : 1, 0.7, 1.4, 1) * clamp(Number(garment.widthScale ?? garment.width_scale ?? 100) / 100, .7, 1.4, 1),
    scaleY: baseScale[1] * clamp(garment.lengthScale ?? garment.length_scale, 0.7, 1.35, 1) * clamp(Number(garment.bodyLengthScale ?? garment.body_length_scale ?? 100) / 100, .65, 1.5, 1),
    scaleZ: baseScale[2] * (fitName === 'oversized' ? 1.12 : fitName === 'skinny' ? 0.92 : 1),
    y: baseY + signedPercent(render.bodyOffsetY ?? render.body_offset_y ?? render.offsetY ?? render.offset_y, .35),
    z: signedPercent(render.depthOffset ?? render.depth_offset, .2),
    flare,
    distress: percent01(wear.distress ?? wear.distressIntensity ?? wear.distress_intensity, /distress|stage-worn/.test(String(wear.condition || '')) ? 0.45 : 0),
    patternScale: percentScale(patternConfig.scale, 1),
    patternRotation: clamp(patternConfig.rotation, -360, 360, 0),
    detailCount: Array.isArray(item.detail_layers) ? Math.min(24, item.detail_layers.length) : 0,
    silhouette,
    cut,
    sleeve,
    collar,
    closure,
    length,
    bodyOffsetX: signedPercent(render.bodyOffsetX ?? render.body_offset_x ?? render.offsetX ?? render.offset_x, .35),
    drape: percent01(fit.drape, .5),
    taper: percent01(fit.taper, .25),
    thickness: percent01(materialConfig.thickness, .5),
    asymmetry: Boolean(garment.asymmetry),
    hem: String(garment.hem || 'straight').toLowerCase(),
    sleeveLengthScale: clamp(Number(garment.sleeveLengthScale ?? garment.sleeve_length_scale ?? 100) / 100, .4, 1.6, 1),
    sleeveWidthScale: clamp(Number(garment.sleeveWidthScale ?? garment.sleeve_width_scale ?? 100) / 100, .6, 1.5, 1),
    waistScale: clamp(Number(garment.waistScale ?? garment.waist_scale ?? 100) / 100, .6, 1.5, 1),
    customFlare: percent01(garment.flare, 0),
  };
}
