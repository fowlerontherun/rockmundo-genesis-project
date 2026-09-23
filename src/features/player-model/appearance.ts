import { z } from 'zod';

/** Stable cosmetic IDs. New paid/unlocked items must be granted by the server,
 * never added to this free starter allow-list to bypass an ownership check. */
export const STYLES = ['casual', 'punk', 'suit'] as const;
export const SLOTS = ['top', 'bottom', 'footwear'] as const;
export type Style = typeof STYLES[number];
export type EquipmentSlot = typeof SLOTS[number];
export const STYLE_LABELS: Record<Style, string> = { casual: 'Casual', punk: 'Punk', suit: 'Tailored' };
export type Fabric = 'plain' | 'stripe' | 'plaid' | 'pinstripe' | 'denim' | 'canvas' | 'two-tone' | 'patent';
export interface StarterItem { id: string; style: Style; label: string; fabric: Fabric }
const wardrobe = (slot: EquipmentSlot, rows: [string, Style, string, Fabric][]): StarterItem[] => rows.map(([key, style, label, fabric]) => ({ id: `starter.${slot}.${key}`, style, label, fabric }));
export const STARTER_ITEMS: Record<EquipmentSlot, StarterItem[]> = {
  top: wardrobe('top', [
    ['casual', 'casual', 'Everyday top', 'plain'], ['punk', 'punk', 'Punk top', 'plain'], ['suit', 'suit', 'Tailored jacket', 'plain'],
    ['stripe', 'casual', 'Striped top', 'stripe'], ['plaid', 'punk', 'Plaid punk top', 'plaid'], ['pinstripe', 'suit', 'Pinstripe jacket', 'pinstripe'],
  ]),
  bottom: wardrobe('bottom', [
    ['casual', 'casual', 'Everyday trousers', 'plain'], ['punk', 'punk', 'Punk trousers', 'plain'], ['suit', 'suit', 'Tailored trousers', 'plain'],
    ['denim', 'casual', 'Denim trousers', 'denim'], ['plaid', 'suit', 'Checked trousers', 'plaid'], ['pinstripe', 'suit', 'Pinstripe trousers', 'pinstripe'],
  ]),
  footwear: wardrobe('footwear', [
    ['casual', 'casual', 'Everyday shoes', 'plain'], ['punk', 'punk', 'Punk boots', 'plain'], ['suit', 'suit', 'Formal shoes', 'plain'],
    ['canvas', 'casual', 'Canvas shoes', 'canvas'], ['two-tone', 'suit', 'Two-tone shoes', 'two-tone'], ['patent', 'suit', 'Patent shoes', 'patent'],
  ]),
};
export const SLOT_LABELS: Record<EquipmentSlot, string> = { top: 'Tops', bottom: 'Bottoms', footwear: 'Footwear' };
export const CLOTHING_COLORS = [
  ['Black', '#20232b'], ['Chalk', '#eee8db'], ['Slate', '#657386'], ['Red', '#bd3548'],
  ['Rust', '#ad6241'], ['Gold', '#d8ad49'], ['Green', '#3d795b'], ['Teal', '#338b8d'],
  ['Blue', '#426baa'], ['Navy', '#283954'], ['Purple', '#8055a2'], ['Pink', '#d376a1'],
] as const;
export function equipmentItem(appearance: PlayerAppearance, slot: EquipmentSlot): StarterItem {
  return STARTER_ITEMS[slot].find(item => item.id === appearance.equipment[slot].itemId) ?? STARTER_ITEMS[slot][0];
}
export const HAIR_STYLES = [
  'original', 'bald', 'buzz', 'quiff', 'mohawk', 'faux_hawk', 'undercut', 'slick_back', 'side_part', 'curtain',
  'pixie', 'bob', 'shoulder', 'shag', 'mullet', 'layered_long', 'long_waves', 'long',
  'ponytail', 'high_ponytail', 'side_braid', 'box_braids', 'cornrows', 'locs_short', 'locs_long',
  'twin_ponytails', 'bun', 'messy_bun', 'space_buns', 'curls', 'afro', 'afro_puffs',
] as const;
export const FACIAL_HAIR_STYLES = ['none', 'stubble', 'moustache', 'goatee', 'short_beard', 'full_beard', 'long_beard', 'sideburns'] as const;
export const HAT_STYLES = ['none', 'beanie', 'baseball_cap', 'bucket_hat', 'fedora', 'cowboy'] as const;
export const GLASSES_STYLES = ['none', 'round', 'square', 'aviator', 'sunglasses'] as const;
export const EARRING_STYLES = ['none', 'studs', 'hoops', 'drops'] as const;
export const FACE_SHAPES = ['classic', 'oval', 'angular', 'soft', 'wide'] as const;
export const EYEBROW_STYLES = ['natural', 'straight', 'arched', 'bold', 'soft'] as const;
export const SKIN_DETAILS = ['smooth', 'freckles', 'beauty_marks', 'weathered'] as const;
export const HAT_LABELS: Record<typeof HAT_STYLES[number], string> = { none: 'No hat', beanie: 'Beanie', baseball_cap: 'Baseball cap', bucket_hat: 'Bucket hat', fedora: 'Fedora', cowboy: 'Cowboy hat' };
export const GLASSES_LABELS: Record<typeof GLASSES_STYLES[number], string> = { none: 'No glasses', round: 'Round glasses', square: 'Square glasses', aviator: 'Aviators', sunglasses: 'Sunglasses' };
export const EARRING_LABELS: Record<typeof EARRING_STYLES[number], string> = { none: 'No earrings', studs: 'Studs', hoops: 'Hoops', drops: 'Drop earrings' };
export const FACE_SHAPE_LABELS: Record<typeof FACE_SHAPES[number], string> = { classic: 'Classic', oval: 'Oval', angular: 'Angular', soft: 'Soft', wide: 'Wide' };
export const EYEBROW_LABELS: Record<typeof EYEBROW_STYLES[number], string> = { natural: 'Natural', straight: 'Straight', arched: 'Arched', bold: 'Bold', soft: 'Soft' };
export const SKIN_DETAIL_LABELS: Record<typeof SKIN_DETAILS[number], string> = { smooth: 'Smooth', freckles: 'Freckles', beauty_marks: 'Beauty marks', weathered: 'Weathered' };
export const ACCESSORY_COLORS = [['Black', '#20232b'], ['Chalk', '#eee8db'], ['Red', '#bd3548'], ['Gold', '#d8ad49'], ['Green', '#3d795b'], ['Blue', '#426baa'], ['Purple', '#8055a2'], ['Pink', '#d376a1']] as const;
export const HAIR_LABELS: Record<typeof HAIR_STYLES[number], string> = {
  original: 'Original haircut', bald: 'Bald', buzz: 'Buzz cut', quiff: 'Quiff', mohawk: 'Mohawk', faux_hawk: 'Faux hawk',
  undercut: 'Undercut', slick_back: 'Slicked back', side_part: 'Side part', curtain: 'Curtain cut', pixie: 'Pixie cut', bob: 'Bob',
  shoulder: 'Shoulder length', shag: 'Shag', mullet: 'Mullet', layered_long: 'Layered long hair', long_waves: 'Long waves', long: 'Long hair',
  ponytail: 'Ponytail', high_ponytail: 'High ponytail', side_braid: 'Side braid', box_braids: 'Box braids', cornrows: 'Cornrows',
  locs_short: 'Short locs', locs_long: 'Long locs', twin_ponytails: 'Twin ponytails', bun: 'Bun', messy_bun: 'Messy bun',
  space_buns: 'Space buns', curls: 'Curls', afro: 'Afro', afro_puffs: 'Afro puffs',
};
export const FACIAL_HAIR_LABELS: Record<typeof FACIAL_HAIR_STYLES[number], string> = { none: 'Clean shaven', stubble: 'Stubble', moustache: 'Moustache', goatee: 'Goatee', short_beard: 'Short beard', full_beard: 'Full beard', long_beard: 'Long beard', sideburns: 'Sideburns' };
export const HAIR_COLORS = [['Black', '#221f24'], ['Brown', '#54372a'], ['Chestnut', '#854b32'], ['Ginger', '#b75e32'], ['Blond', '#d5b474'], ['Silver', '#aeb5bd'], ['White', '#eee8db'], ['Pink', '#d376a1'], ['Blue', '#426baa'], ['Purple', '#8055a2']] as const;
export const EYE_COLORS = [['Dark brown', '#402a22'], ['Brown', '#65442d'], ['Hazel', '#8a713d'], ['Green', '#4f755a'], ['Blue', '#4d79a8'], ['Grey', '#7b8794'], ['Amber', '#a16b2f']] as const;
export function headModelStyle(appearance: PlayerAppearance): Style { return appearance.head.hairStyle && appearance.head.hairStyle !== 'original' ? 'casual' : appearance.head.style; }
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/).transform(value => value.toLowerCase());
const item = (slot: EquipmentSlot) => z.string().refine(value => STARTER_ITEMS[slot].some(entry => entry.id === value), 'Choose an available starter item');
export const appearanceSchema = z.object({
  version: z.literal(1),
  body: z.object({ frame: z.enum(['masculine', 'feminine']), height: z.number().finite().min(0.9).max(1.1), build: z.number().finite().min(0.85).max(1.15), skin: color }).strict(),
  head: z.object({ style: z.enum(STYLES), hair: color, hairStyle: z.enum(HAIR_STYLES).optional(), facialHair: z.enum(FACIAL_HAIR_STYLES).optional(), facialHairColor: color.optional(), faceShape: z.enum(FACE_SHAPES).optional(), eyeColor: color.optional(), eyebrowStyle: z.enum(EYEBROW_STYLES).optional(), eyebrowColor: color.optional(), skinDetail: z.enum(SKIN_DETAILS).optional() }).strict(),
  equipment: z.object({
    top: z.object({ itemId: item('top'), color }).strict(),
    bottom: z.object({ itemId: item('bottom'), color }).strict(),
    footwear: z.object({ itemId: item('footwear'), color }).strict(),
    instrument: z.object({ itemId: z.literal('starter.instrument.standard'), color }).strict(),
  }).strict(),
  accessories: z.object({
    hat: z.enum(HAT_STYLES),
    hatColor: color,
    glasses: z.enum(GLASSES_STYLES),
    glassesColor: color,
    lensTint: z.enum(['clear', 'tinted']).optional(),
    lensColor: color.optional(),
    earrings: z.enum(EARRING_STYLES).optional(),
    leftEarring: z.enum(EARRING_STYLES).optional(),
    rightEarring: z.enum(EARRING_STYLES).optional(),
    earringColor: color.optional(),
  }).strict().optional(),
}).strict();
export type PlayerAppearance = z.infer<typeof appearanceSchema>;

