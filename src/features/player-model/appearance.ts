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
  'original', 'bald', 'buzz', 'quiff', 'mohawk', 'bob', 'shoulder', 'layered_long', 'long_waves',
  'ponytail', 'high_ponytail', 'side_braid', 'twin_ponytails', 'bun', 'curls', 'long',
] as const;
export const FACIAL_HAIR_STYLES = ['none', 'stubble', 'moustache', 'goatee', 'short_beard', 'full_beard', 'long_beard', 'sideburns'] as const;
export const HAIR_LABELS: Record<typeof HAIR_STYLES[number], string> = {
  original: 'Original haircut', bald: 'Bald', buzz: 'Buzz cut', quiff: 'Quiff', mohawk: 'Mohawk', bob: 'Bob',
  shoulder: 'Shoulder length', layered_long: 'Layered long hair', long_waves: 'Long waves', ponytail: 'Ponytail',
  high_ponytail: 'High ponytail', side_braid: 'Side braid', twin_ponytails: 'Twin ponytails', bun: 'Bun', curls: 'Curls', long: 'Long hair',
};
export const FACIAL_HAIR_LABELS: Record<typeof FACIAL_HAIR_STYLES[number], string> = { none: 'Clean shaven', stubble: 'Stubble', moustache: 'Moustache', goatee: 'Goatee', short_beard: 'Short beard', full_beard: 'Full beard', long_beard: 'Long beard', sideburns: 'Sideburns' };
export const HAIR_COLORS = [['Black', '#221f24'], ['Brown', '#54372a'], ['Chestnut', '#854b32'], ['Ginger', '#b75e32'], ['Blond', '#d5b474'], ['Silver', '#aeb5bd'], ['White', '#eee8db'], ['Pink', '#d376a1'], ['Blue', '#426baa'], ['Purple', '#8055a2']] as const;
export function headModelStyle(appearance: PlayerAppearance): Style { return appearance.head.hairStyle && appearance.head.hairStyle !== 'original' ? 'casual' : appearance.head.style; }
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/).transform(value => value.toLowerCase());
const item = (slot: EquipmentSlot) => z.string().refine(value => STARTER_ITEMS[slot].some(entry => entry.id === value), 'Choose an available starter item');
export const appearanceSchema = z.object({
  version: z.literal(1),
  body: z.object({ frame: z.enum(['masculine', 'feminine']), height: z.number().finite().min(0.9).max(1.1), build: z.number().finite().min(0.85).max(1.15), skin: color }).strict(),
  head: z.object({ style: z.enum(STYLES), hair: color, hairStyle: z.enum(HAIR_STYLES).optional(), facialHair: z.enum(FACIAL_HAIR_STYLES).optional(), facialHairColor: color.optional() }).strict(),
  equipment: z.object({
    top: z.object({ itemId: item('top'), color }).strict(),
    bottom: z.object({ itemId: item('bottom'), color }).strict(),
    footwear: z.object({ itemId: item('footwear'), color }).strict(),
    instrument: z.object({ itemId: z.literal('starter.instrument.standard'), color }).strict(),
  }).strict(),
}).strict();
export type PlayerAppearance = z.infer<typeof appearanceSchema>;

export function defaultAppearance(seed = ''): PlayerAppearance {
  let hash = 0; for (const c of seed) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const style = STYLES[hash % STYLES.length];
  return {
    version: 1,
    body: { frame: 'masculine', height: 1, build: 1, skin: ['#d4a373', '#8d5524', '#edc7a5', '#593a2d'][hash % 4] },
    head: { style, hair: '#282027' },
    equipment: {
      top: { itemId: `starter.top.${style}`, color: ['#496c7d', '#683c57', '#334f49'][hash % 3] },
      bottom: { itemId: `starter.bottom.${style}`, color: '#272e39' },
      footwear: { itemId: `starter.footwear.${style}`, color: '#25232b' },
      instrument: { itemId: 'starter.instrument.standard', color: '#b97536' },
    },
  };
}
export function resolveAppearance(value: unknown, seed = ''): PlayerAppearance {
  const parsed = appearanceSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultAppearance(seed);
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