export function defaultAppearance(seed = ''): PlayerAppearance {
  let hash = 0; for (const c of seed) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const style = STYLES[hash % STYLES.length];
  return {
    version: 1,
    body: { frame: 'masculine', height: 1, build: 1, skin: ['#d4a373', '#8d5524', '#edc7a5', '#593a2d'][hash % 4] },
    head: { style, hair: '#282027', faceShape: 'classic', eyeColor: '#65442d', eyebrowStyle: 'natural', skinDetail: 'smooth' },
    equipment: {
      top: { itemId: 'starter.top.casual', color: '#eee8db' },
      bottom: { itemId: `starter.bottom.${style}`, color: '#272e39' },
      footwear: { itemId: `starter.footwear.${style}`, color: '#25232b' },
      instrument: { itemId: 'starter.instrument.standard', color: '#b97536' },
    },
    accessories: { hat: 'none', hatColor: '#20232b', glasses: 'none', glassesColor: '#20232b', earrings: 'none', leftEarring: 'none', rightEarring: 'none', earringColor: '#d8ad49' },
  };
}
export function resolveAppearance(value: unknown, seed = ''): PlayerAppearance {
  const parsed = appearanceSchema.safeParse(value);
  if (!parsed.success) return defaultAppearance(seed);
  return {
    ...parsed.data,
    head: {
      ...parsed.data.head,
      faceShape: parsed.data.head.faceShape ?? 'classic',
      eyeColor: parsed.data.head.eyeColor ?? '#65442d',
      eyebrowStyle: parsed.data.head.eyebrowStyle ?? 'natural',
      skinDetail: parsed.data.head.skinDetail ?? 'smooth',
    },
    accessories: {
      hat: parsed.data.accessories?.hat ?? 'none',
      hatColor: parsed.data.accessories?.hatColor ?? '#20232b',
      glasses: parsed.data.accessories?.glasses ?? 'none',
      glassesColor: parsed.data.accessories?.glassesColor ?? '#20232b',
      ...(parsed.data.accessories?.lensTint ? { lensTint: parsed.data.accessories.lensTint } : {}),
      ...(parsed.data.accessories?.lensColor ? { lensColor: parsed.data.accessories.lensColor } : {}),
      earrings: parsed.data.accessories?.earrings ?? 'none',
      leftEarring: parsed.data.accessories?.leftEarring ?? parsed.data.accessories?.earrings ?? 'none',
      rightEarring: parsed.data.accessories?.rightEarring ?? parsed.data.accessories?.earrings ?? 'none',
      earringColor: parsed.data.accessories?.earringColor ?? '#d8ad49',
    },
  };
}
export function equipmentStyle(appearance: PlayerAppearance, slot: EquipmentSlot): Style {
  return equipmentItem(appearance, slot).style;
}
export function modelFile(frame: PlayerAppearance['body']['frame'], style: Style) {
  return `${frame === 'feminine' ? 'female-' : ''}${style}.glb`;
}

/** A one-time starting point for characters who used the older avatar designer. */
export function appearanceFromLegacy(value: Record<string, unknown> | null, seed: string): PlayerAppearance {
  const result = defaultAppearance(seed); if (!value) return result;
  const dye = (v: unknown, fallback: string) => color.safeParse(v).success ? String(v).toLowerCase() : fallback;
  result.body.frame = value.gender === 'female' ? 'feminine' : 'masculine';
  result.body.skin = dye(value.skin_tone, result.body.skin);
  result.head.hair = dye(value.hair_color, result.head.hair);
  result.body.height = Math.max(.9, Math.min(1.1, Number(value.height) / 178 || 1));
  for (const [slot, key] of [['top', 'shirt_color'], ['bottom', 'pants_color'], ['footwear', 'shoes_color']] as const) result.equipment[slot].color = dye(value[key], result.equipment[slot].color);
  return result;
}
